# models/gym.py
# Gym model

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import date


class Gym(Base):
    __tablename__ = "gyms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    location = Column(String, nullable=True)
    members = relationship("Member", back_populates="gym")
    sales = relationship("Sale", back_populates="gym")
    wods = relationship("Wod", back_populates="gym")
    posts = relationship("Post", back_populates="gym")

    # ✅ [신규] 구독 정보 필드
    subscription_plan = Column(String, default="Standard")  # Basic, Standard, Premium
    subscription_start_date = Column(Date, default=date.today)
    next_billing_date = Column(Date, nullable=True)
    monthly_fee = Column(Integer, default=199000)
    payment_status = Column(String, default="paid")

    # ✅ [신규] 드랍인 & 지도 정보 추가
    latitude = Column(Float, nullable=True)   # 위도
    longitude = Column(Float, nullable=True)  # 경도
    drop_in_price = Column(Integer, default=20000) # 드랍인 가격
    description = Column(Text, nullable=True) # 체육관 소개
    drop_in_enabled = Column(Boolean, default=True) # 드랍인 예약 가능 여부

    drop_in_reservations = relationship("DropInReservation", back_populates="gym")
