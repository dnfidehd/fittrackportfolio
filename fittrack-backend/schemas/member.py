# fittrack-backend/schemas/member.py
# Member-related schemas

from datetime import datetime, date
from typing import Optional, List, Union
from pydantic import BaseModel, ConfigDict

from .permission import PermissionResponse


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
    color: Optional[str] = "#3182F6" # ✅ [추가] 코치 고유 색상

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
    color: Optional[str] = None # ✅ [추가]

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
    color: Optional[str] = None # ✅ [추가]
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
    color: Optional[str] = "#3182F6" # ✅ [추가]

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
    unpaid_amount: Optional[int] = 0
    unpaid_sales_count: Optional[int] = 0
    last_attendance_date: Optional[date] = None
    days_since_last_attendance: Optional[int] = None
    expiring_soon: Optional[bool] = False

    # ✅ [신규] 멀티 박스 지원: 내가 가입된 체육관 목록
    available_gyms: Optional[list] = []

    # ✅ [신규] 부코치 권한 정보
    permissions: Optional[List['PermissionResponse']] = []

    model_config = ConfigDict(from_attributes=True)


class MemberPaginationResponse(BaseModel):
    total: int
    members: List[MemberResponse]
