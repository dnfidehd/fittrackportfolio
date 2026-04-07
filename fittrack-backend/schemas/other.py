# fittrack-backend/schemas/other.py
# Miscellaneous schemas

from datetime import date
from pydantic import BaseModel


# ✅ [신규] 데일리 리포트 요청/응답
class DailyReportRequest(BaseModel):
    date: date


class DailyReportResponse(BaseModel):
    score: int
    summary: str
    advice: str
