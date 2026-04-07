from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Message, Member
from schemas import MessageCreate, MessageResponse, ConversationResponse
from routers.auth import get_current_user
from datetime import datetime

router = APIRouter(
    prefix="/messages",
    tags=["messages"],
    responses={404: {"description": "Not found"}},
)

# 1. 메시지 전송
@router.post("/", response_model=MessageResponse)
def send_message(
    msg: MessageCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 수신자 확인
    receiver = db.query(Member).filter(Member.id == msg.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # 권한 체크: 'user'는 'coach'나 'admin'에게만 보낼 수 있음
    if current_user.role == "user":
        if receiver.role not in ["coach", "subcoach"]:
            raise HTTPException(status_code=403, detail="회원은 코치나 관리자에게만 메시지를 보낼 수 있습니다.")
    
    # 메시지 저장
    new_message = Message(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        message=msg.message,
        is_read=False,
        created_at=datetime.now()
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # 응답 생성 (이름 포함)
    return MessageResponse(
        id=new_message.id,
        sender_id=new_message.sender_id,
        sender_name=current_user.name,
        receiver_id=new_message.receiver_id,
        receiver_name=receiver.name,
        message=new_message.message,
        is_read=new_message.is_read,
        created_at=new_message.created_at
    )

# 2. 내 대화 목록 조회 (채팅방 목록)
# 회원은: 나와 대화한 코치 목록 (사실상 1:1 채팅방처럼 보임)
# 코치는: 나에게 메시지를 보낸 회원 목록
@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 나와 대화한 상대방 ID 목록 추출 (보낸 메시지 + 받은 메시지)
    # Distinct partner_ids
    sent_partners = db.query(Message.receiver_id).filter(Message.sender_id == current_user.id)
    received_partners = db.query(Message.sender_id).filter(Message.receiver_id == current_user.id)
    
    partner_ids = set()
    for (pid,) in sent_partners:
        partner_ids.add(pid)
    for (pid,) in received_partners:
        partner_ids.add(pid)
        
    if not partner_ids:
        return []

    partners = db.query(Member).filter(Member.id.in_(partner_ids)).all()

    conversations = []
    for partner in partners:
        latest_message = db.query(Message).filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == partner.id)) |
            ((Message.sender_id == partner.id) & (Message.receiver_id == current_user.id))
        ).order_by(Message.created_at.desc()).first()

        unread_count = db.query(Message).filter(
            Message.sender_id == partner.id,
            Message.receiver_id == current_user.id,
            Message.is_read == False
        ).count()

        conversations.append(
            ConversationResponse(
                id=partner.id,
                name=partner.name,
                role=partner.role,
                gym_id=partner.gym_id,
                last_message=latest_message.message if latest_message else None,
                last_message_at=latest_message.created_at if latest_message else None,
                unread_count=unread_count,
            )
        )

    conversations.sort(
        key=lambda item: item.last_message_at or datetime.min,
        reverse=True,
    )
    return conversations

# 3. 특정 사용자와의 대화 내용 조회
@router.get("/{partner_id}", response_model=List[MessageResponse])
def get_messages_with_user(
    partner_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    partner = db.query(Member).filter(Member.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")

    messages = db.query(Message).filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == partner_id)) |
        ((Message.sender_id == partner_id) & (Message.receiver_id == current_user.id))
    ).order_by(Message.created_at.asc()).all()

    # 읽음 처리 (상대방이 보낸 메시지를 내가 조회했으므로)
    unread_messages = [m for m in messages if m.receiver_id == current_user.id and not m.is_read]
    for m in unread_messages:
        m.is_read = True
    if unread_messages:
        db.commit()

    # Pydantic 모델 변환
    sender_cache = {current_user.id: current_user.name, partner_id: partner.name}
    
    result = []
    for m in messages:
        s_name = sender_cache.get(m.sender_id, "Unknown")
        r_name = sender_cache.get(m.receiver_id, "Unknown")
        result.append(MessageResponse(
            id=m.id,
            sender_id=m.sender_id,
            sender_name=s_name,
            receiver_id=m.receiver_id,
            receiver_name=r_name,
            message=m.message,
            is_read=m.is_read,
            created_at=m.created_at
        ))
    
    return result

# 4. 안 읽은 메시지 개수 (전체)
@router.get("/unread/count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    count = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).count()
    return count
