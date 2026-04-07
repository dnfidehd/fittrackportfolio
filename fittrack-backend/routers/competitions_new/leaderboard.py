"""
Leaderboard endpoints: GET /events/{event_id}/leaderboard, GET /{comp_id}/overall
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from database import get_db
from security import get_current_user_optional
from models import Competition, CompetitionEvent, CompetitionGym, CompetitionScore, Member
from schemas import CompLeaderboardItem, OverallLeaderboardItem

from .helpers import anonymize_name, parse_score

router = APIRouter()


# 6. Get event leaderboard
@router.get("/events/{event_id}/leaderboard", response_model=List[CompLeaderboardItem])
def get_event_leaderboard(
    event_id: int,
    is_guest_viewer: bool = False,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """Get leaderboard for a specific event."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    comp = event.competition

    # Check if user's gym participates
    is_participating_gym = False
    if current_user and current_user.gym_id:
        participating = db.query(CompetitionGym).filter(
            CompetitionGym.competition_id == comp.id,
            CompetitionGym.gym_id == current_user.gym_id
        ).first()
        if participating:
            is_participating_gym = True

    # Access control: check if leaderboard is public or user participates
    if not comp.show_leaderboard_to_all and not is_participating_gym:
        if not current_user or current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="이 대회의 리더보드는 참가 박스 회원에게만 공개됩니다."
            )

    # Get scores, excluding superadmin
    scores = db.query(CompetitionScore).join(
        Member, CompetitionScore.member_id == Member.id, isouter=True
    ).filter(
        CompetitionScore.event_id == event_id,
        or_(Member.role != 'superadmin', CompetitionScore.member_id == None)
    ).all()

    is_time = (event.score_type == 'time')

    def sort_key(s):
        rx = 1 if s.is_rx else 0
        scale_weights = {'A': 3, 'B': 2, 'C': 1}
        scale_weight = scale_weights.get(s.scale_rank, 0) if not s.is_rx else 0

        val = parse_score(s.score_value, event.score_type)
        tb_val = parse_score(s.tie_break, 'time') if s.tie_break else 999999

        if is_time:
            return (-rx, -scale_weight, val, tb_val)
        else:
            return (-rx, -scale_weight, -val, tb_val)

    sorted_scores = sorted(scores, key=sort_key)

    result = []
    for idx, s in enumerate(sorted_scores):
        member_name_display = s.member_name

        # Anonymize if needed
        if comp.anonymize_for_all and not is_participating_gym and not is_guest_viewer:
            if not current_user or s.member_id != current_user.id:
                member_name_display = anonymize_name(s.member_name)

        # Get gender
        gender = None
        if s.member_id:
            gender = s.member.gender if s.member else None
        else:
            gender = s.guest_gender

        # Get gym name
        gym_name = None
        if s.member_id:
            gym_name = s.member.gym.name if s.member and s.member.gym else None
        else:
            gym_name = s.guest_gym

        # Calculate rank (Standard Competition Ranking: 1-2-2-4)
        if idx == 0:
            rank = 1
        else:
            prev = sorted_scores[idx - 1]
            prev_key = sort_key(prev)
            curr_key = sort_key(s)
            if curr_key == prev_key:
                rank = result[-1].rank
            else:
                rank = idx + 1

        result.append(CompLeaderboardItem(
            rank=rank,
            member_name=member_name_display,
            score_value=s.score_value,
            is_rx=s.is_rx,
            scale_rank=s.scale_rank,
            is_time_cap=s.is_time_cap if s.is_time_cap is not None else False,
            tie_break=s.tie_break,
            note=s.note,
            gender=gender,
            gym_name=gym_name,
            status=s.status or 'approved',
            guest_phone=s.guest_phone
        ))
    return result


# 7. Get overall leaderboard
@router.get("/{comp_id}/overall", response_model=List[OverallLeaderboardItem])
def get_overall_leaderboard(
    comp_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """Get overall leaderboard for a competition."""
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Check if user's gym participates
    is_participating_gym = False
    if current_user and current_user.gym_id:
        participating = db.query(CompetitionGym).filter(
            CompetitionGym.competition_id == comp.id,
            CompetitionGym.gym_id == current_user.gym_id
        ).first()
        if participating:
            is_participating_gym = True

    # Access control
    if not comp.show_leaderboard_to_all and not is_participating_gym:
        if not current_user or current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="이 대회의 리더보드는 참가 박스 회원에게만 공개됩니다."
            )

    # Get all events
    events = db.query(CompetitionEvent).filter(
        CompetitionEvent.competition_id == comp_id
    ).all()
    event_ids = [e.id for e in events]

    # Get all scores
    all_scores = db.query(CompetitionScore).join(
        Member, CompetitionScore.member_id == Member.id, isouter=True
    ).filter(
        CompetitionScore.event_id.in_(event_ids),
        or_(Member.role != 'superadmin', CompetitionScore.member_id == None)
    ).all()

    leaderboard_map = {}

    # Process each event
    for event in events:
        scores = [s for s in all_scores if s.event_id == event.id]
        is_time = event.score_type == 'time'

        def sort_key(s):
            rx = 1 if s.is_rx else 0
            scale_weights = {'A': 3, 'B': 2, 'C': 1}
            scale_weight = scale_weights.get(s.scale_rank, 0) if not s.is_rx else 0

            val = parse_score(s.score_value, event.score_type)
            tb_val = parse_score(s.tie_break, 'time') if s.tie_break else 999999

            if is_time:
                return (-rx, -scale_weight, val, tb_val)
            else:
                return (-rx, -scale_weight, -val, tb_val)

        sorted_scores = sorted(scores, key=sort_key)

        # Calculate points (Standard Competition Ranking)
        point_rank = 1
        for idx, s in enumerate(sorted_scores):
            if idx == 0:
                point_rank = 1
            else:
                prev_s = sorted_scores[idx - 1]
                if sort_key(s) == sort_key(prev_s):
                    pass  # Same rank
                else:
                    point_rank = idx + 1

            # Create user key
            user_key = f"member_{s.member_id}" if s.member_id else f"guest_{s.member_name}_{s.guest_phone or ''}"

            if user_key not in leaderboard_map:
                leaderboard_map[user_key] = {
                    "member_id": s.member_id,
                    "member_name": s.member_name,
                    "guest_phone": s.guest_phone,
                    "total_points": 0,
                    "event_details": {},
                    "gender": s.member.gender if s.member_id and s.member else s.guest_gender,
                    "gym_name": s.member.gym.name if s.member_id and s.member and s.member.gym else s.guest_gym
                }

            leaderboard_map[user_key]["total_points"] += point_rank
            leaderboard_map[user_key]["event_details"][event.title] = point_rank

    # Apply penalty for missing events
    total_participants = len(leaderboard_map)
    penalty_point = total_participants + 1

    overall_list = []
    for u_key, data in leaderboard_map.items():
        participated_events = len(data["event_details"])
        missing_events_count = len(events) - participated_events

        if missing_events_count > 0:
            data["total_points"] += penalty_point * missing_events_count

        overall_list.append(
            OverallLeaderboardItem(
                rank=0,
                member_id=data["member_id"],
                member_name=data["member_name"],
                total_points=data["total_points"],
                event_details=data["event_details"],
                gender=data.get("gender"),
                gym_name=data.get("gym_name"),
                guest_phone=data.get("guest_phone")
            )
        )

    overall_list.sort(key=lambda x: x.total_points)

    # Calculate final ranks (Standard Competition Ranking)
    for i, item in enumerate(overall_list):
        if i == 0:
            item.rank = 1
        else:
            prev = overall_list[i - 1]
            if item.total_points == prev.total_points:
                item.rank = prev.rank
            else:
                item.rank = i + 1

        # Apply anonymization
        if comp.anonymize_for_all and not is_participating_gym:
            if not current_user or item.member_id != current_user.id:
                item.member_name = anonymize_name(item.member_name)

    return overall_list
