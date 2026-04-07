from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from database import get_db
from models import ClassSchedule, ClassReservation, Member, Gym, ClassTemplate, Notification
from schemas import ClassScheduleCreate, ClassScheduleResponse, ReservationResponse, MemberResponse, ClassTemplateCreate, ClassTemplateResponse
from routers.auth import get_current_user
from utils.auth import require_coach_or_subcoach

router = APIRouter(
    tags=["classes"],
    responses={404: {"description": "Not found"}},
)

# ✅ 1. 수업 일정 조회 (날짜별)
@router.get("/", response_model=List[ClassScheduleResponse])
def get_classes(
    date_str: str = Query(..., description="YYYY-MM-DD 형식"),
    gym_id: Optional[int] = None, # ✅ [수정] 기본값을 None으로 변경
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ✅ [수정] gym_id가 없으면 현재 유저의 gym_id 사용 (기본값 1)
    if gym_id is None:
        gym_id = current_user.gym_id or 1
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # 해당 날짜의 수업 스케줄 조회
    schedules = db.query(ClassSchedule).filter(
        ClassSchedule.gym_id == gym_id,
        ClassSchedule.date == target_date
    ).order_by(ClassSchedule.time).all()

    # ✅ [개선] 템플릿 기반 스케줄 생성 (항상 확인 - 누락된 템플릿만 추가)
    # 1. 요일 확인 (0:월, 1:화 ... 6:일)
    weekday = str(target_date.weekday())
    
    # 2. 해당 요일에 맞는 템플릿 조회
    templates = db.query(ClassTemplate).filter(
        ClassTemplate.gym_id == gym_id
    ).all()
    
    # 3. 기존 스케줄의 (title, time) 셋 만들기
    existing_schedule_keys = {(s.title, s.time) for s in schedules}
    
    # 4. 템플릿 기반 스케줄 생성 (누락된 것만)
    new_schedules = []
    for tmpl in templates:
        # 해당 요일에 맞는지 확인
        days = tmpl.days_of_week.split(',')
        if weekday in days:
            # 이미 같은 제목 + 시간의 스케줄이 있는지 확인
            if (tmpl.title, tmpl.time) not in existing_schedule_keys:
                new_class = ClassSchedule(
                    gym_id=gym_id,
                    title=tmpl.title,
                    date=target_date,
                    time=tmpl.time,
                    max_participants=tmpl.max_participants,
                    status="open"
                )
                db.add(new_class)
                new_schedules.append(new_class)
                # 새로 추가한 것도 기존 키셋에 추가 (중복 방지)
                existing_schedule_keys.add((tmpl.title, tmpl.time))
    
    if new_schedules:
        db.commit()
        for ns in new_schedules:
            db.refresh(ns)
        # 전체 스케줄 다시 조회 (새로 추가된 것 포함)
        schedules = db.query(ClassSchedule).filter(
            ClassSchedule.gym_id == gym_id,
            ClassSchedule.date == target_date
        ).order_by(ClassSchedule.time).all()

    results = []
    for schedule in schedules:
        # 예약자 수 카운트
        reservation_count = db.query(ClassReservation).filter(
            ClassReservation.schedule_id == schedule.id,
            ClassReservation.status == "reserved"
        ).count()

        # 현재 유저가 예약했는지 확인
        user_reservation = db.query(ClassReservation).filter(
            ClassReservation.schedule_id == schedule.id,
            ClassReservation.member_id == current_user.id,
            ClassReservation.status == "reserved"
        ).first()

        # Response 모델로 변환
        schedule_data = ClassScheduleResponse.model_validate(schedule)
        schedule_data.current_participants = reservation_count
        schedule_data.is_reserved = bool(user_reservation)
        
        results.append(schedule_data)

    return results

# ✅ 2. 수업 일정 생성 (관리자/코치 전용)
@router.post("/", response_model=ClassScheduleResponse)
def create_class(
    class_data: ClassScheduleCreate,
    current_user: Member = Depends(require_coach_or_subcoach),
    db: Session = Depends(get_db)
):
    new_class = ClassSchedule(
        gym_id=current_user.gym_id or 1,
        title=class_data.title,
        date=class_data.date,
        time=class_data.time,
        max_participants=class_data.max_participants,
        status=class_data.status
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    # Response 변환 (초기값이므로 0/False)
    response = ClassScheduleResponse.model_validate(new_class)
    response.current_participants = 0
    response.is_reserved = False
    
    return response

# ✅ 3. 수업 예약
@router.post("/{schedule_id}/reserve", response_model=ReservationResponse)
def reserve_class(
    schedule_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 수업 존재 여부 확인
    schedule = db.query(ClassSchedule).filter(ClassSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Class not found")

    # 이미 예약했는지 확인
    existing_reservation = db.query(ClassReservation).filter(
        ClassReservation.schedule_id == schedule_id,
        ClassReservation.member_id == current_user.id,
        ClassReservation.status == "reserved"
    ).first()

    if existing_reservation:
        raise HTTPException(status_code=400, detail="Already reserved")

    # 정원 초과 확인
    current_count = db.query(ClassReservation).filter(
        ClassReservation.schedule_id == schedule_id,
        ClassReservation.status == "reserved"
    ).count()

    if current_count >= schedule.max_participants:
        raise HTTPException(status_code=400, detail="Class is full")

    # 예약 생성
    new_reservation = ClassReservation(
        schedule_id=schedule_id,
        member_id=current_user.id,
        status="reserved"
    )
    db.add(new_reservation)
    db.commit()
    db.refresh(new_reservation)
    
    # 🔔 예약 확인 알림 생성
    noti = Notification(
        recipient_id=current_user.id,
        sender_id=None,
        type="reservation_confirmed",
        title="수업 예약 완료 ✅",
        message=f"{schedule.title} 수업이 예약되었습니다. ({schedule.date.strftime('%m/%d')} {schedule.time})",
        related_link="/reservation"
    )
    db.add(noti)
    db.commit()
    
    # Response에는 member_name이 필요한데, 현재 DB 객체에는 없으므로 주입
    return ReservationResponse(
        id=new_reservation.id,
        schedule_id=new_reservation.schedule_id,
        member_id=new_reservation.member_id,
        member_name=current_user.name,
        status=new_reservation.status,
        created_at=new_reservation.created_at
    )

# ✅ 4. 예약 취소
@router.delete("/{schedule_id}/reserve")
def cancel_reservation(
    schedule_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reservation = db.query(ClassReservation).filter(
        ClassReservation.schedule_id == schedule_id,
        ClassReservation.member_id == current_user.id,
        ClassReservation.status == "reserved"
    ).first()

    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    # 수업 정보 조회 (알림 메시지용)
    schedule = db.query(ClassSchedule).filter(ClassSchedule.id == schedule_id).first()
    class_title = schedule.title if schedule else "수업"
    
    db.delete(reservation) # 혹은 status='cancelled'로 업데이트
    
    # 🔔 예약 취소 알림 생성
    noti = Notification(
        recipient_id=current_user.id,
        sender_id=None,
        type="reservation_cancelled",
        title="예약 취소 완료",
        message=f"{class_title} 수업 예약이 취소되었습니다.",
        related_link="/reservation"
    )
    db.add(noti)
    db.commit()
    
    return {"message": "Reservation cancelled"}

# ✅ 5. 특정 수업의 예약자 목록 조회 (관리자용)
@router.get("/{schedule_id}/reservations", response_model=List[ReservationResponse])
def get_class_reservations(
    schedule_id: int,
    current_user: Member = Depends(require_coach_or_subcoach),
    db: Session = Depends(get_db)
):
    reservations = db.query(ClassReservation).join(Member).filter(
        ClassReservation.schedule_id == schedule_id,
        ClassReservation.status == "reserved"
    ).all()
    
    results = []
    for res in reservations:
        data = ReservationResponse(
            id=res.id,
            schedule_id=res.schedule_id,
            member_id=res.member_id,
            member_name=res.member.name if res.member else "Unknown",
            status=res.status,
            created_at=res.created_at
        )
        results.append(data)
        
    return results

# ✅ 6. 나의 예약 목록 조회
@router.get("/my", response_model=List[ClassScheduleResponse])
def get_my_reservations(
    include_past: bool = Query(False, description="과거 예약 포함 여부"),
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()

    query = db.query(ClassReservation).join(ClassSchedule).filter(
        ClassReservation.member_id == current_user.id,
        ClassReservation.status == "reserved"
    )

    if not include_past:
        query = query.filter(ClassSchedule.date >= today)

    reservations = query.order_by(ClassSchedule.date.desc() if include_past else ClassSchedule.date, ClassSchedule.time).all()
    
    results = []
    for res in reservations:
        schedule = res.schedule
        
        # 예약자 수 카운트 (비효율적일 수 있지만 일단 간단 구현)
        reservation_count = db.query(ClassReservation).filter(
            ClassReservation.schedule_id == schedule.id,
            ClassReservation.status == "reserved"
        ).count()
        
        schedule_data = ClassScheduleResponse.model_validate(schedule)
        schedule_data.current_participants = reservation_count
        schedule_data.is_reserved = True
        
        results.append(schedule_data)
        
    return results


# ==========================================
# 7. 🔄 고정 스케줄 (템플릿) 관리
# ==========================================

@router.post("/templates", response_model=ClassTemplateResponse)
def create_template(
    template_data: ClassTemplateCreate,
    current_user: Member = Depends(require_coach_or_subcoach),
    db: Session = Depends(get_db)
):
    new_template = ClassTemplate(
        gym_id=current_user.gym_id or 1,
        title=template_data.title,
        time=template_data.time,
        max_participants=template_data.max_participants,
        days_of_week=template_data.days_of_week
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return new_template

@router.get("/templates", response_model=List[ClassTemplateResponse])
def get_templates(
    gym_id: Optional[int] = None, # ✅ [수정] 기본값을 None으로 변경
    current_user: Member = Depends(require_coach_or_subcoach),
    db: Session = Depends(get_db)
):
    # ✅ [수정] gym_id가 없으면 현재 유저의 gym_id 사용 (기본값 1)
    if gym_id is None:
        gym_id = current_user.gym_id or 1

    return db.query(ClassTemplate).filter(ClassTemplate.gym_id == gym_id).all()

@router.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    current_user: Member = Depends(require_coach_or_subcoach),
    db: Session = Depends(get_db)
):
    template = db.query(ClassTemplate).filter(ClassTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    db.delete(template)
    db.commit()
    
    return {"message": "Template deleted"}
