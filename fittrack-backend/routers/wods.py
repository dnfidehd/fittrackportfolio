from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date, datetime, timedelta

from database import get_db
# ✅ WodVideo 모델 추가 import
from models import Wod, Member, WodRecord, WodVideo
from security import get_current_user, require_permission

# ✅ [수정] prefix 제거 (main.py에서 설정하므로 중복 방지)
router = APIRouter(
    tags=["Wods"],
    responses={404: {"description": "Not found"}},
)

# ==========================================
# 📝 Pydantic Models (데이터 검증)
# ==========================================

# ✅ 영상 데이터 스키마 (URL + 코멘트)
class VideoSchema(BaseModel):
    url: str
    comment: Optional[str] = ""

class WodCreate(BaseModel):
    date: str
    title: str
    content: str
    description: Optional[str] = None # ✅ [신규] 참고사항
    score_type: str = "time"
    is_rest_day: bool = False # ✅ [신규] 휴무일 여부
    videos: List[VideoSchema] = [] 
    
    # ✅ [신규] 팀 와드 설정
    is_team: bool = False
    team_size: Optional[int] = None
class WodResponse(BaseModel):
    id: int
    gym_id: int
    date: date
    title: str
    content: str
    description: Optional[str] = None # ✅ [신규] 참고사항
    score_type: str
    is_rest_day: bool # ✅ [신규] 응답에 휴무일 포함
    created_at: datetime
    videos: List[VideoSchema] = [] 
    
    # ✅ [신규] 팀 와드 설정
    is_team: bool = False
    team_size: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# 기록 저장용 스키마 (기존 유지)
class WodRecordCreate(BaseModel):
    wod_id: int
    record_value: str
    is_rx: bool = False
    scale_rank: Optional[str] = None  # A, B, C or null
    is_time_cap: Optional[bool] = False  # Time Cap(미완주) 여부
    note: Optional[str] = None

class WodRecordResponse(BaseModel):
    id: int
    wod_id: int
    member_id: int
    member_name: str
    record_value: str
    is_rx: bool
    scale_rank: Optional[str] = None
    is_time_cap: bool = False
    note: Optional[str] = None
    created_at: datetime
    wod_date: Optional[date] = None # ✅ 핵심: WOD 수행 날짜 추가
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 🚀 API Endpoints
# ==========================================

# 1. 특정 날짜의 WOD 조회 (일간)
@router.get("/daily/{date_str}", response_model=WodResponse)
def get_wod_by_date(
    date_str: str,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식 오류 (YYYY-MM-DD)")

    wod = db.query(Wod).filter(
        Wod.gym_id == current_user.gym_id,
        Wod.date == target_date
    ).first()
    
    if not wod:
        raise HTTPException(status_code=404, detail="WOD가 없습니다.")
    return wod

# 2. 주간 WOD 조회 (달력용)
@router.get("/weekly", response_model=List[WodResponse])
def get_weekly_wods(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    try:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식 오류")
    
    wods = db.query(Wod).filter(
        Wod.gym_id == current_user.gym_id,
        Wod.date >= s_date,
        Wod.date <= e_date
    ).all()
    
    return wods

# 3. WOD 생성 (영상 리스트 + 휴무일 저장)
@router.post("/", response_model=WodResponse)
def create_wod(
    wod_data: WodCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("wods"))
):
    target_date = datetime.strptime(wod_data.date, "%Y-%m-%d").date()
    
    existing_wod = db.query(Wod).filter(
        Wod.gym_id == current_user.gym_id,
        Wod.date == target_date
    ).first()

    if existing_wod:
        raise HTTPException(status_code=400, detail="이미 해당 날짜에 WOD가 있습니다.")

    # 1) WOD 기본 정보 저장
    new_wod = Wod(
        gym_id=current_user.gym_id,
        date=target_date,
        title=wod_data.title,
        content=wod_data.content,
        description=wod_data.description, # ✅ [신규] 참고사항 저장
        score_type=wod_data.score_type,
        is_rest_day=wod_data.is_rest_day, # ✅ 휴무일 저장
        
        # ✅ [신규] 팀 와드 설정
        is_team=wod_data.is_team,
        team_size=wod_data.team_size
    )
    db.add(new_wod)
    db.commit()
    db.refresh(new_wod)

    # 2) 영상 리스트 저장
    for video in wod_data.videos:
        if video.url.strip():
            new_video = WodVideo(
                wod_id=new_wod.id,
                url=video.url,
                comment=video.comment
            )
            db.add(new_video)
    
    db.commit()
    db.refresh(new_wod)
    return new_wod

# 4. WOD 수정 (휴무일 수정 + 영상 재등록)
@router.put("/{date_str}", response_model=WodResponse)
def update_wod(
    date_str: str,
    wod_data: WodCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("wods"))
):
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    wod = db.query(Wod).filter(Wod.gym_id == current_user.gym_id, Wod.date == target_date).first()
    
    if not wod:
        raise HTTPException(status_code=404, detail="WOD가 없습니다.")
        
    # 1) 기본 정보 업데이트
    wod.title = wod_data.title
    wod.content = wod_data.content
    wod.description = wod_data.description # ✅ [신규] 참고사항 수정
    wod.score_type = wod_data.score_type
    wod.is_rest_day = wod_data.is_rest_day
    
    # ✅ [신규] 팀 와드 설정 업데이트
    wod.is_team = wod_data.is_team
    wod.team_size = wod_data.team_size
    
    # 2) 영상 업데이트: 기존 영상 삭제 후 재등록
    db.query(WodVideo).filter(WodVideo.wod_id == wod.id).delete()
    
    for video in wod_data.videos:
        if video.url.strip():
            new_video = WodVideo(
                wod_id=wod.id,
                url=video.url,
                comment=video.comment
            )
            db.add(new_video)
    
    db.commit()
    db.refresh(wod)
    return wod

# 5. WOD 삭제
@router.delete("/{date_str}")
def delete_wod(
    date_str: str,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("wods"))
):
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    wod = db.query(Wod).filter(Wod.gym_id == current_user.gym_id, Wod.date == target_date).first()
    
    if not wod:
        raise HTTPException(status_code=404, detail="WOD가 없습니다.")
        
    db.delete(wod)
    db.commit()
    return {"message": "삭제되었습니다."}


# =========================================================
# ✅ 와드 기록(Record) 관련 API (기존 유지)
# =========================================================

@router.post("/records", response_model=WodRecordResponse)
def create_wod_record(
    record_data: WodRecordCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    wod = db.query(Wod).filter(Wod.id == record_data.wod_id).first()
    if not wod:
        raise HTTPException(status_code=404, detail="WOD not found")

    existing_record = db.query(WodRecord).filter(
        WodRecord.wod_id == record_data.wod_id, 
        WodRecord.member_id == current_user.id
    ).first()

    if existing_record:
        existing_record.record_value = record_data.record_value
        existing_record.is_rx = record_data.is_rx
        existing_record.scale_rank = record_data.scale_rank
        existing_record.is_time_cap = record_data.is_time_cap
        existing_record.note = record_data.note
        db.commit()
        db.refresh(existing_record)
        return existing_record
    else:
        new_record = WodRecord(
            wod_id=record_data.wod_id,
            member_id=current_user.id,
            member_name=current_user.name,
            record_value=record_data.record_value,
            is_rx=record_data.is_rx,
            scale_rank=record_data.scale_rank,
            is_time_cap=record_data.is_time_cap,
            note=record_data.note
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record

# 6. 특정 WOD 제목으로 내 과거 기록 조회 (기록 비교용)
@router.get("/history/by-title", response_model=List[WodRecordResponse])
def get_my_wod_records_by_title(
    title: str,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 제목으로 검색 (WOD Title이 포함된 경우)
    records = db.query(WodRecord).join(Wod).filter(
        WodRecord.member_id == current_user.id,
        Wod.title.like(f"%{title}%")
    ).order_by(Wod.date.desc()).all()
    
    # wod_date 매핑 (Join된 Wod 객체에서 날짜 가져오기)
    for record in records:
        record.wod_date = record.wod.date
        
    return records

@router.get("/{wod_id}/leaderboard", response_model=List[WodRecordResponse])
def get_wod_leaderboard(
    wod_id: int,
    db: Session = Depends(get_db)
):
    return db.query(WodRecord).filter(WodRecord.wod_id == wod_id).order_by(WodRecord.record_value.desc()).all()

# ✅ [유지] 내 기록 조회 시 wod_date 매핑 (캘린더 점찍기용)
@router.get("/records/me", response_model=List[WodRecordResponse])
def get_my_wod_records(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    records = db.query(WodRecord).filter(
        WodRecord.member_id == current_user.id
    ).order_by(WodRecord.created_at.desc()).all()
    
    # ORM 관계(r.wod.date)를 이용해서 날짜 정보를 채워줌
    result = []
    for r in records:
        res = WodRecordResponse.model_validate(r)
        if r.wod:
            res.wod_date = r.wod.date
        result.append(res)
        
    return result

@router.delete("/records/{record_id}")
def delete_wod_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    record = db.query(WodRecord).filter(
        WodRecord.id == record_id,
        WodRecord.member_id == current_user.id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
        
    db.delete(record)
    db.commit()
    return {"message": "삭제되었습니다."}
