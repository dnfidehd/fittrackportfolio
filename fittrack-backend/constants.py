# fittrack-backend/constants.py
# 전역 상수 및 Enum 정의

from enum import Enum
from typing import Final


# ========== 역할 (Role) ==========
class Role(str, Enum):
    """사용자 역할"""
    USER = "user"
    COACH = "coach"
    SUBCOACH = "subcoach"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


# ========== 회원 상태 ==========
class MemberStatus(str, Enum):
    """회원 상태"""
    ACTIVE = "활성"
    EXPIRED = "만료"
    PAUSED = "일시정지"


# ========== 점수 관련 상수 ==========
class ScoreConstants:
    """점수 계산 관련 상수"""
    TIME_CAP_PENALTY: Final[int] = 1000000  # 타임 캡 패널티
    MAX_SCORE: Final[int] = 999999  # 최대 점수
    MIN_SCORE: Final[float] = 0.0  # 최소 점수


# ========== 대회 상태 ==========
class CompetitionStatus(str, Enum):
    """대회 상태"""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# ========== 대회 참여 상태 ==========
class CompetitionGymStatus(str, Enum):
    """대회 참여 체육관 상태"""
    INVITED = "invited"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PENDING = "pending"


# ========== 대회 등록 상태 ==========
class CompetitionRegistrationStatus(str, Enum):
    """대회 등록 상태"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


# ========== 점수 유형 ==========
class ScoreType(str, Enum):
    """점수 유형"""
    TIME = "time"
    WEIGHT = "weight"
    REPS = "reps"


# ========== 구독 계획 ==========
class SubscriptionPlan(str, Enum):
    """구독 계획"""
    BASIC = "Basic"
    STANDARD = "Standard"
    PREMIUM = "Premium"


# ========== 공지사항 타입 ==========
class PostType(str, Enum):
    """공지사항 유형"""
    GLOBAL = "global"  # 전체 공지
    GYM = "gym"  # 센터 공지
    COMMUNITY = "community"  # 커뮤니티


# ========== 알림 유형 ==========
class NotificationType(str, Enum):
    """알림 유형"""
    COMPETITION_STATUS = "competition_status"
    COMMENT = "comment"
    REPLY = "reply"
    SYSTEM = "system"
    MENTION = "mention"


# ========== 드랍인 예약 상태 ==========
class DropInStatus(str, Enum):
    """드랍인 예약 상태"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


# ========== 권한 체크 메시지 ==========
class AuthMessages:
    """권한 체크 관련 메시지"""
    SUPERADMIN_ONLY = "총관리자 권한이 필요합니다."
    ADMIN_ONLY = "관리자 권한이 필요합니다."
    COACH_ONLY = "코치 권한이 필요합니다."
    ADMIN_OR_COACH = "관리자 또는 코치 권한이 필요합니다."
    GYM_ACCESS_DENIED = "이 체육관에 접근할 수 없습니다."
    NOT_AUTHORIZED = "권한이 없습니다."


# ========== 기본 페이징 설정 ==========
class PaginationDefaults:
    """페이징 기본값"""
    DEFAULT_SKIP: Final[int] = 0
    DEFAULT_LIMIT: Final[int] = 50
    MAX_LIMIT: Final[int] = 1000


# ========== API 응답 코드 ==========
class HTTPStatusCode:
    """HTTP 상태 코드"""
    OK: Final[int] = 200
    CREATED: Final[int] = 201
    BAD_REQUEST: Final[int] = 400
    UNAUTHORIZED: Final[int] = 401
    FORBIDDEN: Final[int] = 403
    NOT_FOUND: Final[int] = 404
    CONFLICT: Final[int] = 409
    INTERNAL_SERVER_ERROR: Final[int] = 500
