# models/coaching_class.py
# CoachingClass and CoachingClassAssignment models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date, Index, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class CoachingClass(Base):
    __tablename__ = "coaching_classes"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)

    # 수업 정보
    title = Column(String, nullable=False)  # "오전 크로스핏"
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)  # "10:00"
    days_of_week = Column(String, nullable=False)  # "0,1,2,3,4" (월~금)

    # 추가 정보
    max_participants = Column(Integer, default=20)
    description = Column(Text, nullable=True)
    color = Column(String, default="#3182F6")  # UI 색상
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 관계
    gym = relationship("Gym")
    assignments = relationship("CoachingClassAssignment", back_populates="coaching_class")

    # 복합 인덱스
    __table_args__ = (
        Index('idx_coaching_class_gym_active', 'gym_id', 'is_active'),
    )


class CoachingClassAssignment(Base):
    __tablename__ = "coaching_class_assignments"

    id = Column(Integer, primary_key=True, index=True)
    coaching_class_id = Column(Integer, ForeignKey("coaching_classes.id"), nullable=False, index=True)
    coach_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    # 관계
    coaching_class = relationship("CoachingClass", back_populates="assignments")
    coach = relationship("Member")

    # 복합 인덱스
    __table_args__ = (
        Index('idx_coaching_class_assignment_date_gym', 'date', 'coaching_class_id'),
        Index('idx_coaching_class_assignment_coach_date', 'coach_id', 'date'),
    )
