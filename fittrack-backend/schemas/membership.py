# fittrack-backend/schemas/membership.py
# Membership-related schemas (holds, etc.)

from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class HoldCreate(BaseModel):
    start_date: date
    end_date: date


class HoldStatusResponse(BaseModel):
    max_days: int
    used_days: int
    remaining_days: int


class HoldResponse(HoldCreate):
    id: int
    days: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
