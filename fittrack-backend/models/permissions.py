# models/permissions.py
# Permission and CoachPermission models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)  # 'members', 'classes', 'wods', etc
    display_name = Column(String)  # '회원 관리', '수업 관리' etc

    created_at = Column(DateTime, default=datetime.now)


class CoachPermission(Base):
    __tablename__ = "coach_permissions"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("members.id"))
    permission_id = Column(Integer, ForeignKey("permissions.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"))  # ✅ [추가] 체육관별 권한 격리

    created_at = Column(DateTime, default=datetime.now)

    coach = relationship("Member")
    permission = relationship("Permission")
    gym = relationship("Gym")
