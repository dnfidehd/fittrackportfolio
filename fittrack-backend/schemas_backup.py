# fittrack-backend/schemas.py
# Pydantic Schemas (데이터 검증 및 응답용)

from datetime import datetime, date
from typing import Optional, List, Union, Dict, Any
from pydantic import BaseModel, ConfigDict


# =========================================================
# 1. 인증 (Auth)
# =========================================================

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    phone: str | None = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class LoginRequest(BaseModel):
    username: str
    password: str


# =========================================================
# 2. 회원 (Member)
# =========================================================

class MemberBase(BaseModel):
    phone: str
    name: str
    role: str = "user"
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    join_date: Optional[date] = None
    crossfit_experience: Union[str, int, None] = None
    squat_1rm: float = 0.0
    deadlift_1rm: float = 0.0
    bench_1rm: float = 0.0
    membership: Optional[str] = None
    status: Optional[str] = "활성"

    start_date: Optional[date] = None
    end_date: Optional[date] = None

class MemberCreate(MemberBase):
    password: str
    gym_id: Optional[int] = 1

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    status: Optional[str] = None
    membership: Optional[str] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    workout_goal: Optional[str] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None

class MemberProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    join_date: Optional[str] = None
    crossfit_experience: Union[str, int, None] = None
    squat_1rm: Optional[float] = None
    deadlift_1rm: Optional[float] = None
    bench_1rm: Optional[float] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    workout_goal: Optional[str] = None
    password: Optional[str] = None

class MemberResponse(BaseModel):
    id: int
    phone: str
    name: str
    role: str
    is_active: bool
    created_at: datetime
    gym_id: Optional[int] = None
    must_change_password: bool
    memo: Optional[str] = None
    
    # 추가된 프로필 정보
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    workout_goal: Optional[str] = None

    # 회원권 및 상태 정보
    status: Optional[str] = "활성"
    membership: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    tags: Optional[str] = None  # 회원 태그 (쉼표 구분)

    # ✅ [신규] 멀티 박스 지원: 내가 가입된 체육관 목록
    available_gyms: Optional[list] = []

    # ✅ [신규] 부코치 권한 정보
    permissions: Optional[List['PermissionResponse']] = []

    model_config = ConfigDict(from_attributes=True)

class MemberPaginationResponse(BaseModel):
    total: int
    members: List[MemberResponse]


# =========================================================
# 3. 홀딩 관련
# =========================================================

class HoldCreate(BaseModel):
    start_date: date
    end_date: date

class HoldStatusResponse(BaseModel):
    max_days: int
    used_days: int
    remaining_days: int

class HoldResponse(HoldCreate):
    id: int
    days: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 4. WOD
# =========================================================

class WodCreate(BaseModel):
    date: str
    title: str
    content: str
    description: Optional[str] = None # ✅ [신규] 참고사항
    youtube_url: Optional[str] = None
    score_type: str = "time"
    is_rest_day: bool = False # ✅ 휴무일 여부 추가
    
    # ✅ [신규] 팀 와드 설정
    is_team: bool = False
    team_size: Optional[int] = None

class WodResponse(BaseModel):
    id: int
    gym_id: Optional[int] = None
    date: date
    title: str
    content: str
    description: Optional[str] = None # ✅ [신규] 참고사항
    youtube_url: Optional[str] = None
    score_type: str
    is_rest_day: bool = False # ✅ 휴무일 여부 추가
    
    # ✅ [신규] 팀 와드 설정
    is_team: bool
    team_size: Optional[int] = None

    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 5. WOD Record
# =========================================================

class WodRecordCreate(BaseModel):
    wod_id: int
    record_value: str
    is_rx: bool = False
    scale_rank: Optional[str] = None # A, B, C or null
    is_time_cap: Optional[bool] = False # Time Cap(미완주) 여부
    note: Optional[str] = None

class WodRecordResponse(BaseModel):
    id: int
    wod_id: int
    member_id: int
    member_name: str
    record_value: str
    is_rx: bool
    scale_rank: Optional[str]
    is_time_cap: bool
    note: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 6. My Workouts
# =========================================================

class WorkoutCreate(BaseModel):
    date: str
    workout: str
    time: str
    memberName: Optional[str] = None
    
class WorkoutUpdate(BaseModel):
    date: Optional[str] = None
    workout: Optional[str] = None
    time: Optional[str] = None
    description: Optional[str] = None

class WorkoutResponse(BaseModel):
    id: int
    member_id: int
    member_name: str
    date: str
    workout: str
    time: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 7. PR (개인 최고 기록)
# =========================================================

class PRCreate(BaseModel):
    exercise_name: str
    record_value: float
    recorded_date: str
    unit: str = "kg"

class PRResponse(BaseModel):
    id: int
    member_id: int
    exercise_name: str
    record_value: float
    recorded_date: date
    unit: str
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 8. Community
# =========================================================

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PostCreate(BaseModel):
    board_type: str
    title: str
    content: str
    is_popup: bool = False
    popup_expires_at: Optional[datetime] = None

class PostResponse(BaseModel):
    id: int
    board_type: str
    title: str
    content: str
    author_id: int
    author_name: str
    created_at: datetime
    views: int
    is_popup: bool
    popup_expires_at: Optional[datetime] = None
    comments: List[CommentResponse] = []
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 9. Competition
# =========================================================

class CompetitionCreate(BaseModel):
    title: str
    description: str
    start_date: str
    end_date: str
    
    # ✅ [신규] 대회 공개 및 보안 설정
    is_private: bool = False
    show_leaderboard_to_all: bool = True
    show_wod_to_all: bool = True
    anonymize_for_all: bool = False
    
    # ✅ [신규] 생성 시 초대할 박스 ID 목록
    invited_gym_ids: Optional[List[int]] = []
    guest_passcode: Optional[str] = None # ✅ [신규] 게스트용 패스코드
    allow_invited_gym_settings: bool = False # ✅ [신규] 초대된 박스 어드민도 설정 변경 허용

class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None
    
    # ✅ [신규] 대회 공개 및 보안 설정 (수정용)
    is_private: Optional[bool] = None
    show_leaderboard_to_all: Optional[bool] = None
    show_wod_to_all: Optional[bool] = None
    anonymize_for_all: Optional[bool] = None
    guest_passcode: Optional[str] = None # ✅ [신규] 게스트용 패스코드 (수정용)
    allow_invited_gym_settings: Optional[bool] = None # ✅ [신규]
    
    # ✅ [신규] 총관리자 설정용 (코치/일반 관리자 수정 불가)
    sort_order: Optional[int] = None
    is_hidden: Optional[bool] = None

# ✅ [신규] Competition Gym (박스 연합) 스키마
class CompetitionGymCreate(BaseModel):
    competition_id: int
    gym_id: int

class CompetitionGymResponse(BaseModel):
    id: int
    competition_id: int
    gym_id: int
    gym_name: Optional[str] = None
    status: str # pending, accepted, rejected
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CompetitionResponse(BaseModel):
    id: int
    title: str
    description: str
    start_date: str
    end_date: str
    status: str
    is_active: bool
    
    # ✅ [신규] 일반 유저/코치/총관리자 공통 조회용
    is_private: bool
    show_leaderboard_to_all: bool
    show_wod_to_all: bool
    anonymize_for_all: bool
    guest_passcode: Optional[str] = None # ✅ [신규] 게스트용 패스코드
    creator_id: Optional[int] = None
    allow_invited_gym_settings: bool = False # ✅ [신규]
    
    # ✅ [신규] 총관리자 설정용 데이터 포함
    sort_order: Optional[int] = None
    is_hidden: bool = False
    
    participating_gyms: List[CompetitionGymResponse] = []
    admin_names: List[str] = [] # ✅ [신규] 대회 관리자(코치) 이름 목록
    
    model_config = ConfigDict(from_attributes=True)

class CompetitionEventCreate(BaseModel):
    title: str
    description: str
    score_type: str
    time_cap: Optional[int] = None
    max_reps: Optional[int] = None

CompEventCreate = CompetitionEventCreate

class CompetitionEventResponse(BaseModel):
    id: int
    competition_id: int
    title: str
    description: str
    score_type: str
    time_cap: Optional[int] = None
    max_reps: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

CompEventResponse = CompetitionEventResponse

class CompetitionScoreCreate(BaseModel):
    score_value: str
    is_rx: bool
    scale_rank: Optional[str] = None
    is_time_cap: Optional[bool] = False
    tie_break: Optional[str] = None
    note: Optional[str] = None
    member_name: Optional[str] = None # ✅ [신규] 게스트 등록 시 사용
    guest_gender: Optional[str] = None # ✅ [신규] M/F
    guest_phone: Optional[str] = None # ✅ [신규]
    guest_gym: Optional[str] = None # ✅ [신규]
    status: Optional[str] = "pending" # ✅ [신규] 기록 검증 상태

CompScoreCreate = CompetitionScoreCreate

class ScoreResponse(BaseModel):
    id: int
    member_name: str
    score_value: str
    is_rx: bool
    scale_rank: Optional[str]
    is_time_cap: bool
    is_time_cap: bool
    tie_break: Optional[str] = None
    note: Optional[str] = None
    status: str = "pending" # ✅ [신규] 기록 검증 상태
    model_config = ConfigDict(from_attributes=True)

class CompLeaderboardItem(BaseModel):
    rank: int
    member_name: str
    score_value: str
    is_rx: bool
    scale_rank: Optional[str]
    is_time_cap: bool
    tie_break: Optional[str] = None
    tie_break: Optional[str] = None
    note: Optional[str] = None
    gender: Optional[str] = None # ✅ [신규] 리더보드 필터링용 (M/F)
    gym_name: Optional[str] = None # ✅ [신규] 소속 박스명
    guest_phone: Optional[str] = None # ✅ [신규] 게스트 전화번호 (동명이인 구분)
    status: str = "pending" # ✅ [신규] 기록 검증 상태

# ... (skip to OverallLeaderboardItem) ...

class OverallLeaderboardItem(BaseModel):
    rank: int
    member_id: Optional[int] = None
    member_name: str
    gender: Optional[str] = None # ✅ [신규] 리더보드 필터링용 (M/F)
    gym_name: Optional[str] = None # ✅ [신규] 소속 박스명
    guest_phone: Optional[str] = None # ✅ [신규] 게스트 전화번호 (동명이인 구분)
    total_points: int
    event_details: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 13. Expenses (지출 관리)
# =========================================================

class ExpenseCreate(BaseModel):
    item_name: str
    amount: int
    category: str
    date: date
    method: str
    memo: str = ""

class ExpenseResponse(BaseModel):
    id: int
    item_name: str
    amount: int
    category: str
    date: date
    method: str
    memo: str = ""
    gym_id: int

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 14. Gym (체육관/지점)
# =========================================================

class GymCreate(BaseModel):
    name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    drop_in_price: Optional[int] = 20000
    description: Optional[str] = None
    drop_in_enabled: bool = True

class GymResponse(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    
    # 구독 정보
    subscription_plan: str
    subscription_start_date: Optional[date] = None
    next_billing_date: Optional[date] = None
    monthly_fee: int
    payment_status: str

    member_count: int = 0
    coach_count: int = 0
    
    # ✅ [신규] 활동 정보 (유령 박스 감지용)
    last_activity_date: Optional[date] = None

    # ✅ [신규] 지도 및 드랍인 정보
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    drop_in_price: Optional[int] = 20000
    description: Optional[str] = None
    drop_in_enabled: bool = True

    model_config = ConfigDict(from_attributes=True)

# ✅ [신규] 회원권 상품 설정 (Product)
# ✅ [신규] 회원권 및 상품 설정 (Product)
class ProductBase(BaseModel):
    category: str = "membership" # membership, goods, food 등
    name: str
    price: int
    months: Optional[int] = None # 회원권이 아니면 None 가능
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    gym_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 15. Class Schedule & Reservation
# =========================================================

class ClassScheduleCreate(BaseModel):
    title: str
    date: date
    time: str
    max_participants: int = 20
    status: str = "open"

class ClassScheduleResponse(BaseModel):
    id: int
    gym_id: int
    title: str
    date: date
    time: str
    max_participants: int
    status: str
    
    # 예약자 수 (계산된 필드용)
    current_participants: int = 0
    # 현재 유저가 예약했는지 여부
    is_reserved: bool = False

    model_config = ConfigDict(from_attributes=True)

class ReservationCreate(BaseModel):
    schedule_id: int

class ReservationResponse(BaseModel):
    id: int
    schedule_id: int
    member_id: int
    member_name: str # Join해서 가져올 예정
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ClassTemplateCreate(BaseModel):
    title: str
    time: str
    max_participants: int = 20
    days_of_week: str # "0,1,2,3,4"

class ClassTemplateResponse(BaseModel):
    id: int
    gym_id: int
    title: str
    time: str
    max_participants: int
    days_of_week: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 11. 알림 (Notification)
# =========================================================

class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    sender_id: Optional[int] = None
    type: str # competition_status, comment, reply, system
    title: str
    message: str
    related_link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

    model_config = ConfigDict(from_attributes=True)

class NotificationBroadcastRequest(BaseModel):
    title: str
    message: str
    target_gym_id: Optional[int] = None # 없으면 요청자의 gym_id 사용
    related_link: Optional[str] = None


# =========================================================
# 20. Notification Template (알림 메시지 템플릿)
# =========================================================
class NotificationTemplateBase(BaseModel):
    type: str
    title: str
    message: str

class NotificationTemplateCreate(NotificationTemplateBase):
    pass

class NotificationTemplateUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None

class NotificationTemplateResponse(NotificationTemplateBase):
    id: int
    gym_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 16. Drop-In (드랍인)
# =========================================================

class DropInCreate(BaseModel):
    gym_id: int
    date: date

class DropInResponse(BaseModel):
    id: int
    gym_id: int
    member_id: int
    member_name: Optional[str] = None # Join 후 채워질 예정
    date: date
    status: str
    gym_name: Optional[str] = None # Join 후 채워질 예정
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DropInStatusUpdate(BaseModel):
    status: str # "confirmed" | "rejected"


# =========================================================
# 19. Diet Log (식단)
# =========================================================

class DietLogCreate(BaseModel):
    date: date
    meal_type: str # Breakfast, Lunch, Dinner, Snack
    content: str
    calories: Optional[int] = None
    carbs: Optional[int] = None
    protein: Optional[int] = None
    fat: Optional[int] = None

class DietLogUpdate(BaseModel):
    date: Optional[date] = None
    meal_type: Optional[str] = None # Breakfast, Lunch, Dinner, Snack
    content: Optional[str] = None
    calories: Optional[int] = None
    carbs: Optional[int] = None
    protein: Optional[int] = None
    fat: Optional[int] = None
    delete_image: bool = False

class DietLogResponse(BaseModel):
    id: int
    member_id: int
    date: date
    meal_type: str
    content: str
    calories: Optional[int]
    carbs: Optional[int] = None
    protein: Optional[int] = None
    fat: Optional[int] = None
    image_url: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DietAnalysisResponse(BaseModel):
    menu_name: str
    calories: int
    carbs: int # 탄수화물 (g)
    protein: int # 단백질 (g)
    fat: int # 지방 (g)
    comment: str



# =========================================================
# 17. POS 결제 (멤버십 자동 연장)
# =========================================================

class SaleCreate(BaseModel):
    member_id: int
    item_name: str
    amount: int
    category: str
    payment_method: str
    status: str = "paid"

class SaleResponse(SaleCreate):
    id: int
    gym_id: int
    status: str
    payment_date: datetime

    model_config = ConfigDict(from_attributes=True)

class SaleCreateWithExtension(SaleCreate):
    extension_months: int # 0이면 연장 안함, 1, 3, 6 등


# =========================================================
# 18. 출석 (Attendance)
# =========================================================

class AttendanceCheckIn(BaseModel):
    phone_last4: Optional[str] = None
    member_id: Optional[int] = None

class AttendanceResponse(BaseModel):
    id: int
    member_id: int
    gym_id: int
    date: date
    check_in_time: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 19. 배지 (Badges)
# =========================================================

class BadgeCreate(BaseModel):
    name: str
    description: str
    icon: str
    criteria: str

class BadgeResponse(BadgeCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 20. Coach Message (1:1 DM)
# =========================================================

class MessageCreate(BaseModel):
    receiver_id: int
    message: str

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str # Join해서 채울 예정
    receiver_id: int
    receiver_name: str # Join해서 채울 예정
    
    message: str
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ✅ [신규] 데일리 리포트 요청/응답
class DailyReportRequest(BaseModel):
    date: date

class DailyReportResponse(BaseModel):
    score: int
    summary: str
    advice: str


# =========================================================
# 21. Coach Permission (부코치 권한)
# =========================================================
class PermissionResponse(BaseModel):
    id: int
    name: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class CoachPermissionResponse(BaseModel):
    id: int
    coach_id: int
    permission_id: int
    permission: PermissionResponse

    model_config = ConfigDict(from_attributes=True)


class SubCoachCreate(BaseModel):
    name: str
    phone: str
    password: str
    hourly_wage: int = 0  # ✅ [추가] 부코치 시급
    class_wage: int = 0   # ✅ [추가] 부코치 수업당 급여
    permission_ids: List[int]  # 선택한 권한 ID 리스트


class SubCoachResponse(BaseModel):
    id: int
    name: str
    phone: str
    gym_id: int
    role: str
    hourly_wage: int = 0  # ✅ [추가] 부코치 시급
    class_wage: int = 0   # ✅ [추가] 부코치 수업당 급여
    permissions: List[PermissionResponse] = []

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# 11. Work Schedule (근무표)
# =========================================================

class WorkScheduleCreate(BaseModel):
    coach_id: int
    date: date
    start_time: str
    end_time: str
    work_category: str = "general" # ✅ [추가] 일반근무(general) vs 수업(class)
    shift_type: str = "regular"
    memo: Optional[str] = None

class WorkScheduleBulkCreate(BaseModel): # ✅ [추가] 일괄 등록용 스키마
    date: date
    schedules: List[WorkScheduleCreate]

class WorkScheduleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    shift_type: Optional[str] = None
    memo: Optional[str] = None
    status: Optional[str] = None


class WorkScheduleResponse(BaseModel):
    id: int
    gym_id: int
    coach_id: int
    coach_name: str
    date: date
    start_time: str
    end_time: str
    work_category: str = "general" # ✅ [추가]
    shift_type: str
    memo: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkScheduleTemplateCreate(BaseModel):
    coach_id: int
    start_time: str
    end_time: str
    shift_type: str = "regular"
    days_of_week: str  # "0,1,2,3,4" (월~금)
    memo: Optional[str] = None


class WorkScheduleTemplateResponse(BaseModel):
    id: int
    gym_id: int
    coach_id: int
    coach_name: str
    start_time: str
    end_time: str
    shift_type: str
    days_of_week: str
    memo: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
