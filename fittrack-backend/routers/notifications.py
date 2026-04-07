from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Notification, Member
from schemas import NotificationResponse, NotificationBroadcastRequest
from security import get_current_user
from sqlalchemy import desc
from utils.auth import assert_roles
from constants import Role

router = APIRouter()

# 1. 내 알림 목록 조회 (최신순)
@router.get("/", response_model=List[NotificationResponse])
def get_my_notifications(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        Notification.recipient_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()
    
    return notifications

# 2. 읽지 않은 알림 개수 (Polling용)
@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    count = db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {"unread_count": count}

# 3. 알림 읽음 처리
@router.put("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    
    notification.is_read = True
    db.commit()
    
    return {"message": "알림을 읽음 처리했습니다."}

# 4. 모든 알림 읽음 처리
@router.put("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).update({Notification.is_read: True}, synchronize_session=False)
    
    db.commit()
    
    return {"message": "모든 알림을 읽음 처리했습니다."}

# 5. 전체 알림 보내기 (Broadcast)
@router.post("/broadcast")
def broadcast_notification(
    request: NotificationBroadcastRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 1. 권한 확인 (서브코치/코치/총관리자)
    assert_roles(current_user, [Role.SUBCOACH, Role.COACH, Role.SUPERADMIN])

    # 2. 대상 박스 ID 결정
    target_gym_id = current_user.gym_id
    if current_user.role == Role.SUPERADMIN and request.target_gym_id:
        target_gym_id = request.target_gym_id

    # 3. 해당 박스의 모든 활성 회원 조회
    members = db.query(Member).filter(
        Member.gym_id == target_gym_id,
        Member.status == "활성"
    ).all()

    if not members:
        return {"message": "알림을 보낼 대상 회원이 없습니다.", "count": 0}

    # 4. 알림 객체 생성 (Bulk Insert 준비)
    new_notifications = []
    for member in members:
        # 본인에게는 알림을 보낼지 말지 결정 (여기서는 포함)
        new_notifications.append(
            Notification(
                recipient_id=member.id,
                sender_id=current_user.id,
                type="system", # 시스템 알림으로 분류
                title=request.title,
                message=request.message,
                related_link=request.related_link,
                is_read=False
            )
        )

    # 5. DB 저장
    db.add_all(new_notifications)
    db.commit()

    return {"message": f"{len(new_notifications)}명의 회원에게 알림을 전송했습니다.", "count": len(new_notifications)}
