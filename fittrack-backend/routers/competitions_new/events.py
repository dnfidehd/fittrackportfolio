"""
Event management endpoints: POST /{id}/events, PUT /events/{event_id}, DELETE /events/{event_id}
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from security import get_current_user
from models import Competition, CompetitionEvent, CompetitionScore, Member
from schemas import CompEventCreate, CompEventResponse

router = APIRouter()


# 4. Create event (WOD)
@router.post("/{id}/events", response_model=CompEventResponse)
def create_event(
    id: int,
    event: CompEventCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Create a new event for a competition."""
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    new_event = CompetitionEvent(
        competition_id=id,
        title=event.title,
        description=event.description,
        score_type=event.score_type,
        time_cap=event.time_cap,
        max_reps=event.max_reps
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


# 8. Update event (admin only)
@router.put("/events/{event_id}")
def update_event(
    event_id: int,
    event_data: CompEventCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Update event details. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.title = event_data.title
    event.description = event_data.description
    event.score_type = event_data.score_type
    event.time_cap = event_data.time_cap
    event.max_reps = event_data.max_reps
    db.commit()
    db.refresh(event)
    return {"message": "이벤트가 수정되었습니다."}


# 9. Delete event (admin only)
@router.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    """Delete event and its scores. Admin only."""
    if current_user.role not in ['subcoach', 'coach', 'superadmin', 'admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Delete all scores for this event
    db.query(CompetitionScore).filter(CompetitionScore.event_id == event_id).delete()
    db.delete(event)
    db.commit()
    return {"message": "이벤트가 삭제되었습니다."}
