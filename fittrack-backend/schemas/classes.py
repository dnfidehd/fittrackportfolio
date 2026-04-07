# fittrack-backend/schemas/classes.py
# Class Schedule and Reservation related schemas

from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class ClassScheduleCreate(BaseModel):
    title: str
    date: date
    time: str
    max_participants: int = 20
    status: str = "open"


class ClassScheduleResponse(BaseModel):
    id: int
    gym_id: int
    title: str
    date: date
    time: str
    max_participants: int
    status: str

    # 예약자 수 (계산된 필드용)
    current_participants: int = 0
    # 현재 유저가 예약했는지 여부
    is_reserved: bool = False

    model_config = ConfigDict(from_attributes=True)


class ReservationCreate(BaseModel):
    schedule_id: int


class ReservationResponse(BaseModel):
    id: int
    schedule_id: int
    member_id: int
    member_name: str  # Join해서 가져올 예정
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassTemplateCreate(BaseModel):
    title: str
    time: str
    max_participants: int = 20
    days_of_week: str  # "0,1,2,3,4"


class ClassTemplateResponse(BaseModel):
    id: int
    gym_id: int
    title: str
    time: str
    max_participants: int
    days_of_week: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
