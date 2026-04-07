# fittrack-backend/models.py
# SQLAlchemy Models (데이터베이스 테이블)

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date
from sqlalchemy.orm import relationship, backref
from database import Base
from datetime import datetime, date

# Pydantic 스키마는 schemas.py에서 import
from schemas import (
    Token, TokenData, PasswordChange, LoginRequest,
    MemberBase, MemberCreate, MemberUpdate, MemberProfileUpdate, MemberResponse, MemberPaginationResponse,
    HoldCreate, HoldStatusResponse, HoldResponse,
    WodCreate, WodResponse, WodRecordCreate, WodRecordResponse,
    WorkoutCreate, WorkoutResponse,
    PRCreate, PRResponse,
    CommentCreate, CommentResponse, PostCreate, PostResponse,
    CompetitionCreate, CompetitionResponse, CompetitionEventCreate, CompEventCreate,
    CompetitionEventResponse, CompEventResponse, CompetitionScoreCreate, CompScoreCreate,
    ScoreResponse, CompLeaderboardItem,
    SaleCreate, SaleResponse,
    AttendanceCheckIn, AttendanceResponse,
    BadgeCreate, BadgeResponse, OverallLeaderboardItem,
    ExpenseCreate, ExpenseResponse,
    NotificationResponse,
    WorkScheduleCreate, WorkScheduleUpdate, WorkScheduleResponse,
    WorkScheduleTemplateCreate, WorkScheduleTemplateResponse
)


# =========================================================
# SQLAlchemy Models
# =========================================================

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


class DropInReservation(Base):
    __tablename__ = "drop_in_reservations"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    member_id = Column(Integer, ForeignKey("members.id"))
    
    date = Column(Date, index=True) # 예약 날짜
    status = Column(String, default="pending") # pending, confirmed, cancelled
    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym", back_populates="drop_in_reservations")
    member = relationship("Member")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("members.id"))
    sender_id = Column(Integer, ForeignKey("members.id"), nullable=True)  # 알림 유발자 (예: 댓글 작성자)
    
    type = Column(String)  # competition_status, comment, reply, system
    title = Column(String)
    message = Column(String)
    related_link = Column(String, nullable=True)  # 클릭 시 이동할 경로
    
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    recipient = relationship("Member", foreign_keys=[recipient_id], back_populates="notifications_received")
    sender = relationship("Member", foreign_keys=[sender_id], back_populates="notifications_sent")


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


# 목표 설정 모델 (Goal Setting)
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

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    board_type = Column(String, index=True, default="free")
    title = Column(String, index=True)
    content = Column(Text)

    author_id = Column(Integer, ForeignKey("members.id"))
    author_name = Column(String)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=True)

    image_url = Column(String, nullable=True)
    region = Column(String, nullable=True) # ✅ [신규] 지역별 필터링용
    market_status = Column(String, default="판매중")
    youtube_url = Column(String, nullable=True)
    wod_record = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.now)
    views = Column(Integer, default=0)

    # ✅ [신규] 팝업 공지 관련 필드
    is_popup = Column(Boolean, default=False)
    popup_expires_at = Column(DateTime, nullable=True)

    author = relationship("Member", back_populates="posts")
    gym = relationship("Gym", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    author_id = Column(Integer, ForeignKey("members.id"))
    author_name = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    post = relationship("Post", back_populates="comments")
    author = relationship("Member", back_populates="comments")
    replies = relationship(
        "Comment",
        backref=backref('parent', remote_side=[id]),
        cascade="all, delete"
    )


class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"), default=1)
    date = Column(Date, index=True)
    check_in_time = Column(DateTime, default=datetime.now)
    member = relationship("Member", back_populates="attendances")
    gym = relationship("Gym")


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


class Workout(Base):
    __tablename__ = "workouts"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    member_name = Column(String)
    date = Column(String)
    workout = Column(String)
    time = Column(String)
    type = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    member = relationship("Member", back_populates="workouts")


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


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    item_name = Column(String)
    amount = Column(Integer)
    category = Column(String)
    payment_method = Column(String)
    status = Column(String, default="paid")
    payment_date = Column(DateTime, default=datetime.now)
    member = relationship("Member", back_populates="sales")
    gym = relationship("Gym", back_populates="sales")


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


class MembershipHold(Base):
    __tablename__ = "membership_holds"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))

    start_date = Column(Date)
    end_date = Column(Date)
    days = Column(Integer)

    created_at = Column(DateTime, default=datetime.now)

    member = relationship("Member", back_populates="holds")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    item_name = Column(String)
    amount = Column(Integer)
    category = Column(String)
    date = Column(Date, default=date.today)
    method = Column(String)
    memo = Column(String, nullable=True)

    gym = relationship("Gym")





class StaffTask(Base):
    __tablename__ = "staff_tasks"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    content = Column(String)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    member_id = Column(Integer, ForeignKey("members.id"))


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


# =========================================================
# 18. Diet Log (식단 일지)
# =========================================================

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


# =========================================================
# 15. Class Schedule & Reservation (수업 예약)
# =========================================================

class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    
    title = Column(String)  # 예: "Group PT", "CrossFit", "Open Gym"
    date = Column(Date, index=True)
    time = Column(String)   # 예: "10:00", "19:30"
    max_participants = Column(Integer, default=20)
    
    status = Column(String, default="open") # open, closed, cancelled
    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym")
    reservations = relationship("ClassReservation", back_populates="schedule", cascade="all, delete-orphan")


class ClassReservation(Base):
    __tablename__ = "class_reservations"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("class_schedules.id"))
    member_id = Column(Integer, ForeignKey("members.id"))
    
    status = Column(String, default="reserved") # reserved, cancelled
    created_at = Column(DateTime, default=datetime.now)

    schedule = relationship("ClassSchedule", back_populates="reservations")
    member = relationship("Member")


class ClassTemplate(Base):
    __tablename__ = "class_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))
    
    title = Column(String)
    time = Column(String)   # 예: "10:00"
    max_participants = Column(Integer, default=20)
    
    # 요일 저장 (예: "0,1,2" -> 월,화,수)
    days_of_week = Column(String) 

    created_at = Column(DateTime, default=datetime.now)
    gym = relationship("Gym")


# =========================================================
# 20. Coach Message (1:1 DM)
# =========================================================

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("members.id"))
    receiver_id = Column(Integer, ForeignKey("members.id"))
    
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    sender = relationship("Member", foreign_keys=[sender_id], back_populates="messages_sent")
    receiver = relationship("Member", foreign_keys=[receiver_id], back_populates="messages_received")


# =========================================================
# 21. AI Analysis Cache
# =========================================================

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

# Member 관계 설정 추가
Member.ai_analyses = relationship("AIAnalysis", order_by=AIAnalysis.created_at.desc(), back_populates="member")


# =========================================================
# 20. Notification Template (알림 메시지 템플릿)
# =========================================================
class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"))

    type = Column(String, index=True)  # 'expiry_7days', 'expiry_3days', 'inactivity_7days', 'inactivity_no_checkin'
    title = Column(String)
    message = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    gym = relationship("Gym")


# =========================================================
# 21. Coach Permission (부코치 권한 관리)
# =========================================================
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


# =========================================================
# 22. Work Schedule (근무표 관리)
# =========================================================

class WorkSchedule(Base):
    __tablename__ = "work_schedules"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False, index=True)
    coach_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)

    # 근무 정보
    date = Column(Date, nullable=False, index=True)
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)    # "18:00"
    work_category = Column(String, default="general") # ✅ [추가] general(정규근무), class(수업)
    shift_type = Column(String, default="regular")  # regular, overtime, holiday

    # 추가 정보
    memo = Column(Text, nullable=True)
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 관계
    gym = relationship("Gym")
    coach = relationship("Member")

    # 복합 인덱스
    from sqlalchemy import Index
    __table_args__ = (
        Index('idx_work_schedule_date_gym', 'date', 'gym_id'),
        Index('idx_work_schedule_coach_date', 'coach_id', 'date'),
    )


class WorkScheduleTemplate(Base):
    __tablename__ = "work_schedule_templates"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("members.id"), nullable=False)

    # 템플릿 정보
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    shift_type = Column(String, default="regular")
    days_of_week = Column(String, nullable=False)  # "0,1,2,3,4" (월~금)
    memo = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.now)

    gym = relationship("Gym")
    coach = relationship("Member")
