# fittrack-backend/schemas/competition.py
# Competition-related schemas

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


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
    guest_passcode: Optional[str] = None  # ✅ [신규] 게스트용 패스코드
    allow_invited_gym_settings: bool = False  # ✅ [신규] 초대된 박스 어드민도 설정 변경 허용


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
    guest_passcode: Optional[str] = None  # ✅ [신규] 게스트용 패스코드 (수정용)
    allow_invited_gym_settings: Optional[bool] = None  # ✅ [신규]

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
    status: str  # pending, accepted, rejected
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
    guest_passcode: Optional[str] = None  # ✅ [신규] 게스트용 패스코드
    creator_id: Optional[int] = None
    allow_invited_gym_settings: bool = False  # ✅ [신규]

    # ✅ [신규] 총관리자 설정용 데이터 포함
    sort_order: Optional[int] = None
    is_hidden: bool = False

    participating_gyms: List[CompetitionGymResponse] = []
    admin_names: List[str] = []  # ✅ [신규] 대회 관리자(코치) 이름 목록

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
    member_name: Optional[str] = None  # ✅ [신규] 게스트 등록 시 사용
    guest_gender: Optional[str] = None  # ✅ [신규] M/F
    guest_phone: Optional[str] = None  # ✅ [신규]
    guest_gym: Optional[str] = None  # ✅ [신규]
    status: Optional[str] = "pending"  # ✅ [신규] 기록 검증 상태


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
    status: str = "pending"  # ✅ [신규] 기록 검증 상태
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
    gender: Optional[str] = None  # ✅ [신규] 리더보드 필터링용 (M/F)
    gym_name: Optional[str] = None  # ✅ [신규] 소속 박스명
    guest_phone: Optional[str] = None  # ✅ [신규] 게스트 전화번호 (동명이인 구분)
    status: str = "pending"  # ✅ [신규] 기록 검증 상태


class OverallLeaderboardItem(BaseModel):
    rank: int
    member_id: Optional[int] = None
    member_name: str
    gender: Optional[str] = None  # ✅ [신규] 리더보드 필터링용 (M/F)
    gym_name: Optional[str] = None  # ✅ [신규] 소속 박스명
    guest_phone: Optional[str] = None  # ✅ [신규] 게스트 전화번호 (동명이인 구분)
    total_points: int
    event_details: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)
