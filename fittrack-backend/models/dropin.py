# models/dropin.py
# DropInReservation model

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class DropInReservation(Base):
    __tablename__ = "drop_in_reservations"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    member_id = Column(Integer, ForeignKey("members.id"))

    date = Column(Date, index=True) # 예약 날짜
    status = Column(String, default="pending") # pending, confirmed, cancelled
    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym", back_populates="drop_in_reservations")
    member = relationship("Member")
