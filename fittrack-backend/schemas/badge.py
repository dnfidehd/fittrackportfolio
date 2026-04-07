# fittrack-backend/schemas/badge.py
# Badge related schemas

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BadgeCreate(BaseModel):
    name: str
    description: str
    icon: str
    criteria: str


class BadgeResponse(BadgeCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
