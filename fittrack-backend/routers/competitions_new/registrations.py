"""
Registration endpoints: POST /{competition_id}/register, GET /{competition_id}/my-status,
GET /{competition_id}/registrations, PUT /{competition_id}/registrations/{member_id}
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from security import get_current_user
from models import Competition, CompetitionGym, CompetitionRegistration, Member, Notification

router = APIRouter()


# Request schema
class RegistrationStatusUpdate(BaseModel):
    status: str


# 4-1. Register for competition
@router.post("/{competition_id}/register")
def register_competition(
    competition_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register for a competition. Only invited gym members can register."""
    existing = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()

    if existing:
        return {"message": "이미 참가 신청된 대회입니다."}

    # Check if user's gym is invited
    is_invited = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == competition_id,
        CompetitionGym.gym_id == current_user.gym_id,
        CompetitionGym.status == 'accepted'
    ).first()

    if not is_invited:
        raise HTTPException(
            status_code=403,
            detail="본인의 박스가 초대된 대회만 참가 신청이 가능합니다."
        )

    new_reg = CompetitionRegistration(
        competition_id=competition_id,
        member_id=current_user.id,
        member_name=current_user.name,
        status="pending"
    )
    db.add(new_reg)
    db.commit()
    return {"message": "참가 신청이 접수되었습니다. 관리자 승인 후 기록 등록이 가능합니다."}


# 4-2. Check registration status
@router.get("/{competition_id}/my-status")
def check_registration_status(
    competition_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check current user's registration status for a competition."""
    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()

    if reg:
        return {"registered": True, "status": reg.status}
    else:
        return {"registered": False, "status": None}


# 4-3. Get registrations for a competition
@router.get("/{competition_id}/registrations")
def get_competition_registrations(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Get list of registrations for a competition."""
    query = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id
    )

    # Filter by gym if not superadmin or host
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if current_user.role != 'superadmin' and comp and comp.creator_id != current_user.id:
        query = query.join(Member, CompetitionRegistration.member_id == Member.id).filter(
            Member.gym_id == current_user.gym_id
        )

    regs = query.all()
    return regs


# 4-4. Update registration status (approve/reject)
@router.put("/{competition_id}/registrations/{member_id}")
def update_registration_status(
    competition_id: int,
    member_id: int,
    status_update: RegistrationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Update registration status. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id,
        CompetitionRegistration.member_id == member_id
    ).first()

    if not reg:
        raise HTTPException(status_code=404, detail="신청 내역을 찾을 수 없습니다.")

    # Check permissions
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    is_host = comp and comp.creator_id == current_user.id

    applicant = db.query(Member).filter(Member.id == member_id).first()
    is_same_gym = applicant and applicant.gym_id == current_user.gym_id

    if not (is_host or is_same_gym or current_user.role == 'superadmin'):
        raise HTTPException(
            status_code=403,
            detail="본인 박스 회원이 아니거나 대회 주최자가 아닙니다."
        )

    reg.status = status_update.status

    # Create notification
    comp_title = comp.title if comp else "대회"

    if status_update.status == "approved":
        noti = Notification(
            recipient_id=member_id,
            sender_id=current_user.id,
            type="competition_status",
            title="대회 참가 승인",
            message=f"'{comp_title}' 참가 신청이 승인되었습니다! 🎉",
            related_link=f"/competition"
        )
        db.add(noti)
    elif status_update.status == "rejected":
        noti = Notification(
            recipient_id=member_id,
            sender_id=current_user.id,
            type="competition_status",
            title="대회 참가 거절",
            message=f"'{comp_title}' 참가 신청이 거절되었습니다.",
            related_link=f"/competition"
        )
        db.add(noti)

    db.commit()
    return {"message": f"참가 상태가 {status_update.status}로 변경되었습니다."}
