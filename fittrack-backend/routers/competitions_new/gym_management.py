"""
Gym management endpoints: POST /{comp_id}/gyms, GET /{comp_id}/gyms, DELETE /{comp_id}/gyms/{gym_id}
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from security import get_current_user
from models import Competition, CompetitionGym, Member
from schemas import CompetitionGymResponse

router = APIRouter()


# Request schema
class GymInviteRequest(BaseModel):
    gym_id: int


# 10. Add gym to competition
@router.post("/{comp_id}/gyms", response_model=CompetitionGymResponse)
def add_gym_to_competition(
    comp_id: int,
    request: GymInviteRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Invite a gym to participate in a competition. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Check if gym already invited
    existing = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == comp_id,
        CompetitionGym.gym_id == request.gym_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 초대되거나 참여 중인 박스입니다.")

    new_gym_relation = CompetitionGym(
        competition_id=comp_id,
        gym_id=request.gym_id,
        status="accepted"  # Simplified: directly accepted
    )

    db.add(new_gym_relation)
    db.commit()
    db.refresh(new_gym_relation)
    return new_gym_relation


# 11. Get participating gyms
@router.get("/{comp_id}/gyms")
def get_participating_gyms(
    comp_id: int,
    db: Session = Depends(get_db)
):
    """Get list of gyms participating in a competition."""
    relations = db.query(CompetitionGym).filter(CompetitionGym.competition_id == comp_id).all()

    result = []
    for rel in relations:
        result.append({
            "gym_id": rel.gym_id,
            "gym_name": rel.gym.name if rel.gym else "Unknown",
            "status": rel.status
        })
    return result


# 12. Remove gym from competition
@router.delete("/{comp_id}/gyms/{gym_id}")
def remove_gym_from_competition(
    comp_id: int,
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Remove a gym from competition. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    relation = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == comp_id,
        CompetitionGym.gym_id == gym_id
    ).first()

    if not relation:
        raise HTTPException(status_code=404, detail="해당 박스는 이 대회에 등록되지 않았습니다.")

    db.delete(relation)
    db.commit()
    return {"message": "박스가 대회 참가 목록에서 삭제되었습니다."}
