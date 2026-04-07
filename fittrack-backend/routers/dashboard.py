from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect
from datetime import date, timedelta, datetime
from pydantic import BaseModel
from typing import List

from database import get_db
from models import Member, Sale, Attendance, Wod, WodRecord, StaffTask, DropInReservation, Message, MemberCrmFollowUp
from security import get_current_user
from config import settings # DB URL 확인용

router = APIRouter(
    tags=["dashboard"],
    responses={404: {"description": "Not found"}},
)

# ✅ [신규] 할 일 추가용 스키마
class TaskCreate(BaseModel):
    content: str

# ✅ [신규] 할 일 응답용 스키마
class TaskResponse(BaseModel):
    id: int
    content: str
    is_completed: bool
    created_at: str

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 한국 시간 기준 오늘 설정 (UTC+9)
    # 주의: 실제 배포 환경의 타임존 설정에 따라 timedelta 조정이 필요할 수 있습니다.
    today = (datetime.utcnow() + timedelta(hours=9)).date()
    start_of_month = today.replace(day=1)
    inspector = inspect(db.bind)
    has_crm_followups_table = inspector.has_table("member_crm_followups")

    # 1. 기본 통계 (회원, 출석, 매출)
    # ✅ [수정] Active, active, 활성 등 다양한 상태값 대응
    print(f"DEBUG: User Gym ID: {current_user.gym_id}") # Debugging
    active_members_query = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user",
        Member.status.in_(["활성", "active", "Active", "ACTIVE"])
    )
    active_members = active_members_query.count()
    print(f"DEBUG: Active Members Count: {active_members}") # Debugging
    
    today_attendance = db.query(Attendance).filter(Attendance.gym_id == current_user.gym_id, Attendance.date == today).count()
    
    # 이번 달 총 매출
    monthly_sales_query = db.query(func.sum(Sale.amount)).filter(Sale.gym_id == current_user.gym_id, Sale.payment_date >= start_of_month)
    try: monthly_sales_query = monthly_sales_query.filter(Sale.status != 'cancelled')
    except: pass
    monthly_sales = monthly_sales_query.scalar() or 0

    unpaid_member_count = db.query(func.count(func.distinct(Sale.member_id))).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.status == "pending"
    ).scalar() or 0
    unpaid_amount = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.status == "pending"
    ).scalar() or 0

    # ✅ [신규] MRR (월 반복 매출) 추정치 계산
    # 활성 회원 수 * 평균 객단가 (약 150,000원 가정)
    estimated_mrr = active_members * 150000

    # 2. 주간 매출 (최근 7일)
    weekly_sales_data = []
    week_ago = today - timedelta(days=6)
    recent_sales = db.query(Sale).filter(Sale.gym_id == current_user.gym_id, func.date(Sale.payment_date) >= week_ago).all()
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        # datetime 객체에서 date 추출 시 주의
        daily_sum = sum(s.amount for s in recent_sales if (s.payment_date.date() if isinstance(s.payment_date, datetime) else s.payment_date) == target_date)
        weekly_sales_data.append({"date": target_date.strftime("%m-%d"), "sales": daily_sum})

    # ✅ [수정] 3. 월별 매출 추이 (그래프용, 최근 6개월 데이터 확보)
    # 기존 코드에는 이 부분이 명확하지 않아 그래프가 끊길 수 있었습니다.
    six_months_ago = today - timedelta(days=180)
    
    # ✅ [수정] DB 종류에 따른 날짜 포맷 함수 분기 처리
    is_sqlite = "sqlite" in settings.sqlalchemy_database_url
    
    if is_sqlite:
        date_col = func.strftime("%Y-%m", Sale.payment_date).label("month")
    else:
        # PostgreSQL
        date_col = func.to_char(Sale.payment_date, 'YYYY-MM').label("month")

    monthly_trend_query = db.query(
        date_col,
        func.sum(Sale.amount)
    ).filter(
        Sale.gym_id == current_user.gym_id,
        Sale.payment_date >= six_months_ago
    )
    
    # status 컬럼이 있는 경우에만 'paid' 필터 적용 (안전장치)
    try:
        monthly_trend_query = monthly_trend_query.filter(Sale.status == 'paid')
    except:
        pass
        
    monthly_trend_data = monthly_trend_query.group_by("month").order_by("month").all()

    sales_chart_data = [
        {"name": row[0], "revenue": row[1]} for row in monthly_trend_data
    ]

    # 4. 만료 임박 & 최근 가입
    expiry_threshold = today + timedelta(days=10)
    expiring_members = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user",
        Member.status == "활성",
        Member.end_date >= today,
        Member.end_date <= expiry_threshold
    ).order_by(Member.end_date.asc()).all()
    expiring_list = [{"id": m.id, "name": m.name, "days_left": (m.end_date - today).days, "end_date": str(m.end_date)} for m in expiring_members if m.end_date]

    follow_up_member_ids = [member.id for member in expiring_members]
    expiring_action_needed = len(expiring_members)
    if has_crm_followups_table and follow_up_member_ids:
        completed_followup_members = {
            member_id for (member_id,) in db.query(MemberCrmFollowUp.member_id).filter(
                MemberCrmFollowUp.gym_id == current_user.gym_id,
                MemberCrmFollowUp.member_id.in_(follow_up_member_ids),
                MemberCrmFollowUp.status == "completed"
            ).distinct().all()
        }
        expiring_action_needed = sum(1 for member in expiring_members if member.id not in completed_followup_members)

    recent_members = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user"
    ).order_by(Member.join_date.desc()).limit(5).all()
    recent_list = [{"id": m.id, "name": m.name, "join_date": str(m.join_date)} for m in recent_members]

    unread_inquiries = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).count()

    recent_dropin_cutoff = today - timedelta(days=7)
    dropin_followups_needed = 0
    confirmed_reservations = db.query(DropInReservation).filter(
        DropInReservation.gym_id == current_user.gym_id,
        DropInReservation.status == "confirmed",
        DropInReservation.date >= recent_dropin_cutoff,
        DropInReservation.date <= today
    ).all()
    for reservation in confirmed_reservations:
        converted_sale = db.query(Sale.id).filter(
            Sale.gym_id == current_user.gym_id,
            Sale.member_id == reservation.member_id,
            Sale.status == "paid",
            func.date(Sale.payment_date) >= reservation.date
        ).first()
        if not converted_sale:
            dropin_followups_needed += 1

    # 5. 인수인계 할 일 목록 가져오기 (최신순)
    tasks = db.query(StaffTask).filter(StaffTask.gym_id == current_user.gym_id).order_by(StaffTask.created_at.desc()).all()
    staff_tasks = [
        {
            "id": t.id, 
            "content": t.content, 
            "is_completed": t.is_completed, 
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") 
        } 
        for t in tasks
    ]

    return {
        "active_members": active_members,
        "monthly_sales": monthly_sales,
        "today_attendance": today_attendance,
        "expiring_members": expiring_list,
        "recent_members": recent_list,
        "weekly_sales_data": weekly_sales_data,
        "sales_chart": sales_chart_data, # ✅ 6개월치 그래프 데이터 추가 반환
        "staff_tasks": staff_tasks,
        "estimated_mrr": estimated_mrr,  # ✅ 신규 필드 추가
        "action_items": {
            "unpaid_members_count": unpaid_member_count,
            "unpaid_amount": unpaid_amount,
            "expiring_followups_count": expiring_action_needed,
            "dropin_followups_count": dropin_followups_needed,
            "unread_inquiries_count": unread_inquiries,
        }
    }

# ==========================
# ✅ [신규] 인수인계 보드용 API
# ==========================

# 1. 할 일 추가
@router.post("/tasks")
def create_staff_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    new_task = StaffTask(
        gym_id=current_user.gym_id,
        content=task.content,
        is_completed=False,
        created_at=datetime.now()
    )
    db.add(new_task)
    db.commit()
    return {"message": "등록되었습니다."}

# 2. 체크박스 토글 (완료/미완료)
@router.put("/tasks/{task_id}/toggle")
def toggle_staff_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    task = db.query(StaffTask).filter(StaffTask.id == task_id, StaffTask.gym_id == current_user.gym_id).first()
    if not task: raise HTTPException(status_code=404, detail="Not found")
    
    task.is_completed = not task.is_completed # 상태 반전
    db.commit()
    return {"message": "상태가 변경되었습니다."}

# 3. 할 일 삭제
@router.delete("/tasks/{task_id}")
def delete_staff_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    task = db.query(StaffTask).filter(StaffTask.id == task_id, StaffTask.gym_id == current_user.gym_id).first()
    if not task: raise HTTPException(status_code=404, detail="Not found")
    
    db.delete(task)
    db.commit()
    return {"message": "삭제되었습니다."}
