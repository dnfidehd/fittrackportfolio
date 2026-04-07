# models/badge.py
# Badge and MemberBadge models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Badge(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String)
    icon = Column(String)
    criteria = Column(String)
    created_at = Column(DateTime, default=datetime.now)

    owners = relationship("MemberBadge", back_populates="badge")


class MemberBadge(Base):
    __tablename__ = "member_badges"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    badge_id = Column(Integer, ForeignKey("badges.id"))
    earned_at = Column(DateTime, default=datetime.now)

    member = relationship("Member", back_populates="badges")
    badge = relationship("Badge", back_populates="owners")
