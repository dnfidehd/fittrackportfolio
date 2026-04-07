from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ConfigDict
from datetime import date

from database import get_db
from models import PersonalRecord, Member, Goal
from routers.auth import get_current_user
from datetime import datetime

# ✅ prefix, tags 제거 (main.py에서 설정함)
router = APIRouter() 

# --- 스키마 정의 ---
class RecordCreate(BaseModel):
    exercise_name: str
    # 🚨 [수정 핵심] str -> float 변경
    # (그래프 그릴 때도 숫자여야 하고, 에러 로그의 111.0도 실수형입니다)
    record_value: float 
    recorded_date: date

class RecordResponse(RecordCreate):
    id: int
    member_id: int
    
    # Pydantic V2 설정
    model_config = ConfigDict(from_attributes=True)

# 1. 내 기록 목록 조회
@router.get("/me", response_model=List[RecordResponse])
def get_my_records(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    return db.query(PersonalRecord).filter(
        PersonalRecord.member_id == current_user.id
    ).order_by(PersonalRecord.recorded_date.desc()).all()

# 2. 기록 등록 및 수정
# URL: /api/records (슬래시 없음)
@router.post("", response_model=RecordResponse)
def create_or_update_record(
    record_data: RecordCreate, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    # 같은 날짜, 같은 종목이면 수정, 아니면 추가
    existing_record = db.query(PersonalRecord).filter(
        PersonalRecord.member_id == current_user.id,
        PersonalRecord.exercise_name == record_data.exercise_name,
        PersonalRecord.recorded_date == record_data.recorded_date 
    ).first()

    if existing_record:
        existing_record.record_value = str(record_data.record_value)
        db.commit()
        db.refresh(existing_record)
        # 목표 자동 업데이트
        update_related_goals(db, current_user.id, record_data.exercise_name, record_data.record_value)
        return existing_record
    else:
        new_record = PersonalRecord(
            member_id=current_user.id,
            exercise_name=record_data.exercise_name,
            record_value=str(record_data.record_value),
            recorded_date=record_data.recorded_date
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        # 목표 자동 업데이트
        update_related_goals(db, current_user.id, record_data.exercise_name, record_data.record_value)
        return new_record


# ✅ PR 등록 시 관련 목표 자동 업데이트
def update_related_goals(db: Session, member_id: int, exercise_name: str, new_value: float):
    """PR 운동 이름이 목표 제목에 포함되면 current_value 업데이트"""
    # 진행중인 목표 중 운동 이름이 포함된 것 찾기 (예: "백스쿼트" in "백스쿼트 100kg")
    matching_goals = db.query(Goal).filter(
        Goal.member_id == member_id,
        Goal.status == "진행중",
        Goal.category == "pr",  # PR 카테고리만
        Goal.title.ilike(f"%{exercise_name}%")  # 운동명이 포함된 목표
    ).all()
    
    for goal in matching_goals:
        # 새 PR 값이 기존보다 크면 업데이트
        if new_value > goal.current_value:
            goal.current_value = new_value
            # 목표 달성 확인
            if goal.current_value >= goal.target_value:
                goal.status = "달성"
                goal.completed_at = datetime.now()
    
    db.commit()

# 3. 기록 삭제
@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    record = db.query(PersonalRecord).filter(
        PersonalRecord.id == record_id, 
        PersonalRecord.member_id == current_user.id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    db.delete(record)
    db.commit()
    return {"message": "Deleted successfully"}