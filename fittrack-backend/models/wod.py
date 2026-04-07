# models/wod.py
# Wod and WodRecord models

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date


class Wod(Base):
    __tablename__ = "wods"
    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), default=1)
    date = Column(Date, index=True)
    title = Column(String)
    content = Column(Text, nullable=False)
    description = Column(Text, nullable=True) # ✅ [신규] 참고사항/코칭 가이드
    score_type = Column(String, default="time")
    is_rest_day = Column(Boolean, default=False)

    # ✅ [신규] 팀 와드 설정
    is_team = Column(Boolean, default=False)
    team_size = Column(Integer, nullable=True) # 2, 3, 4 ...

    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym", back_populates="wods")
    records = relationship("WodRecord", back_populates="wod", cascade="all, delete-orphan")
    videos = relationship("WodVideo", back_populates="wod", cascade="all, delete-orphan")


class WodVideo(Base):
    __tablename__ = "wod_videos"
    id = Column(Integer, primary_key=True, index=True)
    wod_id = Column(Integer, ForeignKey("wods.id"))
    url = Column(String)
    comment = Column(String)

    wod = relationship("Wod", back_populates="videos")


class WodRecord(Base):
    __tablename__ = "wod_records"
    id = Column(Integer, primary_key=True, index=True)
    wod_id = Column(Integer, ForeignKey("wods.id"))
    member_id = Column(Integer, ForeignKey("members.id"))
    member_name = Column(String)
    record_value = Column(String)
    is_rx = Column(Boolean, default=False)
    scale_rank = Column(String, nullable=True) # A, B, C or null
    is_time_cap = Column(Boolean, default=False) # Time Cap(미완주) 여부
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    wod = relationship("Wod", back_populates="records")
    member = relationship("Member", back_populates="wod_records")
