from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional
from database import get_db
from models import Attendance, Member
from schemas import AttendanceCheckIn, AttendanceResponse, TodayAttendanceResponse
from routers.auth import get_current_user
from utils.auth import require_coach_or_subcoach

router = APIRouter()

# 1. 체크인 (회원용 - 키오스크)
# ✅ response_model 제거 (유연한 딕셔너리 반환을 위해)
@router.post("/check-in")
def check_in(
    data: AttendanceCheckIn, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 1. 특정 회원이 지정된 경우 (재요청)
    if data.member_id:
        member = db.query(Member).filter(Member.id == data.member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="회원 정보를 찾을 수 없습니다.")
            
    # 2. 뒷번호로 검색 (첫 요청)
    else:
        members = db.query(Member).filter(
            Member.gym_id == current_user.gym_id,
            Member.phone.like(f"%{data.phone_last4}")
        ).all()

        if not members:
            raise HTTPException(status_code=404, detail="해당 번호의 회원을 찾을 수 없습니다.")
        
        # ✅ [중복 처리] 동명이인(뒷번호 중복)이 있는 경우
        if len(members) > 1:
            # 중복된 회원 리스트 반환 (프론트에서 선택하도록)
            duplicate_list = [
                {
                    "id": m.id, 
                    "name": m.name, 
                    "phone": m.phone,  # 구분용 (전체 번호)
                    "last_visit": str(m.attendances[-1].date) if m.attendances else "없음"
                } 
                for m in members
            ]
            # 409 Conflict 상태 코드와 함께 리스트 반환
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "Duplicate members found",
                    "duplicates": duplicate_list
                }
            )
            
        # 1명만 검색된 경우 정상 진행
        member = members[0]

    # 2. 오늘 이미 출석했는지 확인
    today = date.today()
    existing = db.query(Attendance).filter(
        Attendance.member_id == member.id,
        Attendance.date == today
    ).first()

    # 3. 출석 기록 저장 (이미 출석했으면 건너뜀)
    if not existing:
        new_attendance = Attendance(
            member_id=member.id,
            gym_id=current_user.gym_id,
            date=today,
            check_in_time=datetime.now()
        )
        db.add(new_attendance)
        db.commit()

    # 4. ✅ [핵심] 남은 기간(D-Day) 계산 로직
    days_remaining = None
    end_date_str = None
    
    if member.end_date:
        delta = member.end_date - today
        days_remaining = delta.days  # 남은 일수 (음수면 만료됨)
        end_date_str = member.end_date.strftime("%Y-%m-%d")

    # 5. 프론트엔드로 정보 리턴
    return {
        "message": "출석이 완료되었습니다." if not existing else "이미 출석 처리되었습니다.",
        "member_name": member.name,
        "days_remaining": days_remaining, # 예: 30
        "end_date": end_date_str          # 예: "2026-02-28"
    }

# 2. 금일 출석 현황 조회 (코치 전용)
@router.get("/today", response_model=List[TodayAttendanceResponse])
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_coach_or_subcoach)
):
    today = date.today()
    attendances = db.query(Attendance).join(Member).filter(
        Attendance.gym_id == current_user.gym_id,
        Attendance.date == today
    ).order_by(Attendance.check_in_time.desc()).all()

    result = []
    for attr in attendances:
        result.append({
            "member_name": attr.member.name,
            "check_in_time": attr.check_in_time
        })
    return result
