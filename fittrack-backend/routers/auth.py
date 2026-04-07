# fittrack-backend/api/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from security import verify_password, create_access_token, get_password_hash, get_current_user
from database import get_db
from models import Member
from schemas import Token, PasswordChange

router = APIRouter()

# 1. 로그인 (토큰 발급)
@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 전화번호 포맷 처리 (01012345678 -> 010-1234-5678)
    raw_phone = form_data.username.replace("-", "").strip()
    formatted_phone = f"{raw_phone[:3]}-{raw_phone[3:7]}-{raw_phone[7:]}" if len(raw_phone) == 11 else form_data.username

    # ✅ [수정] 여러 체육관에 속해 있을 경우, 최초 가입 계정으로 로그인 (id 오름차순)
    member = db.query(Member).filter(Member.phone == formatted_phone).order_by(Member.id.asc()).first()
    
    if not member or not member.hashed_password or not verify_password(form_data.password, member.hashed_password):
        raise HTTPException(status_code=401, detail="아이디(전화번호) 또는 비밀번호가 일치하지 않습니다.")
    
    # 토큰 유효기간 설정 (일반 회원: 1시간, 관리자/코치: 30일)
    from datetime import timedelta
    from config import settings

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    if member.role in ["subcoach", "coach", "superadmin"]:
        access_token_expires = timedelta(days=30)
    
    # 토큰에 gym_id와 role 정보 포함
    access_token = create_access_token(
        data={"sub": member.phone, "role": member.role, "gym_id": member.gym_id, "name": member.name},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "must_change_password": member.must_change_password}

# 2. 비밀번호 변경 (최초 로그인 시 강제 변경 등)
@router.post("/me/change-password")
def change_user_password(password_data: PasswordChange, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "비밀번호가 성공적으로 변경되었습니다."}

# 3. 체육관 전환 (멀티 박스 환경에서 토큰 재발급)
from pydantic import BaseModel
class SwitchGymRequest(BaseModel):
    gym_id: int

@router.post("/switch-gym")
def switch_gym(request_data: SwitchGymRequest, current_user: Member = Depends(get_current_user), db: Session = Depends(get_db)):
    # 대상 체육관에 현재 유저의 전화번호로 가입된 계정이 있는지 확인
    target_member = db.query(Member).filter(
        Member.phone == current_user.phone,
        Member.gym_id == request_data.gym_id,
        Member.status == "활성"
    ).first()

    if not target_member:
        raise HTTPException(status_code=403, detail="해당 체육관에 활성 상태의 회원 정보가 없습니다.")

    # 토큰 유효기간 설정
    from datetime import timedelta
    from config import settings
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    if target_member.role in ["subcoach", "coach", "superadmin"]:
        access_token_expires = timedelta(days=30)

    # 새로운 토큰 발급 (해당 체육관의 데이터로 덮어씌움)
    access_token = create_access_token(
        data={"sub": target_member.phone, "role": target_member.role, "gym_id": target_member.gym_id, "name": target_member.name},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "must_change_password": target_member.must_change_password}