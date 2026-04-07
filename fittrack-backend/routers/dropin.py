from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta

from database import get_db
import models, schemas
from security import get_current_user, require_permission
from constants import Role
from utils.auth import assert_roles

router = APIRouter(
    prefix="/api/dropin",
    tags=["DropIn"],
    responses={404: {"description": "Not found"}},
)

DROPIN_PENDING_BADGE_ROLES = [Role.SUBCOACH, Role.COACH, Role.SUPERADMIN]


def enrich_dropin_response(
    reservation: models.DropInReservation,
    db: Session
) -> schemas.DropInResponse:
    res_dto = schemas.DropInResponse.model_validate(reservation)
    res_dto.gym_name = reservation.gym.name if reservation.gym else "Unknown Gym"
    res_dto.member_name = reservation.member.name if reservation.member else "Unknown Member"
    res_dto.member_phone = reservation.member.phone if reservation.member else None

    first_paid_sale = db.query(models.Sale).filter(
        models.Sale.gym_id == reservation.gym_id,
        models.Sale.member_id == reservation.member_id,
        models.Sale.status == "paid",
        models.Sale.payment_date >= datetime.combine(reservation.date, datetime.min.time())
    ).order_by(models.Sale.payment_date.asc()).first()

    if first_paid_sale:
        res_dto.first_paid_sale_date = first_paid_sale.payment_date
        conversion_days = (first_paid_sale.payment_date.date() - reservation.date).days
        res_dto.converted_within_7_days = conversion_days <= 7
        res_dto.converted_within_30_days = conversion_days <= 30
        res_dto.conversion_status = "converted_7d" if conversion_days <= 7 else "converted_30d" if conversion_days <= 30 else "converted_late"
    else:
        res_dto.conversion_status = "not_converted"

    return res_dto

# 1. 체육관 목록 조회 (지역 필터 지원)
@router.get("/gyms", response_model=List[schemas.GymResponse])
def get_gyms(
    region: Optional[str] = None, 
    query: Optional[str] = None,
    db: Session = Depends(get_db)
):
    gym_q = db.query(models.Gym).filter(models.Gym.drop_in_enabled == True)
    
    if region and region != "전체":
        gym_q = gym_q.filter(models.Gym.location.contains(region))
        
    if query:
        gym_q = gym_q.filter(models.Gym.name.contains(query))

    gyms = gym_q.all()
    return gyms

# 2. 체육관 상세 조회
@router.get("/gyms/{gym_id}", response_model=schemas.GymResponse)
def get_gym_detail(gym_id: int, db: Session = Depends(get_db)):
    gym = db.query(models.Gym).filter(models.Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
    return gym

# 3. 드랍인 예약 신청
@router.post("/reservations", response_model=schemas.DropInResponse)
def create_dropin_reservation(
    request: schemas.DropInCreate,
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(get_current_user)
):
    # 체육관 존재 여부 확인
    gym = db.query(models.Gym).filter(models.Gym.id == request.gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    # 중복 예약 확인 (같은 날짜)
    existing = db.query(models.DropInReservation).filter(
        models.DropInReservation.member_id == current_user.id,
        models.DropInReservation.gym_id == request.gym_id,
        models.DropInReservation.date == request.date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="이미 해당 날짜에 예약이 존재합니다.")

    new_reservation = models.DropInReservation(
        gym_id=request.gym_id,
        member_id=current_user.id,
        date=request.date,
        status="pending"
    )
    
    db.add(new_reservation)
    db.commit()
    db.refresh(new_reservation)
    
    # 응답 스키마 매핑
    return enrich_dropin_response(new_reservation, db)

# 4. 내 예약 목록 조회
@router.get("/my-reservations", response_model=List[schemas.DropInResponse])
def get_my_reservations(
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(get_current_user)
):
    reservations = db.query(models.DropInReservation)\
        .filter(models.DropInReservation.member_id == current_user.id)\
        .order_by(models.DropInReservation.date.desc())\
        .all()
        
    # Gym 이름 매핑해서 반환
    results = []
    for r in reservations:
        results.append(enrich_dropin_response(r, db))
        
    return results
    return results

# 5. 관리자용 예약 목록 조회 (내 체육관 예약)
@router.get("/manage", response_model=List[schemas.DropInResponse])
def get_gym_reservations(
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(require_permission("dropin"))
):
    # 관리자의 체육관 ID 확인
    gym_id = current_user.gym_id
    if not gym_id:
        raise HTTPException(status_code=400, detail="관리자의 체육관 정보가 없습니다.")

    # 해당 체육관의 예약 조회
    reservations = db.query(models.DropInReservation)\
        .filter(models.DropInReservation.gym_id == gym_id)\
        .order_by(models.DropInReservation.date.desc())\
        .all()

    results = []
    for r in reservations:
        results.append(enrich_dropin_response(r, db))
        
    return results

# 6. 예약 상태 변경 (승인/거절)
@router.put("/{reservation_id}/status", response_model=schemas.DropInResponse)
def update_reservation_status(
    reservation_id: int,
    status_update: schemas.DropInStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(require_permission("dropin"))
):
    reservation = db.query(models.DropInReservation).filter(models.DropInReservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    # 내 체육관 예약인지 확인 (슈퍼어드민은 통과 가능하게 할 수도 있음)
    if reservation.gym_id != current_user.gym_id and current_user.role != Role.SUPERADMIN:
         raise HTTPException(status_code=403, detail="본인 체육관의 예약만 관리할 수 있습니다.")

    # 상태 업데이트
    if status_update.status not in ["pending", "confirmed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    reservation.status = status_update.status
    db.commit()
    db.refresh(reservation)
    
    return enrich_dropin_response(reservation, db)

# 7. 대기 중인 예약 건수 조회 (배지용)
@router.get("/pending-count")
def get_pending_count(
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(get_current_user)
):
    # 관리자 권한 확인
    try:
        assert_roles(current_user, DROPIN_PENDING_BADGE_ROLES)
    except HTTPException:
        # 일반 유저는 0 반환 (혹은 에러 처리, 여기선 0이 안전)
        return {"count": 0}
        
    gym_id = current_user.gym_id
    if not gym_id:
         return {"count": 0}

    count = db.query(models.DropInReservation).filter(
        models.DropInReservation.gym_id == gym_id,
        models.DropInReservation.status == "pending"
    ).count()
    
    return {"count": count}


@router.get("/conversion-stats")
def get_dropin_conversion_stats(
    db: Session = Depends(get_db),
    current_user: models.Member = Depends(require_permission("dropin"))
):
    gym_id = current_user.gym_id
    if not gym_id:
        raise HTTPException(status_code=400, detail="관리자의 체육관 정보가 없습니다.")

    reservations = db.query(models.DropInReservation).filter(
        models.DropInReservation.gym_id == gym_id
    ).order_by(models.DropInReservation.date.desc()).all()

    confirmed_reservations = [reservation for reservation in reservations if reservation.status == "confirmed"]
    converted_rows = [enrich_dropin_response(reservation, db) for reservation in confirmed_reservations]

    converted_7d = sum(1 for row in converted_rows if row.converted_within_7_days)
    converted_30d = sum(1 for row in converted_rows if row.converted_within_30_days)
    today = date.today()
    pending_recent = sum(
        1 for row in converted_rows
        if row.conversion_status == "not_converted" and (today - row.date).days <= 7
    )

    return {
        "total_reservations": len(reservations),
        "confirmed_reservations": len(confirmed_reservations),
        "converted_7d_count": converted_7d,
        "converted_30d_count": converted_30d,
        "conversion_rate_7d": round((converted_7d / len(confirmed_reservations)) * 100, 1) if confirmed_reservations else 0,
        "conversion_rate_30d": round((converted_30d / len(confirmed_reservations)) * 100, 1) if confirmed_reservations else 0,
        "pending_recent_followup_count": pending_recent,
    }
