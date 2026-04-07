from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect
from datetime import date, timedelta, datetime
from database import get_db
from pydantic import BaseModel
from models import Member, Attendance, Notification, NotificationTemplate, MemberCrmFollowUp
from security import require_permission

router = APIRouter(
    prefix="/api/crm",
    tags=["CRM"],
)


def has_crm_followups_table(db: Session) -> bool:
    return inspect(db.bind).has_table("member_crm_followups")


class FollowUpUpdateRequest(BaseModel):
    member_id: int
    trigger_type: str
    status: str
    note: str = ""
    contact_method: str | None = None


FOLLOW_UP_ALLOWED_STATUSES = {"pending", "contacted", "completed", "on_hold", "no_response"}

def substitute_template_variables(template_text: str, variables: dict) -> str:
    """템플릿 변수 치환"""
    result = template_text
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", str(value))
    return result

def get_notification_template(db: Session, gym_id: int, template_type: str):
    """템플릿 조회, 없으면 기본 템플릿 반환 (fallback)"""
    template = db.query(NotificationTemplate).filter(
        NotificationTemplate.gym_id == gym_id,
        NotificationTemplate.type == template_type
    ).first()

    if not template:
        from routers.settings import get_default_template_config
        default_config = get_default_template_config()
        if template_type in default_config:
            return default_config[template_type]
        else:
            return {"title": "알림", "message": "내용"}

    return {"title": template.title, "message": template.message}

@router.post("/run-daily-check")
def run_daily_crm_check(db: Session = Depends(get_db)):
    """
    일일 CRM 체크를 실행합니다.
    1. 7일 이상 미출석 회원에게 안부 알림
    2. 만료 7일전, 3일전 회원에게 알림
    """
    today = date.today()
    alerts_sent = 0
    can_store_followups = has_crm_followups_table(db)
    
    # --- 1. 유령 회원 감지 (7일 이상 미출석) ---
    # 활성 회원 조회
    active_members = db.query(Member).filter(
        Member.status.in_(["active", "Active", "ACTIVE", "활성"])
    ).all()
    
    for member in active_members:
        # 최근 출석일 조회
        last_attendance = db.query(func.max(Attendance.date)).filter(
            Attendance.member_id == member.id
        ).scalar()
        
        should_alert = False
        days_since = 0
        
        if last_attendance:
            days_since = (today - last_attendance).days
            if days_since >= 7:
                should_alert = True
        else:
            # 1-1. 출석 기록이 없는 경우 (가입일 기준 체크)
            # 가입한 지 7일이 지났는데 출석이 없으면 독려 메시지
            if member.join_date:
                days_since_join = (today - member.join_date).days
                if days_since_join >= 7:
                    should_alert = True
                    days_since = days_since_join # 메시지용 변수 재활용

        if should_alert:
            # 오늘 이미 알림을 보냈는지 확인 (중복 방지)
            template_type = "inactivity_no_checkin" if not last_attendance else "inactivity_7days"
            existing_noti = db.query(Notification).filter(
                Notification.recipient_id == member.id,
                Notification.type == template_type,
                func.date(Notification.created_at) == today
            ).first()

            if not existing_noti:
                # 템플릿 조회
                template = get_notification_template(db, member.gym_id, template_type)

                # 변수 치환
                if last_attendance:
                    variables = {
                        "member_name": member.name,
                        "days_since": days_since
                    }
                else:
                    variables = {
                        "member_name": member.name,
                        "days_since_join": days_since
                    }

                message = substitute_template_variables(template["message"], variables)

                noti = Notification(
                    recipient_id=member.id,
                    title=template["title"],
                    message=message,
                    type=template_type,
                    created_at=datetime.now()
                )
                db.add(noti)
                if can_store_followups:
                    follow_up = db.query(MemberCrmFollowUp).filter(
                        MemberCrmFollowUp.gym_id == member.gym_id,
                        MemberCrmFollowUp.member_id == member.id,
                        MemberCrmFollowUp.trigger_type == template_type
                    ).first()
                    if not follow_up:
                        db.add(MemberCrmFollowUp(
                            gym_id=member.gym_id,
                            member_id=member.id,
                            trigger_type=template_type,
                            status="pending",
                            note=""
                        ))
                alerts_sent += 1

    # --- 2. 만료 임박 알림 (7일전, 3일전) ---
    for member in active_members:
        if not member.end_date:
            continue
            
        days_left = (member.end_date - today).days
        
        alert_type = None
        if days_left == 7:
            alert_type = "expiry_7days"
        elif days_left == 3:
            alert_type = "expiry_3days"
            
        if alert_type:
            # 중복 체크
            existing_noti = db.query(Notification).filter(
                Notification.recipient_id == member.id,
                Notification.type == alert_type,
                func.date(Notification.created_at) == today
            ).first()

            if not existing_noti:
                # 템플릿 조회
                template = get_notification_template(db, member.gym_id, alert_type)

                # 변수 치환
                variables = {
                    "member_name": member.name,
                    "days_left": days_left
                }

                message = substitute_template_variables(template["message"], variables)

                noti = Notification(
                    recipient_id=member.id,
                    title=template["title"],
                    message=message,
                    type=alert_type,
                    created_at=datetime.now()
                )
                db.add(noti)
                if can_store_followups:
                    follow_up = db.query(MemberCrmFollowUp).filter(
                        MemberCrmFollowUp.gym_id == member.gym_id,
                        MemberCrmFollowUp.member_id == member.id,
                        MemberCrmFollowUp.trigger_type == alert_type
                    ).first()
                    if not follow_up:
                        db.add(MemberCrmFollowUp(
                            gym_id=member.gym_id,
                            member_id=member.id,
                            trigger_type=alert_type,
                            status="pending",
                            note=""
                        ))
                alerts_sent += 1
    
    db.commit()
    
    return {"status": "success", "alerts_sent": alerts_sent}


@router.get("/expiry-followups")
def get_expiry_followups(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("notifications"))
):
    today = date.today()
    threshold = today + timedelta(days=30)

    members = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user",
        Member.end_date.isnot(None),
        Member.end_date >= today,
        Member.end_date <= threshold
    ).order_by(Member.end_date.asc()).all()

    member_ids = [member.id for member in members]
    follow_up_map = {}
    if has_crm_followups_table(db) and member_ids:
        follow_ups = db.query(MemberCrmFollowUp).filter(
            MemberCrmFollowUp.gym_id == current_user.gym_id,
            MemberCrmFollowUp.member_id.in_(member_ids),
            MemberCrmFollowUp.trigger_type.in_(["expiry_7days", "expiry_3days"])
        ).order_by(MemberCrmFollowUp.updated_at.desc()).all()

        for follow_up in follow_ups:
            follow_up_map.setdefault(follow_up.member_id, follow_up)

    items = []
    for member in members:
        days_left = (member.end_date - today).days if member.end_date else None
        trigger_type = "expiry_3days" if days_left is not None and days_left <= 3 else "expiry_7days"
        follow_up = follow_up_map.get(member.id)
        items.append({
            "member_id": member.id,
            "member_name": member.name,
            "phone": member.phone,
            "membership": member.membership,
            "end_date": member.end_date.isoformat() if member.end_date else None,
            "days_left": days_left,
            "trigger_type": follow_up.trigger_type if follow_up else trigger_type,
            "follow_up_status": follow_up.status if follow_up else "pending",
            "follow_up_note": follow_up.note if follow_up else "",
            "contact_method": follow_up.contact_method if follow_up else None,
            "last_contacted_at": follow_up.last_contacted_at.isoformat() if follow_up and follow_up.last_contacted_at else None
        })

    return {"items": items}


@router.put("/expiry-followups")
def update_expiry_followup(
    payload: FollowUpUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("notifications"))
):
    if not has_crm_followups_table(db):
        raise HTTPException(status_code=503, detail="CRM 후속관리 테이블이 아직 준비되지 않았습니다.")

    if payload.status not in FOLLOW_UP_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="유효하지 않은 후속 상태입니다.")

    member = db.query(Member).filter(
        Member.id == payload.member_id,
        Member.gym_id == current_user.gym_id,
        Member.role == "user"
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    follow_up = db.query(MemberCrmFollowUp).filter(
        MemberCrmFollowUp.gym_id == current_user.gym_id,
        MemberCrmFollowUp.member_id == payload.member_id,
        MemberCrmFollowUp.trigger_type == payload.trigger_type
    ).first()

    if not follow_up:
        follow_up = MemberCrmFollowUp(
            gym_id=current_user.gym_id,
            member_id=payload.member_id,
            trigger_type=payload.trigger_type
        )
        db.add(follow_up)

    follow_up.status = payload.status
    follow_up.note = payload.note
    follow_up.contact_method = payload.contact_method
    follow_up.last_contacted_at = datetime.now() if payload.contact_method else follow_up.last_contacted_at
    db.commit()
    db.refresh(follow_up)

    return {"message": "후속 상태가 저장되었습니다."}
