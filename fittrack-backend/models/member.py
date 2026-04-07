# models/member.py
# Member and PersonalRecord models

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, index=True)  # ✅ [수정] 박스 독립성을 위해 unique=True 제거
    name = Column(String)
    hashed_password = Column(String)
    must_change_password = Column(Boolean, default=True)
    join_date = Column(Date, default=date.today)
    role = Column(String(50), default="user") # 'user', 'coach', 'subcoach', 'admin', 'superadmin' 등
    hourly_wage = Column(Integer, default=0) # [추가] 코치/부코치의 시급
    class_wage = Column(Integer, default=0) # ✅ [추가] 코치의 수업 1회당 급여
    gender = Column(String, nullable=True)
    birth_date = Column(String, nullable=True)
    crossfit_experience = Column(String, nullable=True)
    color = Column(String, nullable=True, default="#3182F6") # ✅ [추가] 코치 고유 색상 (Hex Code)

    squat_1rm = Column(Float, default=0.0)
    deadlift_1rm = Column(Float, default=0.0)
    bench_1rm = Column(Float, default=0.0)

    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    activity_level = Column(String, nullable=True)
    workout_goal = Column(String, nullable=True)

    membership = Column(String, nullable=True)
    status = Column(String, default="활성")
    memo = Column(String, nullable=True, default="")
    tags = Column(String, nullable=True, default="")  # 회원 태그 (쉼표 구분: "VIP,주의,PT회원")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)
    gym = relationship("Gym", back_populates="members")

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")
    attendances = relationship("Attendance", back_populates="member")
    wod_records = relationship("WodRecord", back_populates="member")
    personal_records = relationship("PersonalRecord", back_populates="member")
    competition_scores = relationship("CompetitionScore", back_populates="member")
    workouts = relationship("Workout", back_populates="member")
    sales = relationship("Sale", back_populates="member")
    badges = relationship("MemberBadge", back_populates="member")
    holds = relationship("MembershipHold", back_populates="member")

    notifications_received = relationship("Notification", foreign_keys="[Notification.recipient_id]", back_populates="recipient")
    notifications_sent = relationship("Notification", foreign_keys="[Notification.sender_id]", back_populates="sender")

    messages_sent = relationship("Message", foreign_keys="[Message.sender_id]", back_populates="sender")
    messages_received = relationship("Message", foreign_keys="[Message.receiver_id]", back_populates="receiver")

    goals = relationship("Goal", back_populates="member")
    diet_logs = relationship("DietLog", back_populates="member")


class PersonalRecord(Base):
    __tablename__ = "personal_records"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"), default=1)
    exercise_name = Column(String)
    record_value = Column(Float)
    recorded_date = Column(Date)
    unit = Column(String, default="lb")
    member = relationship("Member", back_populates="personal_records")
