# routers/goals.py
# 목표 설정 API

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime

from database import get_db
from models import Goal, Member
from routers.auth import get_current_user

router = APIRouter(
    prefix="/api/goals",
    tags=["goals"]
)


# ===== Pydantic Schemas =====
class GoalCreate(BaseModel):
    title: str
    category: str = "pr"  # pr, attendance, body, wod
    target_value: float
    current_value: float = 0
    unit: str = "kg"
    deadline: Optional[date] = None

class GoalUpdate(BaseModel):
    current_value: Optional[float] = None
    status: Optional[str] = None

class GoalResponse(BaseModel):
    id: int
    member_id: int
    title: str
    category: str
    target_value: float
    current_value: float
    unit: str
    deadline: Optional[date] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ===== API Endpoints =====

# 1. 내 목표 목록 조회
@router.get("/", response_model=List[GoalResponse])
def get_my_goals(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return db.query(Goal).filter(
        Goal.member_id == current_user.id
    ).order_by(Goal.created_at.desc()).all()


# 2. 목표 생성
@router.post("/", response_model=GoalResponse)
def create_goal(
    goal_data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    new_goal = Goal(
        member_id=current_user.id,
        title=goal_data.title,
        category=goal_data.category,
        target_value=goal_data.target_value,
        current_value=goal_data.current_value,
        unit=goal_data.unit,
        deadline=goal_data.deadline
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return new_goal


# 3. 목표 진행 업데이트
@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    update_data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.member_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if update_data.current_value is not None:
        goal.current_value = update_data.current_value
        # 목표 달성 시 자동으로 상태 변경
        if goal.current_value >= goal.target_value:
            goal.status = "달성"
            goal.completed_at = datetime.now()
    
    if update_data.status is not None:
        goal.status = update_data.status
        if update_data.status == "달성" and not goal.completed_at:
            goal.completed_at = datetime.now()
    
    db.commit()
    db.refresh(goal)
    return goal


# 4. 목표 삭제
@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id, 
        Goal.member_id == current_user.id
    ).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(goal)
    db.commit()
    return {"message": "Goal deleted"}
