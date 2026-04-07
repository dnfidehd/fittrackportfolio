# fittrack-backend/schemas/__init__.py
# Re-export all schemas for backward compatibility

# Auth schemas
from .auth import Token, TokenData, PasswordChange, LoginRequest

# Member schemas
from .member import (
    MemberBase,
    MemberCreate,
    MemberUpdate,
    MemberProfileUpdate,
    MemberResponse,
    MemberPaginationResponse,
)

# Membership schemas
from .membership import HoldCreate, HoldStatusResponse, HoldResponse

# WOD schemas
from .wod import WodCreate, WodResponse, WodRecordCreate, WodRecordResponse

# Workout schemas
from .workout import (
    WorkoutCreate,
    WorkoutUpdate,
    WorkoutResponse,
    PRCreate,
    PRResponse,
)

# Community schemas
from .community import CommentCreate, CommentResponse, PostCreate, PostResponse

# Competition schemas
from .competition import (
    CompetitionCreate,
    CompetitionUpdate,
    CompetitionGymCreate,
    CompetitionGymResponse,
    CompetitionResponse,
    CompetitionEventCreate,
    CompEventCreate,
    CompetitionEventResponse,
    CompEventResponse,
    CompetitionScoreCreate,
    CompScoreCreate,
    ScoreResponse,
    CompLeaderboardItem,
    OverallLeaderboardItem,
)

# Gym schemas
from .gym import (
    GymCreate,
    GymUpdate,
    GymResponse,
    ProductBase,
    ProductCreate,
    ProductResponse,
)

# Class schemas
from .classes import (
    ClassScheduleCreate,
    ClassScheduleResponse,
    ReservationCreate,
    ReservationResponse,
    ClassTemplateCreate,
    ClassTemplateResponse,
)

# Notification schemas
from .notification import (
    NotificationResponse,
    NotificationBroadcastRequest,
    NotificationTemplateBase,
    NotificationTemplateCreate,
    NotificationTemplateUpdate,
    NotificationTemplateResponse,
)

# DropIn schemas
from .dropin import DropInCreate, DropInResponse, DropInStatusUpdate

# Diet schemas
from .diet import (
    DietLogCreate,
    DietLogUpdate,
    DietLogResponse,
    DietAnalysisResponse,
)

# Sales and Expense schemas
from .sales import (
    SaleCreate,
    SaleResponse,
    SaleCreateWithExtension,
    ExpenseCreate,
    ExpenseResponse,
)

# Attendance schemas
from .attendance import AttendanceCheckIn, AttendanceResponse, TodayAttendanceResponse

# Badge schemas
from .badge import BadgeCreate, BadgeResponse

# Messaging schemas
from .messaging import MessageCreate, MessageResponse, ConversationResponse

# Schedule schemas
from .schedule import (
    WorkScheduleCreate,
    WorkScheduleBulkCreate,
    WorkScheduleUpdate,
    WorkScheduleResponse,
    WorkScheduleTemplateCreate,
    WorkScheduleTemplateResponse,
)

# Permission schemas
from .permission import (
    PermissionResponse,
    CoachPermissionResponse,
    SubCoachCreate,
    SubCoachResponse,
)

# Coaching Class schemas
from .coaching_class import (
    CoachingClassCreate,
    CoachingClassUpdate,
    CoachingClassResponse,
    CoachingClassAssignmentCreate,
    CoachingClassAssignmentResponse,
    CoachingClassAssignmentWithDetails,
    CoachingClassCalendarItem,
)

# Other schemas
from .other import DailyReportRequest, DailyReportResponse

# Re-export all for backward compatibility
__all__ = [
    # Auth
    "Token",
    "TokenData",
    "PasswordChange",
    "LoginRequest",
    # Member
    "MemberBase",
    "MemberCreate",
    "MemberUpdate",
    "MemberProfileUpdate",
    "MemberResponse",
    "MemberPaginationResponse",
    # Membership
    "HoldCreate",
    "HoldStatusResponse",
    "HoldResponse",
    # WOD
    "WodCreate",
    "WodResponse",
    "WodRecordCreate",
    "WodRecordResponse",
    # Workout
    "WorkoutCreate",
    "WorkoutUpdate",
    "WorkoutResponse",
    "PRCreate",
    "PRResponse",
    # Community
    "CommentCreate",
    "CommentResponse",
    "PostCreate",
    "PostResponse",
    # Competition
    "CompetitionCreate",
    "CompetitionUpdate",
    "CompetitionGymCreate",
    "CompetitionGymResponse",
    "CompetitionResponse",
    "CompetitionEventCreate",
    "CompEventCreate",
    "CompetitionEventResponse",
    "CompEventResponse",
    "CompetitionScoreCreate",
    "CompScoreCreate",
    "ScoreResponse",
    "CompLeaderboardItem",
    "OverallLeaderboardItem",
    # Gym
    "GymCreate",
    "GymUpdate",
    "GymResponse",
    "ProductBase",
    "ProductCreate",
    "ProductResponse",
    # Class
    "ClassScheduleCreate",
    "ClassScheduleResponse",
    "ReservationCreate",
    "ReservationResponse",
    "ClassTemplateCreate",
    "ClassTemplateResponse",
    # Notification
    "NotificationResponse",
    "NotificationBroadcastRequest",
    "NotificationTemplateBase",
    "NotificationTemplateCreate",
    "NotificationTemplateUpdate",
    "NotificationTemplateResponse",
    # DropIn
    "DropInCreate",
    "DropInResponse",
    "DropInStatusUpdate",
    # Diet
    "DietLogCreate",
    "DietLogUpdate",
    "DietLogResponse",
    "DietAnalysisResponse",
    # Sales & Expense
    "SaleCreate",
    "SaleResponse",
    "SaleCreateWithExtension",
    "ExpenseCreate",
    "ExpenseResponse",
    # Attendance
    "AttendanceCheckIn",
    "AttendanceResponse",
    "TodayAttendanceResponse",
    # Badge
    "BadgeCreate",
    "BadgeResponse",
    # Messaging
    "MessageCreate",
    "MessageResponse",
    "ConversationResponse",
    # Schedule
    "WorkScheduleCreate",
    "WorkScheduleBulkCreate",
    "WorkScheduleUpdate",
    "WorkScheduleResponse",
    "WorkScheduleTemplateCreate",
    "WorkScheduleTemplateResponse",
    # Permission
    "PermissionResponse",
    "CoachPermissionResponse",
    "SubCoachCreate",
    "SubCoachResponse",
    # Coaching Class
    "CoachingClassCreate",
    "CoachingClassUpdate",
    "CoachingClassResponse",
    "CoachingClassAssignmentCreate",
    "CoachingClassAssignmentResponse",
    "CoachingClassAssignmentWithDetails",
    "CoachingClassCalendarItem",
    # Other
    "DailyReportRequest",
    "DailyReportResponse",
]
