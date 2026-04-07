# fittrack-backend/schemas/diet.py
# Diet Log related schemas

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DietLogCreate(BaseModel):
    date: date
    meal_type: str  # Breakfast, Lunch, Dinner, Snack
    content: str
    calories: Optional[int] = None
    carbs: Optional[int] = None
    protein: Optional[int] = None
    fat: Optional[int] = None


class DietLogUpdate(BaseModel):
    date: Optional[date] = None
    meal_type: Optional[str] = None  # Breakfast, Lunch, Dinner, Snack
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
    carbs: int  # 탄수화물 (g)
    protein: int  # 단백질 (g)
    fat: int  # 지방 (g)
    comment: str
