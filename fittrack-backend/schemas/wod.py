# fittrack-backend/schemas/wod.py
# WOD (Workout of the Day) related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class WodCreate(BaseModel):
    date: str
    title: str
    content: str
    description: Optional[str] = None  # ✅ [신규] 참고사항
    youtube_url: Optional[str] = None
    score_type: str = "time"
    is_rest_day: bool = False  # ✅ 휴무일 여부 추가

    # ✅ [신규] 팀 와드 설정
    is_team: bool = False
    team_size: Optional[int] = None


class WodResponse(BaseModel):
    id: int
    gym_id: Optional[int] = None
    date: date
    title: str
    content: str
    description: Optional[str] = None  # ✅ [신규] 참고사항
    youtube_url: Optional[str] = None
    score_type: str
    is_rest_day: bool = False  # ✅ 휴무일 여부 추가

    # ✅ [신규] 팀 와드 설정
    is_team: bool
    team_size: Optional[int] = None

    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WodRecordCreate(BaseModel):
    wod_id: int
    record_value: str
    is_rx: bool = False
    scale_rank: Optional[str] = None  # A, B, C or null
    is_time_cap: Optional[bool] = False  # Time Cap(미완주) 여부
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
