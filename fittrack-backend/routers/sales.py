from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc
from typing import List, Dict, Optional
from datetime import date, datetime, timedelta
import pandas as pd
from io import BytesIO
from pydantic import BaseModel, ConfigDict

from database import get_db
from security import get_current_user, require_permission
from models import Sale, Member, Expense, MembershipProduct
from schemas import SaleCreateWithExtension

# ✅ [수정] SaleCreate와 SaleResponse는 이 파일에 정의되어 있음 (충돌 주의)
from config import settings # ✅ DB URL 확인용
from dateutil.relativedelta import relativedelta # ✅ 날짜 계산용
router = APIRouter(
    tags=["sales"],
    responses={404: {"description": "Not found"}},
)


def get_month_bounds(target: date) -> tuple[datetime, datetime]:
    start_date = datetime(target.year, target.month, 1)
    if target.month == 12:
        end_date = datetime(target.year + 1, 1, 1)
    else:
        end_date = datetime(target.year, target.month + 1, 1)
    return start_date, end_date


def get_member_in_gym(member_id: int, gym_id: int, db: Session) -> Member:
    member = db.query(Member).filter(
        Member.id == member_id,
        Member.gym_id == gym_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return member


def get_active_membership_product(
    gym_id: int,
    item_name: str,
    db: Session,
    *,
    expected_months: Optional[int] = None,
) -> MembershipProduct:
    query = db.query(MembershipProduct).filter(
        MembershipProduct.gym_id == gym_id,
        MembershipProduct.name == item_name,
        MembershipProduct.category == "membership",
        MembershipProduct.is_active.is_(True),
    )
    if expected_months is not None:
        query = query.filter(MembershipProduct.months == expected_months)

    product = query.first()
    if not product:
        raise HTTPException(
            status_code=400,
            detail="유효한 회원권 상품을 찾을 수 없습니다. 설정된 회원권 상품과 기간을 확인해주세요.",
        )
    return product


def resolve_sale_amount(
    *,
    gym_id: int,
    item_name: str,
    category: str,
    requested_amount: int,
    db: Session,
    extension_months: Optional[int] = None,
) -> int:
    if category == "membership" or (extension_months is not None and extension_months > 0):
        product = get_active_membership_product(
            gym_id,
            item_name,
            db,
            expected_months=extension_months if extension_months and extension_months > 0 else None,
        )
        return product.price
    return requested_amount

# ---------------------------------------------------------
# ✅ 데이터 모델 정의
# ---------------------------------------------------------
class SaleCreate(BaseModel):
    member_id: int
    item_name: str
    amount: int
    category: str
    payment_method: str
    status: str = "paid" 

class SaleResponse(BaseModel):
    id: int
    # ✅ [수정] 데이터가 비어있을 경우를 대비해 Optional 처리
    member_id: Optional[int] 
    member_name: str
    item_name: str
    amount: int
    category: str
    payment_method: str
    status: str
    payment_date: datetime
    gym_id: int

    model_config = ConfigDict(from_attributes=True)

# ---------------------------------------------------------
# 📊 KPI 요약
# ---------------------------------------------------------
@router.get("/stats/summary")
def get_sales_summary(
    current_user: Member = Depends(require_permission("sales")), 
    db: Session = Depends(get_db)
):
    today = date.today()
    start_date, end_date = get_month_bounds(today)
    previous_month_day = today.replace(day=1) - timedelta(days=1)
    previous_start_date, previous_end_date = get_month_bounds(previous_month_day)

    current_month_sales = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= start_date,
        Sale.payment_date < end_date,
        Sale.status == 'paid'
    ).scalar() or 0

    previous_month_sales = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= previous_start_date,
        Sale.payment_date < previous_end_date,
        Sale.status == 'paid'
    ).scalar() or 0

    total_unpaid = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.status == 'pending'
    ).scalar() or 0

    current_month_unpaid = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= start_date,
        Sale.payment_date < end_date,
        Sale.status == 'pending'
    ).scalar() or 0

    current_month_refunds = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= start_date,
        Sale.payment_date < end_date,
        Sale.status == 'cancelled'
    ).scalar() or 0

    active_members_count = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user",
        Member.status == "활성"
    ).count()

    arpu = int(current_month_sales / active_members_count) if active_members_count > 0 else 0

    current_month_paid_sales = db.query(Sale).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= start_date,
        Sale.payment_date < end_date,
        Sale.status == 'paid',
        Sale.member_id.isnot(None)
    ).all()

    member_ids = list({sale.member_id for sale in current_month_paid_sales if sale.member_id})
    previous_sale_counts = {}
    if member_ids:
        previous_sale_counts = dict(
            db.query(Sale.member_id, func.count(Sale.id))
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.member_id.in_(member_ids),
                Sale.payment_date < start_date,
                Sale.status == 'paid'
            )
            .group_by(Sale.member_id)
            .all()
        )

    new_member_revenue = 0
    renewal_revenue = 0
    for sale in current_month_paid_sales:
        if previous_sale_counts.get(sale.member_id, 0) > 0:
            renewal_revenue += sale.amount
        else:
            new_member_revenue += sale.amount

    month_over_month_change_pct = 0.0
    if previous_month_sales > 0:
        month_over_month_change_pct = round(((current_month_sales - previous_month_sales) / previous_month_sales) * 100, 1)
    elif current_month_sales > 0:
        month_over_month_change_pct = 100.0

    expiry_threshold = today + timedelta(days=30)
    expiring_members = []
    members_near_expiry = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user",
        Member.end_date.isnot(None),
        Member.end_date >= today,
        Member.end_date <= expiry_threshold
    ).order_by(Member.end_date.asc()).all()

    for member in members_near_expiry:
        expiring_members.append({
            "id": member.id,
            "name": member.name,
            "phone": member.phone,
            "membership": member.membership,
            "end_date": member.end_date.isoformat() if member.end_date else None,
            "days_left": (member.end_date - today).days if member.end_date else None,
            "status": member.status
        })

    return {
        "month_revenue": current_month_sales,
        "previous_month_revenue": previous_month_sales,
        "month_over_month_change_pct": month_over_month_change_pct,
        "unpaid_amount": total_unpaid,
        "monthly_unpaid_amount": current_month_unpaid,
        "refund_amount": current_month_refunds,
        "active_members": active_members_count,
        "arpu": arpu,
        "new_member_revenue": new_member_revenue,
        "renewal_revenue": renewal_revenue,
        "expiring_members": expiring_members
    }

# ---------------------------------------------------------
# ✅ 매출 등록
# ---------------------------------------------------------
@router.post("/", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, current_user: Member = Depends(require_permission("sales")), db: Session = Depends(get_db)):
    member = get_member_in_gym(sale_data.member_id, current_user.gym_id, db)
    resolved_amount = resolve_sale_amount(
        gym_id=current_user.gym_id,
        item_name=sale_data.item_name,
        category=sale_data.category,
        requested_amount=sale_data.amount,
        db=db,
    )

    db_sale = Sale(
        member_id=sale_data.member_id,
        item_name=sale_data.item_name,
        amount=resolved_amount,
        category=sale_data.category,
        payment_method=sale_data.payment_method,
        status=sale_data.status,
        gym_id=current_user.gym_id
    )
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    
    return SaleResponse(
        id=db_sale.id,
        member_id=db_sale.member_id,
        member_name=member.name,
        item_name=db_sale.item_name,
        amount=db_sale.amount,
        category=db_sale.category,
        payment_method=db_sale.payment_method,
        status=db_sale.status,
        payment_date=db_sale.payment_date,
        gym_id=db_sale.gym_id
    )

# ---------------------------------------------------------
# ✅ 수납 상태 변경
# ---------------------------------------------------------
@router.put("/{sale_id}/status")
def update_sale_status(
    sale_id: int, 
    status: str = Body(..., embed=True), 
    current_user: Member = Depends(require_permission("sales")), 
    db: Session = Depends(get_db)
):
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.gym_id == current_user.gym_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="매출 기록을 찾을 수 없습니다.")
    
    sale.status = status
    db.commit()
    sale.status = status
    db.commit()
    return {"message": "상태가 변경되었습니다."}


# ---------------------------------------------------------
# ✅ [신규] POS 결제 (멤버십 자동 연장)
# ---------------------------------------------------------
@router.post("/with-extension", response_model=SaleResponse)
def create_sale_with_extension(
    sale_data: SaleCreateWithExtension, 
    current_user: Member = Depends(require_permission("sales")), 
    db: Session = Depends(get_db)
):
    """
    매출 기록 생성 + 멤버십 기간 자동 연장 (Transaction)
    """
    
    # 1. 회원 조회
    member = get_member_in_gym(sale_data.member_id, current_user.gym_id, db)
    resolved_amount = resolve_sale_amount(
        gym_id=current_user.gym_id,
        item_name=sale_data.item_name,
        category=sale_data.category,
        requested_amount=sale_data.amount,
        db=db,
        extension_months=sale_data.extension_months,
    )

    # 2. 매출 기록 생성
    db_sale = Sale(
        member_id=sale_data.member_id,
        item_name=sale_data.item_name,
        amount=resolved_amount,
        category=sale_data.category,
        payment_method=sale_data.payment_method,
        status=sale_data.status,
        gym_id=current_user.gym_id
    )
    db.add(db_sale)

    # 3. 멤버십 기간 자동 연장
    if sale_data.extension_months > 0 and sale_data.status == 'paid':
        today = date.today()
        
        # 기존 만료일이 있고 오늘보다 미래라면 거기서부터 연장
        if member.end_date and member.end_date >= today:
            new_end_date = member.end_date + relativedelta(months=sale_data.extension_months)
        else:
            # 만료되었거나 없으면 오늘부터 시작
            member.start_date = today
            new_end_date = today + relativedelta(months=sale_data.extension_months)
        
        member.end_date = new_end_date
        member.membership = sale_data.item_name # 이용권 이름 업데이트
        member.status = "활성" # 활성 상태로 변경

    db.commit()
    db.refresh(db_sale)
    
    return SaleResponse(
        id=db_sale.id,
        member_id=db_sale.member_id,
        member_name=member.name,
        item_name=db_sale.item_name,
        amount=db_sale.amount,
        category=db_sale.category,
        payment_method=db_sale.payment_method,
        status=db_sale.status,
        payment_date=db_sale.payment_date,
        gym_id=db_sale.gym_id
    )

# ---------------------------------------------------------
# 📥 엑셀 다운로드 (매출 + 지출 통합)
# ---------------------------------------------------------
@router.get("/export")
def export_sales_excel(
    current_user: Member = Depends(require_permission("sales")), 
    db: Session = Depends(get_db)
):

    # 1. 매출 데이터 조회
    sales_query = (
        db.query(
            Sale.payment_date,
            Member.name.label("member_name"),
            Sale.item_name,
            Sale.category,
            Sale.amount,
            Sale.payment_method,
            Sale.status
        )
        .join(Member, Sale.member_id == Member.id)
        .filter(Sale.gym_id == current_user.gym_id)
        .order_by(Sale.payment_date.desc())
        .all()
    )

    sales_data = []
    for s in sales_query:
        status_text = "결제완료" if s.status == "paid" else "미수금" if s.status == "pending" else s.status
        sales_data.append({
            "거래일시": s.payment_date.strftime("%Y-%m-%d %H:%M"),
            "회원명": s.member_name,
            "상품명": s.item_name,
            "카테고리": s.category,
            "금액": s.amount,
            "결제수단": s.payment_method,
            "상태": status_text
        })
    
    df_sales = pd.DataFrame(sales_data)

    # 2. 지출 데이터 조회
    expenses_query = (
        db.query(Expense)
        .filter(Expense.gym_id == current_user.gym_id)
        .order_by(Expense.date.desc())
        .all()
    )

    expenses_data = []
    for e in expenses_query:
        expenses_data.append({
            "날짜": e.date,
            "항목명": e.item_name,
            "카테고리": e.category,
            "금액": e.amount,
            "결제수단": e.method,
            "메모": e.memo
        })
    
    df_expenses = pd.DataFrame(expenses_data)

    # 3. 엑셀 파일 생성
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if not df_sales.empty:
            df_sales.to_excel(writer, index=False, sheet_name='💰매출내역')
        else:
            pd.DataFrame(["매출 내역 없음"]).to_excel(writer, index=False, sheet_name='💰매출내역')
            
        if not df_expenses.empty:
            df_expenses.to_excel(writer, index=False, sheet_name='💸지출내역')
        else:
            pd.DataFrame(["지출 내역 없음"]).to_excel(writer, index=False, sheet_name='💸지출내역')
    
    output.seek(0)
    filename = f"FitTrack_Finance_{datetime.now().strftime('%Y%m%d')}.xlsx"
    headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ---------------------------------------------------------
# 📈 상세 통계
# ---------------------------------------------------------
@router.get("/stats/advanced")
def get_advanced_sales_stats(current_user: Member = Depends(require_permission("sales")), db: Session = Depends(get_db)):
    today = date.today()
    start_date, end_date = get_month_bounds(today)

    category_stats = db.query(Sale.category, func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.status == 'paid',
        Sale.payment_date >= start_date,
        Sale.payment_date < end_date
    ).group_by(Sale.category).all()
    by_category = [{"name": cat, "value": amount} for cat, amount in category_stats]

    six_months_ago = today - timedelta(days=180)
    
    # ✅ [수정] DB 종류에 따른 날짜 포맷 함수 분기 처리
    is_sqlite = "sqlite" in settings.sqlalchemy_database_url
    if is_sqlite:
        date_col = func.strftime("%Y-%m", Sale.payment_date).label("month")
    else:
        date_col = func.to_char(Sale.payment_date, 'YYYY-MM').label("month")

    monthly_stats = db.query(date_col, func.sum(Sale.amount)).filter(Sale.gym_id == current_user.gym_id, Sale.payment_date >= six_months_ago, Sale.status == 'paid').group_by("month").order_by("month").all()
    by_month = [{"name": month, "revenue": amount} for month, amount in monthly_stats]

    return {"byCategory": by_category, "byMonth": by_month, "totalRevenue": sum([item['value'] for item in by_category])}

# ---------------------------------------------------------
# 📋 목록 조회
# ---------------------------------------------------------
@router.get("/", response_model=List[SaleResponse])
def get_sales(
    year: int = None, 
    month: int = None, 
    current_user: Member = Depends(require_permission("sales")), 
    db: Session = Depends(get_db)
):
    
    query = db.query(Sale).filter(Sale.gym_id == current_user.gym_id)
    
    if year and month:
        import calendar
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
        query = query.filter(Sale.payment_date >= start_date, Sale.payment_date <= end_date)
    
    sales = query.order_by(Sale.payment_date.desc()).all()
    
    results = []
    for sale in sales:
        results.append(SaleResponse(
            id=sale.id,
            # ✅ [핵심 수정] member_id가 None이면 0으로 처리 (에러 방지)
            member_id=sale.member_id or 0,
            member_name=sale.member.name if sale.member else "삭제된 회원",
            item_name=sale.item_name,
            amount=sale.amount,
            category=sale.category,
            payment_method=sale.payment_method,
            status=sale.status,
            payment_date=sale.payment_date,
            gym_id=sale.gym_id
        ))

    return results

# 삭제 API
@router.delete("/{sale_id}")
def delete_sale(sale_id: int, current_user: Member = Depends(require_permission("sales")), db: Session = Depends(get_db)):

    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.gym_id == current_user.gym_id).first()
    if not sale: raise HTTPException(status_code=404, detail="Not found")
    db.delete(sale)
    db.commit()
    return {"message": "삭제되었습니다."}
