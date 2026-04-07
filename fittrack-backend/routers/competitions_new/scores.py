"""
Score management endpoints: POST /events/{event_id}/scores, PATCH /scores/{score_id}/status,
DELETE /scores/{score_id}, GET /{comp_id}/my-gym-members,
POST /events/{event_id}/coach-submit, POST /events/{event_id}/bulk-submit
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
from security import get_current_user
from models import (
    Competition, CompetitionEvent, CompetitionGym, CompetitionRegistration,
    CompetitionScore, Member, Gym
)
from schemas import CompScoreCreate

from .helpers import mask_phone_number

router = APIRouter()


# Request schemas
class CoachSubmitRequest(BaseModel):
    member_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_gender: Optional[str] = None
    score_value: str
    is_rx: bool
    scale_rank: Optional[str] = None
    is_time_cap: Optional[bool] = False
    tie_break: Optional[str] = None
    note: Optional[str] = None


# 5. Submit score
@router.post("/events/{event_id}/scores")
def submit_score(
    event_id: int,
    score_data: CompScoreCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Submit a score for an event. User's gym must be invited."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == event.competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()

    # Allow score submission if registered or gym is invited
    if not reg:
        if current_user.gym_id:
            gym_link = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == event.competition_id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()
            if not gym_link:
                raise HTTPException(status_code=403, detail="이 대회에 참가 자격이 없습니다.")

            # Auto-create registration
            reg = CompetitionRegistration(
                competition_id=event.competition_id,
                member_id=current_user.id,
                member_name=current_user.name,
                status="approved"
            )
            db.add(reg)
            db.commit()
            db.refresh(reg)
        else:
            raise HTTPException(status_code=403, detail="소속 체육관이 없습니다. 관리자에게 문의하세요.")
    elif reg.status != "approved":
        raise HTTPException(status_code=403, detail="관리자의 참가 승인 대기 중입니다.")

    # Check for existing score
    existing_score = db.query(CompetitionScore).filter(
        CompetitionScore.event_id == event_id,
        CompetitionScore.member_id == current_user.id
    ).first()

    if existing_score:
        existing_score.score_value = score_data.score_value
        existing_score.is_rx = score_data.is_rx
        existing_score.scale_rank = score_data.scale_rank
        existing_score.is_time_cap = score_data.is_time_cap
        existing_score.tie_break = score_data.tie_break
        existing_score.note = score_data.note
        existing_score.status = "approved"
        db.commit()
        return {"message": "Score updated"}
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=current_user.id,
            member_name=current_user.name,
            score_value=score_data.score_value,
            is_rx=score_data.is_rx,
            scale_rank=score_data.scale_rank,
            is_time_cap=score_data.is_time_cap,
            tie_break=score_data.tie_break,
            note=score_data.note,
            status="approved"
        )
        db.add(new_score)
        db.commit()
        return {"message": "Score submitted"}


# 14. Get gym members records
@router.get("/{comp_id}/my-gym-members")
def get_my_gym_members_records(
    comp_id: int,
    event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Get all members and their records for a coach's gym."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin'] or not current_user.gym_id:
        raise HTTPException(
            status_code=403,
            detail="소속 체육관이 있는 관리자/코치만 접근 가능합니다."
        )

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="대회를 찾을 수 없습니다.")

    # Get coach's gym name
    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None

    # Get all events for this competition
    event_ids = [e.id for e in db.query(CompetitionEvent).filter(
        CompetitionEvent.competition_id == comp_id
    ).all()]

    # Build participant map
    participant_map = {}

    # Add all gym members
    all_gym_members = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role != 'superadmin'
    ).all()

    for m in all_gym_members:
        participant_map[f"member:{m.id}"] = {
            "member_id": m.id,
            "member_name": m.name,
            "is_guest": False,
            "profile_image": None,
            "score": None
        }

    # Get all scores
    if event_ids:
        all_scores = db.query(CompetitionScore).filter(
            CompetitionScore.event_id.in_(event_ids)
        ).all()

        for s in all_scores:
            if s.member_id:
                # Regular member
                if s.member and s.member.gym_id == current_user.gym_id:
                    key = f"member:{s.member_id}"
                    if key not in participant_map:
                        participant_map[key] = {
                            "member_id": s.member_id,
                            "member_name": s.member_name,
                            "is_guest": False,
                            "score": None
                        }
            else:
                # Guest
                if my_gym_name and s.guest_gym == my_gym_name:
                    phone = s.guest_phone or ''
                    key = f"guest:{s.member_name}:{phone}"
                    if key not in participant_map:
                        participant_map[key] = {
                            "member_id": None,
                            "member_name": s.member_name,
                            "guest_phone": phone,
                            "is_guest": True,
                            "score": None
                        }

    # Get specific event scores
    if event_id:
        for key, data in participant_map.items():
            if data["member_id"]:
                score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == data["member_id"]
                ).first()
            else:
                score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id.is_(None),
                    CompetitionScore.member_name == data["member_name"],
                    CompetitionScore.guest_phone == data.get("guest_phone", "")
                ).first()

            if score:
                data["score"] = {
                    "id": score.id,
                    "score_value": score.score_value,
                    "is_rx": score.is_rx,
                    "scale_rank": score.scale_rank,
                    "is_time_cap": score.is_time_cap,
                    "status": score.status or 'approved'
                }

    return list(participant_map.values())


# 15. Update score status
@router.patch("/scores/{score_id}/status")
def update_score_status(
    score_id: int,
    status: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Update score status (approve/reject). Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="관리자/코치만 접근 가능합니다.")

    score = db.query(CompetitionScore).filter(CompetitionScore.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")

    score.status = status
    db.commit()
    return {"message": f"기록이 {status} 상태로 변경되었습니다."}


# 16-1. Delete score
@router.delete("/scores/{score_id}")
def delete_score(
    score_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Delete a score. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="관리자/코치만 접근 가능합니다.")

    score = db.query(CompetitionScore).filter(CompetitionScore.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")

    db.delete(score)
    db.commit()
    return {"message": "기록이 삭제되었습니다."}


# 17. Coach submit score (single)
@router.post("/events/{event_id}/coach-submit")
def coach_submit_score(
    event_id: int,
    req: CoachSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Coach can submit scores for members or guests."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="관리자/코치만 접근 가능합니다.")

    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None

    # Handle member score
    if req.member_id:
        target_member = db.query(Member).filter(Member.id == req.member_id).first()
        if not target_member:
            raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

        # Security: check if from same gym
        if current_user.role != 'superadmin' and target_member.gym_id != current_user.gym_id:
            raise HTTPException(
                status_code=403,
                detail="본인 박스 소속 회원만 기록을 대리 등록할 수 있습니다."
            )

        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_id == req.member_id
        ).first()

        name_to_save = target_member.name
        guest_phone_to_save = None
        guest_gender_to_save = None
    else:
        # Handle guest score
        if not req.guest_name:
            raise HTTPException(status_code=400, detail="게스트 이름이 필요합니다.")

        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_id == None,
            CompetitionScore.member_name == req.guest_name,
            CompetitionScore.guest_phone == (req.guest_phone or "")
        ).first()

        name_to_save = req.guest_name
        guest_phone_to_save = req.guest_phone or ""
        guest_gender_to_save = req.guest_gender

    if existing_score:
        existing_score.score_value = req.score_value
        existing_score.is_rx = req.is_rx
        existing_score.scale_rank = req.scale_rank
        existing_score.is_time_cap = req.is_time_cap
        existing_score.tie_break = req.tie_break
        existing_score.note = req.note
        existing_score.status = "approved"
        if req.guest_name and not req.member_id:
            existing_score.member_name = req.guest_name
        db.commit()
        return {"message": "기록이 대리 수정 및 승인되었습니다."}
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=req.member_id,
            member_name=name_to_save,
            score_value=req.score_value,
            is_rx=req.is_rx,
            scale_rank=req.scale_rank,
            is_time_cap=req.is_time_cap,
            tie_break=req.tie_break,
            note=req.note,
            guest_phone=guest_phone_to_save,
            guest_gender=guest_gender_to_save,
            guest_gym=my_gym_name if not req.member_id else None,
            status="approved"
        )
        db.add(new_score)
        db.commit()
        return {"message": "기록이 대리 등록 및 승인되었습니다."}


# 17. Coach bulk submit scores
@router.post("/events/{event_id}/bulk-submit")
def coach_bulk_submit_scores(
    event_id: int,
    req_list: List[CoachSubmitRequest],
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Coach can bulk submit scores for multiple members/guests."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="관리자/코치만 접근 가능합니다.")

    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None

    duplicates_found = []
    processed_count = 0

    for idx, req in enumerate(req_list):
        if req.member_id:
            target_member = db.query(Member).filter(Member.id == req.member_id).first()
            if not target_member:
                continue

            # Security check
            if current_user.role != 'superadmin' and target_member.gym_id != current_user.gym_id:
                continue

            existing_score = db.query(CompetitionScore).filter(
                CompetitionScore.event_id == event_id,
                CompetitionScore.member_id == req.member_id
            ).first()

            name_to_save = target_member.name
            guest_phone_to_save = None
            guest_gender_to_save = None
        else:
            if not req.guest_name:
                continue

            # Detect duplicates
            if req.guest_phone:
                existing_score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == None,
                    CompetitionScore.guest_phone == req.guest_phone,
                    CompetitionScore.member_name == req.guest_name
                ).first()
            else:
                same_name_scores = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == None,
                    CompetitionScore.member_name == req.guest_name
                ).all()

                if len(same_name_scores) > 0:
                    duplicates_found.append({
                        "row_index": idx,
                        "guest_name": req.guest_name,
                        "duplicates": [
                            {
                                "masked_phone": mask_phone_number(s.guest_phone),
                                "name": s.member_name
                            }
                            for s in same_name_scores
                        ]
                    })
                    continue

                existing_score = same_name_scores[0] if same_name_scores else None

            name_to_save = req.guest_name
            guest_phone_to_save = req.guest_phone or ""
            guest_gender_to_save = req.guest_gender

        if existing_score:
            existing_score.score_value = req.score_value
            existing_score.is_rx = req.is_rx
            existing_score.scale_rank = req.scale_rank
            existing_score.is_time_cap = req.is_time_cap
            existing_score.tie_break = req.tie_break
            existing_score.note = req.note
            existing_score.status = "approved"
        else:
            new_score = CompetitionScore(
                event_id=event_id,
                member_id=req.member_id,
                member_name=name_to_save,
                score_value=req.score_value,
                is_rx=req.is_rx,
                scale_rank=req.scale_rank,
                is_time_cap=req.is_time_cap,
                tie_break=req.tie_break,
                note=req.note,
                guest_phone=guest_phone_to_save,
                guest_gender=guest_gender_to_save,
                guest_gym=my_gym_name if not req.member_id else None,
                status="approved"
            )
            db.add(new_score)

        processed_count += 1

    db.commit()

    if duplicates_found:
        return {
            "status": "duplicates_found",
            "message": f"총 {processed_count}건의 기록이 등록되었습니다. {len(duplicates_found)}건의 동명이인이 발견되었습니다.",
            "processed_count": processed_count,
            "duplicates": duplicates_found,
            "action_required": True
        }

    return {
        "status": "success",
        "message": f"총 {processed_count}건의 기록이 성공적으로 등록되었습니다.",
        "processed_count": processed_count,
        "action_required": False
    }
