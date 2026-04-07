# fittrack-backend/schemas/permission.py
# Coach Permission and Sub-Coach related schemas

from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict


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
    color: str = "#3182F6"
    permission_ids: List[int]  # 선택한 권한 ID 리스트


class SubCoachResponse(BaseModel):
    id: int
    name: str
    phone: str
    gym_id: int
    role: str
    hourly_wage: int = 0  # ✅ [추가] 부코치 시급
    class_wage: int = 0   # ✅ [추가] 부코치 수업당 급여
    color: str = "#3182F6"
    permissions: List[PermissionResponse] = []

    model_config = ConfigDict(from_attributes=True)
