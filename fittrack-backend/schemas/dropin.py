# fittrack-backend/schemas/dropin.py
# Drop-In related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DropInCreate(BaseModel):
    gym_id: int
    date: date


class DropInResponse(BaseModel):
    id: int
    gym_id: int
    member_id: int
    member_name: Optional[str] = None  # Join 후 채워질 예정
    member_phone: Optional[str] = None
    date: date
    status: str
    gym_name: Optional[str] = None  # Join 후 채워질 예정
    created_at: datetime
    first_paid_sale_date: Optional[datetime] = None
    converted_within_7_days: bool = False
    converted_within_30_days: bool = False
    conversion_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DropInStatusUpdate(BaseModel):
    status: str  # "confirmed" | "rejected"
