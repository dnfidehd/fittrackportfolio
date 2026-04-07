# models/analytics.py
# AIAnalysis model

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))

    # 데이터 변경 감지용 해시 (Hash of input data)
    data_hash = Column(String, index=True)

    # 분석 결과 (JSON 형태로 저장하기 위해 Text 사용)
    summary = Column(Text)
    strengths = Column(Text) # JSON string
    weaknesses = Column(Text) # JSON string
    advice = Column(Text)
    radar_chart = Column(Text) # JSON string {"근력": 80, ...}

    created_at = Column(DateTime, default=datetime.now)

    member = relationship("Member", back_populates="ai_analyses")
