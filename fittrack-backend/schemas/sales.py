# fittrack-backend/schemas/sales.py
# Sales (POS) and Expense related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


# =========================================================
# Sales (판매 기록)
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
    extension_months: int  # 0이면 연장 안함, 1, 3, 6 등


# =========================================================
# Expenses (지출 관리)
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
