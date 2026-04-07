# models/goals.py
# Goal and related models

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))

    title = Column(String)  # 예: "백스쿼트 100kg", "Fran 3분 이내"
    category = Column(String, default="pr")  # pr, attendance, body, wod
    target_value = Column(Float)  # 목표 값 (예: 100)
    current_value = Column(Float, default=0)  # 현재 진행 값
    unit = Column(String, default="lb")  # lb, reps, 분, 회

    deadline = Column(Date, nullable=True)  # 목표 달성 기한
    status = Column(String, default="진행중")  # 진행중, 달성, 포기

    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime, nullable=True)

    member = relationship("Member", back_populates="goals")
