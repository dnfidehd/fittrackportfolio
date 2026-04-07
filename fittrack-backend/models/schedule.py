# models/schedule.py
# WorkSchedule and WorkScheduleTemplate models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date, Index
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    coach_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)

    # 근무 정보
    date = Column(Date, nullable=False, index=True)
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)    # "18:00"
    work_category = Column(String, default="general") # ✅ [추가] general(정규근무), class(수업)
    shift_type = Column(String, default="regular")  # regular, overtime, holiday

    # 추가 정보
    memo = Column(Text, nullable=True)
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 관계
    gym = relationship("Gym")
    coach = relationship("Member")

    # 복합 인덱스
    __table_args__ = (
        Index('idx_work_schedule_date_gym', 'date', 'gym_id'),
        Index('idx_work_schedule_coach_date', 'coach_id', 'date'),
    )


class WorkScheduleTemplate(Base):
    __tablename__ = "work_schedule_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("members.id"), nullable=False)

    # 템플릿 정보
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    shift_type = Column(String, default="regular")
    days_of_week = Column(String, nullable=False)  # "0,1,2,3,4" (월~금)
    memo = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym")
    coach = relationship("Member")
