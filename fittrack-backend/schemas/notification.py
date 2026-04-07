# fittrack-backend/schemas/notification.py
# Notification and Notification Template related schemas

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    sender_id: Optional[int] = None
    type: str  # competition_status, comment, reply, system
    title: str
    message: str
    related_link: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationBroadcastRequest(BaseModel):
    title: str
    message: str
    target_gym_id: Optional[int] = None  # 없으면 요청자의 gym_id 사용
    related_link: Optional[str] = None


class NotificationTemplateBase(BaseModel):
    type: str
    title: str
    message: str


class NotificationTemplateCreate(NotificationTemplateBase):
    pass


class NotificationTemplateUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None


class NotificationTemplateResponse(NotificationTemplateBase):
    id: int
    gym_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
