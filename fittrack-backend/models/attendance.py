# models/attendance.py
# Attendance model

from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"), default=1)
    date = Column(Date, index=True)
    check_in_time = Column(DateTime, default=datetime.now)
    member = relationship("Member", back_populates="attendances")
    gym = relationship("Gym")
