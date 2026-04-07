# fittrack-backend/schemas/messaging.py
# Message (Coach 1:1 DM) related schemas

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class MessageCreate(BaseModel):
    receiver_id: int
    message: str


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str  # Join해서 채울 예정
    receiver_id: int
    receiver_name: str  # Join해서 채울 예정

    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: int
    name: str
    role: str
    gym_id: Optional[int] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)
