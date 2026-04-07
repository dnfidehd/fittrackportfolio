# fittrack-backend/schemas/workout.py
# Workout and PR (Personal Record) related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class WorkoutCreate(BaseModel):
    date: str
    workout: str
    time: str
    memberName: Optional[str] = None


class WorkoutUpdate(BaseModel):
    date: Optional[str] = None
    workout: Optional[str] = None
    time: Optional[str] = None
    description: Optional[str] = None


class WorkoutResponse(BaseModel):
    id: int
    member_id: int
    member_name: str
    date: str
    workout: str
    time: str
    type: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PRCreate(BaseModel):
    exercise_name: str
    record_value: float
    recorded_date: str
    unit: str = "kg"


class PRResponse(BaseModel):
    id: int
    member_id: int
    exercise_name: str
    record_value: float
    recorded_date: date
    unit: str
    model_config = ConfigDict(from_attributes=True)
