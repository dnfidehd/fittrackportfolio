"""
Guest access endpoints: GET /guest/available, POST /guest/verify,
GET /guest/competition-gyms, GET /guest/profile, POST /guest/scores
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Competition, CompetitionEvent, CompetitionGym, CompetitionScore
from schemas import CompScoreCreate, CompEventResponse

from .helpers import enrich_with_admins, mask_phone_number

router = APIRouter()


# Request schema
class GuestVerifyRequest(BaseModel):
    competition_id: int
    passcode: str


# 13-0. Get available competitions for guests
@router.get("/guest/available")
def get_available_competitions_for_guest(db: Session = Depends(get_db)):
    """Get list of active competitions available for guest access."""
    comps = db.query(Competition).filter(Competition.is_active == True).all()

    return [
        {
            "id": c.id,
            "title": c.title,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "is_hidden": c.is_hidden,
            "sort_order": c.sort_order
        } for c in comps
    ]


# 13-1. Verify guest passcode
@router.post("/guest/verify")
def verify_guest_passcode(
    request: GuestVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify guest passcode and get competition details."""
    comp = db.query(Competition).filter(
        Competition.id == request.competition_id,
        Competition.guest_passcode == request.passcode,
        Competition.is_active == True
    ).first()

    if not comp:
        raise HTTPException(status_code=401, detail="올바르지 않은 패스코드입니다.")

    events = db.query(CompetitionEvent).filter(
        CompetitionEvent.competition_id == comp.id
    ).all()

    return {
        "competition": enrich_with_admins(comp, db),
        "events": [CompEventResponse.model_validate(e) for e in events]
    }


# 13-1-1. Get competition gyms for guest (for profile selection)
@router.get("/guest/competition-gyms")
def get_competition_gyms_for_guest(
    competition_id: int,
    db: Session = Depends(get_db)
):
    """Get list of gyms participating in a competition (for guest profile selection)."""
    gym_links = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == competition_id
    ).all()

    result = []
    for link in gym_links:
        if link.gym:
            result.append({"id": link.gym.id, "name": link.gym.name})

    result.sort(key=lambda x: x["name"])
    return result


# 13-1-2. Get guest profile
@router.get("/guest/profile")
def get_guest_profile(
    phone: str,
    db: Session = Depends(get_db)
):
    """Get guest profile based on phone number."""
    last_score = db.query(CompetitionScore).filter(
        CompetitionScore.guest_phone == phone,
        CompetitionScore.member_id == None
    ).order_by(CompetitionScore.id.desc()).first()

    if not last_score:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")

    return {
        "name": last_score.member_name,
        "phone": last_score.guest_phone,
        "gender": last_score.guest_gender,
        "gym_name": last_score.guest_gym
    }


# 13-2. Submit guest score
@router.post("/guest/scores")
def submit_guest_score(
    event_id: int,
    score_data: CompScoreCreate,
    db: Session = Depends(get_db)
):
    """Submit score for a guest user."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not score_data.member_name:
        raise HTTPException(status_code=400, detail="성함을 입력해주세요.")

    # Check for duplicate names
    existing_score = None

    if score_data.guest_phone:
        # Exact match: phone + name
        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.guest_phone == score_data.guest_phone,
            CompetitionScore.member_name == score_data.member_name,
            CompetitionScore.member_id == None
        ).first()
    else:
        # Search by name only
        same_name_scores = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_name == score_data.member_name,
            CompetitionScore.member_id == None
        ).all()

        # Duplicate names found - request confirmation
        if len(same_name_scores) > 0:
            return {
                "status": "duplicate_found",
                "message": "동명이인이 존재합니다. 확인이 필요합니다.",
                "duplicates": [
                    {
                        "masked_phone": mask_phone_number(s.guest_phone),
                        "name": s.member_name,
                        "score_id": s.id
                    }
                    for s in same_name_scores
                ],
                "action_required": True
            }

        existing_score = same_name_scores[0] if same_name_scores else None

    if existing_score:
        existing_score.score_value = score_data.score_value
        existing_score.is_rx = score_data.is_rx
        existing_score.scale_rank = score_data.scale_rank
        existing_score.is_time_cap = score_data.is_time_cap
        existing_score.tie_break = score_data.tie_break
        existing_score.note = score_data.note

        # Update guest info
        if score_data.guest_gender:
            existing_score.guest_gender = score_data.guest_gender
        if score_data.guest_phone:
            existing_score.guest_phone = score_data.guest_phone
        existing_score.guest_gym = score_data.guest_gym
        existing_score.status = "pending"

        db.commit()
        return {
            "status": "success",
            "message": f"{score_data.member_name}님의 기록이 업데이트되었습니다.",
            "action_required": False
        }
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=None,
            member_name=score_data.member_name,
            score_value=score_data.score_value,
            is_rx=score_data.is_rx,
            scale_rank=score_data.scale_rank,
            is_time_cap=score_data.is_time_cap,
            tie_break=score_data.tie_break,
            note=score_data.note,
            guest_gender=score_data.guest_gender,
            guest_phone=score_data.guest_phone,
            guest_gym=score_data.guest_gym,
            status="approved"
        )
        db.add(new_score)
        db.commit()
        return {
            "status": "success",
            "message": f"{score_data.member_name}님의 기록이 등록되었습니다.",
            "action_required": False
        }
