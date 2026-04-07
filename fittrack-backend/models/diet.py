# models/diet.py
# DietLog model

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class DietLog(Base):
    __tablename__ = "diet_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))

    date = Column(Date, index=True) # 식단 날짜
    meal_type = Column(String) # Breakfast, Lunch, Dinner, Snack
    content = Column(Text) # 식단 내용 (메뉴 등)
    calories = Column(Integer, nullable=True) # 칼로리 (선택)
    carbs = Column(Integer, nullable=True)   # 탄수화물 (g)
    protein = Column(Integer, nullable=True) # 단백질 (g)
    fat = Column(Integer, nullable=True)     # 지방 (g)
    image_url = Column(String, nullable=True) # 사진 URL

    created_at = Column(DateTime, default=datetime.now)

    member = relationship("Member", back_populates="diet_logs")
