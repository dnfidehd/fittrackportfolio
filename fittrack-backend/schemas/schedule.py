# fittrack-backend/schemas/schedule.py
# Work Schedule related schemas

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class WorkScheduleCreate(BaseModel):
    coach_id: int
    date: date
    start_time: str
    end_time: str
    work_category: str = "general"  # ✅ [추가] 일반근무(general) vs 수업(class)
    shift_type: str = "regular"
    memo: Optional[str] = None


class WorkScheduleBulkCreate(BaseModel):  # ✅ [추가] 일괄 등록용 스키마
    date: date
    schedules: List[WorkScheduleCreate]


class WorkScheduleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    shift_type: Optional[str] = None
    memo: Optional[str] = None
    status: Optional[str] = None


class WorkScheduleResponse(BaseModel):
    id: int
    gym_id: int
    coach_id: int
    coach_name: str
    date: date
    start_time: str
    end_time: str
    work_category: str = "general"  # ✅ [추가]
    shift_type: str
    memo: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkScheduleTemplateCreate(BaseModel):
    coach_id: int
    start_time: str
    end_time: str
    shift_type: str = "regular"
    days_of_week: str  # "0,1,2,3,4" (월~금)
    memo: Optional[str] = None


class WorkScheduleTemplateResponse(BaseModel):
    id: int
    gym_id: int
    coach_id: int
    coach_name: str
    start_time: str
    end_time: str
    shift_type: str
    days_of_week: str
    memo: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
