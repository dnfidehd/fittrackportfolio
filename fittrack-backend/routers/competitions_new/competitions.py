"""
Competition CRUD endpoints: POST /, GET /, GET /{id}, PUT /{id}, DELETE /{id}, GET /pending-count
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List

from database import get_db
from security import get_current_user
from models import Competition, CompetitionGym, CompetitionRegistration, Member
from schemas import CompetitionCreate, CompetitionResponse, CompetitionUpdate

from .helpers import enrich_with_admins

router = APIRouter()


# 1. Create competition
@router.post("/", response_model=CompetitionResponse)
def create_competition(
    comp: CompetitionCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Create a new competition. Only coaches and above can create."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    new_comp = Competition(
        title=comp.title,
        description=comp.description,
        start_date=comp.start_date,
        end_date=comp.end_date,
        is_active=True,
        is_private=comp.is_private,
        show_leaderboard_to_all=comp.show_leaderboard_to_all,
        show_wod_to_all=comp.show_wod_to_all,
        anonymize_for_all=comp.anonymize_for_all,
        guest_passcode=comp.guest_passcode,
        allow_invited_gym_settings=comp.allow_invited_gym_settings,
        creator_id=current_user.id
    )
    db.add(new_comp)
    db.commit()
    db.refresh(new_comp)

    # Auto-add creator's gym
    host_gym_id = current_user.gym_id
    if host_gym_id:
        host_gym = CompetitionGym(
            competition_id=new_comp.id,
            gym_id=host_gym_id,
            status="accepted"
        )
        db.add(host_gym)

    # Add invited gyms
    if comp.invited_gym_ids:
        for gid in comp.invited_gym_ids:
            if gid == host_gym_id:
                continue

            exists = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == new_comp.id,
                CompetitionGym.gym_id == gid
            ).first()

            if not exists:
                invited_gym = CompetitionGym(
                    competition_id=new_comp.id,
                    gym_id=gid,
                    status="accepted"
                )
                db.add(invited_gym)

    db.commit()
    return enrich_with_admins(new_comp, db)


# 1-1. Get pending registration counts (for badge)
@router.get("/pending-count")
def get_pending_registration_counts(
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of pending registrations for competitions current user can manage."""
    # Only coaches and above can access
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        return {"total_pending": 0, "competitions": {}}

    # Get target competition IDs
    target_comp_ids = []

    if current_user.role == 'superadmin':
        # Superadmin sees all competitions
        comps = db.query(Competition.id).all()
        target_comp_ids = [c.id for c in comps]
    else:
        # Regular admin/coach: created competitions + public competitions + participating competitions
        all_comps = db.query(Competition).all()

        for comp in all_comps:
            # A. Created competitions
            if comp.creator_id == current_user.id:
                target_comp_ids.append(comp.id)
                continue

            # B. Public competitions
            if not comp.is_private:
                target_comp_ids.append(comp.id)
                continue

            # C. Gym participates in this competition
            if current_user.gym_id:
                is_participating = db.query(CompetitionGym).filter(
                    CompetitionGym.competition_id == comp.id,
                    CompetitionGym.gym_id == current_user.gym_id
                ).first()
                if is_participating:
                    target_comp_ids.append(comp.id)

    if not target_comp_ids:
        return {"total_pending": 0, "competitions": {}}

    # Get pending registration counts
    query = db.query(
        CompetitionRegistration.competition_id,
        func.count(CompetitionRegistration.id).label("count")
    ).filter(
        CompetitionRegistration.competition_id.in_(target_comp_ids),
        CompetitionRegistration.status == 'pending'
    )

    # Filter by gym if not superadmin
    if current_user.role != 'superadmin':
        query = query.join(Member, CompetitionRegistration.member_id == Member.id)
        query = query.join(Competition, CompetitionRegistration.competition_id == Competition.id)
        query = query.filter(
            or_(
                Competition.creator_id == current_user.id,
                Member.gym_id == current_user.gym_id
            )
        )

    pending_counts = query.group_by(CompetitionRegistration.competition_id).all()

    # Format results
    comp_counts = {pc.competition_id: pc.count for pc in pending_counts}
    total_pending = sum(comp_counts.values())

    return {
        "total_pending": total_pending,
        "competitions": comp_counts
    }


# 2. Get competition list (with permission filtering)
@router.get("/", response_model=List[CompetitionResponse])
def get_competitions(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Get list of competitions visible to current user."""
    all_comps = db.query(Competition).order_by(Competition.start_date.desc()).all()

    # Superadmin/admin see all
    if current_user.role in ['superadmin', 'admin']:
        return [enrich_with_admins(c, db) for c in all_comps]

    # Filter for regular users
    visible_comps = []

    for comp in all_comps:
        # Public competitions always visible
        if not comp.is_private:
            visible_comps.append(comp)
            continue

        # Private: check if user's gym participates
        if current_user.gym_id:
            is_participating = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == comp.id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()

            if is_participating:
                visible_comps.append(comp)

    return [enrich_with_admins(c, db) for c in visible_comps]


# 3. Get competition detail
@router.get("/{id}")
def get_competition(id: int, db: Session = Depends(get_db)):
    """Get competition details with events."""
    from models import CompetitionEvent
    from schemas import CompEventResponse

    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    events = db.query(CompetitionEvent).filter(CompetitionEvent.competition_id == id).all()

    return {
        "competition": enrich_with_admins(comp, db),
        "events": [CompEventResponse.model_validate(e) for e in events]
    }


# 3-1. Update competition (admin only)
@router.put("/{id}", response_model=CompetitionResponse)
def update_competition(
    id: int,
    comp_update: CompetitionUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Update competition details. Only creator/superadmin can update."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    is_superadmin = (current_user.role == 'superadmin')

    # Check superadmin-only fields
    superadmin_fields = []
    if comp_update.sort_order is not None or comp_update.is_hidden is not None:
        if not is_superadmin:
            raise HTTPException(
                status_code=403,
                detail="대회 노출/순서 설정은 총관리자만 수정할 수 있습니다."
            )
        if comp_update.sort_order is not None:
            comp.sort_order = comp_update.sort_order
        if comp_update.is_hidden is not None:
            comp.is_hidden = comp_update.is_hidden
        superadmin_fields = ['sort_order', 'is_hidden']

    # Check general field update permissions
    update_dict = comp_update.model_dump(exclude_unset=True)
    general_fields_updating = any(field not in superadmin_fields for field in update_dict.keys())

    if general_fields_updating:
        is_creator = (comp.creator_id == current_user.id)

        is_invited_admin_allowed = False
        if comp.allow_invited_gym_settings and current_user.gym_id:
            invited_check = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()
            if invited_check:
                is_invited_admin_allowed = True

        if not (is_creator or is_superadmin or is_invited_admin_allowed):
            raise HTTPException(status_code=403, detail="대회 일반 설정 변경 권한이 없습니다.")

    # Update fields
    if comp_update.title is not None:
        comp.title = comp_update.title
    if comp_update.description is not None:
        comp.description = comp_update.description
    if comp_update.start_date is not None:
        comp.start_date = comp_update.start_date
    if comp_update.end_date is not None:
        comp.end_date = comp_update.end_date
    if comp_update.is_active is not None:
        comp.is_active = comp_update.is_active

    # Update security options
    if comp_update.is_private is not None:
        comp.is_private = comp_update.is_private
    if comp_update.show_leaderboard_to_all is not None:
        comp.show_leaderboard_to_all = comp_update.show_leaderboard_to_all
    if comp_update.show_wod_to_all is not None:
        comp.show_wod_to_all = comp_update.show_wod_to_all
    if comp_update.anonymize_for_all is not None:
        comp.anonymize_for_all = comp_update.anonymize_for_all
    if comp_update.guest_passcode is not None:
        comp.guest_passcode = comp_update.guest_passcode
    if comp_update.allow_invited_gym_settings is not None:
        comp.allow_invited_gym_settings = comp_update.allow_invited_gym_settings

    db.commit()
    db.refresh(comp)
    return enrich_with_admins(comp, db)


# 3-2. Delete competition (creator only)
@router.delete("/{id}")
def delete_competition(
    id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Delete competition. Only creator or superadmin can delete."""
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Only creator or superadmin can delete
    if comp.creator_id != current_user.id and current_user.role != 'superadmin':
        raise HTTPException(status_code=403, detail="본인이 생성한 대회만 삭제할 수 있습니다.")

    db.delete(comp)
    db.commit()
    return {"message": "Competition deleted successfully"}
