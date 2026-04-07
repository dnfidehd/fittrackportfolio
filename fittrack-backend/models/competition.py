# models/competition.py
# Competition, CompetitionEvent, CompetitionScore, CompetitionRegistration, CompetitionGym models

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Competition(Base):
    __tablename__ = "competitions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    start_date = Column(String)
    end_date = Column(String)
    status = Column(String, default="upcoming")
    is_active = Column(Boolean, default=True)

    # ✅ [신규] 대회 공개 및 보안 설정
    is_private = Column(Boolean, default=False)  # 특정 박스 전용 여부
    show_leaderboard_to_all = Column(Boolean, default=True) # 비참여 유저에게 리더보드 공개
    show_wod_to_all = Column(Boolean, default=True) # 비참여 유저에게 WOD 공개
    anonymize_for_all = Column(Boolean, default=False) # 비참여 유저에게 이름 마스킹
    creator_id = Column(Integer, ForeignKey("members.id"), nullable=True) # 대회 생성자 권한용
    guest_passcode = Column(String, nullable=True) # ✅ [신규] 게스트용 패스코드
    allow_invited_gym_settings = Column(Boolean, default=False) # ✅ [신규] 초대된 박스 어드민도 설정 변경 허용

    # ✅ [신규] 총관리자 노출 설정 기능
    sort_order = Column(Integer, nullable=True) # 노출 순서 (낮을수록 우선순위 높음)
    is_hidden = Column(Boolean, default=False)  # 게스트 화면 숨김 여부

    events = relationship("CompetitionEvent", back_populates="competition")
    registrations = relationship("CompetitionRegistration", back_populates="competition")
    participating_gyms = relationship("CompetitionGym", back_populates="competition")


class CompetitionGym(Base):
    __tablename__ = "competition_gyms"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    status = Column(String, default="pending") # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.now)

    competition = relationship("Competition", back_populates="participating_gyms")
    gym = relationship("Gym")

    @property
    def gym_name(self):
        return self.gym.name if self.gym else None


class CompetitionEvent(Base):
    __tablename__ = "competition_events"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    title = Column(String)
    description = Column(Text)
    score_type = Column(String)

    # ✅ [신규] 기록 입력 제한 설정
    time_cap = Column(Integer, nullable=True) # 타임캡 (초 단위)
    max_reps = Column(Integer, nullable=True) # 최대 렙수

    competition = relationship("Competition", back_populates="events")
    scores = relationship("CompetitionScore", back_populates="event")


class CompetitionScore(Base):
    __tablename__ = "competition_scores"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("competition_events.id"))
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True) # ✅ [수정] 게스트는 member_id가 없음
    member_name = Column(String)
    score_value = Column(String)
    is_rx = Column(Boolean, default=True)
    scale_rank = Column(String, nullable=True) # A, B, C or null
    is_time_cap = Column(Boolean, default=False) # Time Cap 여부
    tie_break = Column(String, nullable=True)
    note = Column(String, nullable=True)

    # ✅ [신규] 게스트 추가 정보
    guest_gender = Column(String, nullable=True) # M, F
    guest_phone = Column(String, nullable=True)
    guest_gym = Column(String, nullable=True) # ✅ [신규] 소속 박스

    status = Column(String, default="approved") # ✅ [수정] 모든 기록은 승인 대기 없이 기본 승인됨

    event = relationship("CompetitionEvent", back_populates="scores")
    member = relationship("Member", back_populates="competition_scores")


class CompetitionRegistration(Base):
    __tablename__ = "competition_registrations"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    member_id = Column(Integer, ForeignKey("members.id"))
    member_name = Column(String)
    status = Column(String, default="approved")
    created_at = Column(DateTime, default=datetime.now)

    competition = relationship("Competition", back_populates="registrations")
    member = relationship("Member")
