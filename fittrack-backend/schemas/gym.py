# fittrack-backend/schemas/gym.py
# Gym (체육관) related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class GymCreate(BaseModel):
    name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    drop_in_price: Optional[int] = 20000
    description: Optional[str] = None
    drop_in_enabled: bool = True


class GymUpdate(GymCreate):
    subscription_plan: str = "Standard"
    subscription_start_date: Optional[date] = None
    next_billing_date: Optional[date] = None
    monthly_fee: int = 199000
    payment_status: str = "paid"


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
    category: str = "membership"  # membership, goods, food 등
    name: str
    price: int
    months: Optional[int] = None  # 회원권이 아니면 None 가능
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    gym_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
