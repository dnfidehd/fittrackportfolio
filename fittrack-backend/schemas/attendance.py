# fittrack-backend/schemas/attendance.py
# Attendance related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AttendanceCheckIn(BaseModel):
    phone_last4: Optional[str] = None
    member_id: Optional[int] = None


class AttendanceResponse(BaseModel):
    id: int
    member_id: int
    gym_id: int
    date: date
    check_in_time: datetime

    model_config = ConfigDict(from_attributes=True)


class TodayAttendanceResponse(BaseModel):
    member_name: str
    check_in_time: datetime
