# models/notification.py
# Notification and NotificationTemplate models

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("members.id"))
    sender_id = Column(Integer, ForeignKey("members.id"), nullable=True)  # 알림 유발자 (예: 댓글 작성자)

    type = Column(String)  # competition_status, comment, reply, system
    title = Column(String)
    message = Column(String)
    related_link = Column(String, nullable=True)  # 클릭 시 이동할 경로

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    recipient = relationship("Member", foreign_keys=[recipient_id], back_populates="notifications_received")
    sender = relationship("Member", foreign_keys=[sender_id], back_populates="notifications_sent")


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    type = Column(String, index=True)  # 'expiry_7days', 'expiry_3days', 'inactivity_7days', 'inactivity_no_checkin'
    title = Column(String)
    message = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    gym = relationship("Gym")
