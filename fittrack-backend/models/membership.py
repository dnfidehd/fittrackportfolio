# models/membership.py
# MembershipHold and MembershipHistory models

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Boolean, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date


class MembershipHold(Base):
    __tablename__ = "membership_holds"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))

    start_date = Column(Date)
    end_date = Column(Date)
    days = Column(Integer)

    created_at = Column(DateTime, default=datetime.now)

    member = relationship("Member", back_populates="holds")


class MembershipProduct(Base):
    __tablename__ = "membership_products"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    category = Column(String, default="membership") # membership, goods, food...
    name = Column(String)       # 예: 1개월 회원권, 티셔츠
    price = Column(Integer)     # 예: 150000
    months = Column(Integer, nullable=True)    # 기간(회원권인 경우만)

    is_active = Column(Boolean, default=True) # 판매 중단 여부
    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym")
