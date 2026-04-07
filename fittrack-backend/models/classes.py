# models/classes.py
# ClassSchedule, ClassReservation, and ClassTemplate models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    title = Column(String)  # 예: "Group PT", "CrossFit", "Open Gym"
    date = Column(Date, index=True)
    time = Column(String)   # 예: "10:00", "19:30"
    max_participants = Column(Integer, default=20)

    status = Column(String, default="open") # open, closed, cancelled
    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym")
    reservations = relationship("ClassReservation", back_populates="schedule", cascade="all, delete-orphan")


class ClassReservation(Base):
    __tablename__ = "class_reservations"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("class_schedules.id"))
    member_id = Column(Integer, ForeignKey("members.id"))

    status = Column(String, default="reserved") # reserved, cancelled
    created_at = Column(DateTime, default=datetime.now)

    schedule = relationship("ClassSchedule", back_populates="reservations")
    member = relationship("Member")


class ClassTemplate(Base):
    __tablename__ = "class_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    title = Column(String)
    time = Column(String)   # 예: "10:00"
    max_participants = Column(Integer, default=20)

    # 요일 저장 (예: "0,1,2" -> 월,화,수)
    days_of_week = Column(String)

    created_at = Column(DateTime, default=datetime.now)
    gym = relationship("Gym")
