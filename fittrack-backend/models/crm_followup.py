from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class MemberCrmFollowUp(Base):
    __tablename__ = "member_crm_followups"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    trigger_type = Column(String(50), nullable=False, index=True)  # expiry_7days, expiry_3days
    status = Column(String(30), nullable=False, default="pending")  # pending, contacted, completed, on_hold, no_response
    note = Column(Text, nullable=True, default="")
    contact_method = Column(String(30), nullable=True)  # call, sms, manual
    last_contacted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    member = relationship("Member")
    gym = relationship("Gym")
