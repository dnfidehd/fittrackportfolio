# models/messaging.py
# Message model for 1:1 DM

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("members.id"))
    receiver_id = Column(Integer, ForeignKey("members.id"))

    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    sender = relationship("Member", foreign_keys=[sender_id], back_populates="messages_sent")
    receiver = relationship("Member", foreign_keys=[receiver_id], back_populates="messages_received")
