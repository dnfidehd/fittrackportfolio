# fittrack-backend/schemas/coaching_class.py
# Coaching Class related schemas

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class CoachingClassCreate(BaseModel):
    title: str
    start_time: str  # "09:00"
    end_time: str
    days_of_week: str  # "0,1,2,3,4"
    max_participants: int = 20
    description: Optional[str] = None
    color: str = "#3182F6"


class CoachingClassUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    days_of_week: Optional[str] = None
    max_participants: Optional[int] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class CoachingClassResponse(BaseModel):
    id: int
    gym_id: int
    title: str
    start_time: str
    end_time: str
    days_of_week: str
    max_participants: int
    description: Optional[str] = None
    color: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CoachingClassAssignmentCreate(BaseModel):
    coaching_class_id: int
    coach_id: int
    date: date
    memo: Optional[str] = None


class CoachingClassAssignmentResponse(BaseModel):
    id: int
    coaching_class_id: int
    coach_id: int
    date: date
    status: str
    memo: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CoachingClassAssignmentWithDetails(BaseModel):
    id: int
    coaching_class_id: int
    coaching_class_title: str
    coach_id: int
    coach_name: str
    date: date
    status: str
    memo: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CoachingClassCalendarItem(BaseModel):
    coaching_class: CoachingClassResponse
    assigned_coaches: List[dict]  # [{"assignment_id": 1, "coach_id": 1, "coach_name": "김코치", "status": "scheduled"}]


class CoachingClassAutoAssignRequest(BaseModel):
    year_month: str  # "YYYY-MM"
    rules: str       # 자연어 규칙
