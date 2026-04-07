from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import date
from pydantic import BaseModel, ConfigDict # ConfigDict 추가

from database import get_db
from security import get_current_user
from models import Expense, Member
from utils.auth import require_coach_or_subcoach

router = APIRouter(
    tags=["expenses"],
    responses={404: {"description": "Not found"}},
)

# --- 데이터 모델 ---
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

    # Pydantic V2 대응 수정 (orm_mode -> from_attributes)
    model_config = ConfigDict(from_attributes=True)

# --- API 기능 ---

# 1. 지출 등록
@router.post("/", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, current_user: Member = Depends(require_coach_or_subcoach), db: Session = Depends(get_db)):
    db_expense = Expense(
        gym_id=current_user.gym_id,
        item_name=expense.item_name,
        amount=expense.amount,
        category=expense.category,
        date=expense.date,
        method=expense.method,
        memo=expense.memo
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

# 2. 지출 목록 조회
@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(
    year: int = None, 
    month: int = None, 
    current_user: Member = Depends(require_coach_or_subcoach), 
    db: Session = Depends(get_db)
):
    query = db.query(Expense).filter(Expense.gym_id == current_user.gym_id)
    
    if year and month:
        import calendar
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
        query = query.filter(Expense.date >= start_date, Expense.date <= end_date)
    
    return query.order_by(Expense.date.desc()).all()

# 3. 지출 삭제
@router.delete("/{expense_id}")
def delete_expense(expense_id: int, current_user: Member = Depends(require_coach_or_subcoach), db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.gym_id == current_user.gym_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="지출 내역을 찾을 수 없습니다.")
        
    db.delete(expense)
    db.commit()
    return {"message": "삭제되었습니다."}
