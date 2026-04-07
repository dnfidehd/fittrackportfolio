from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
# ▼▼▼ [수정] config에서 settings 가져오기
# ▼▼▼ [수정] config에서 settings 가져오기
from config import settings 

# --- 보안 및 인증 설정 ---
SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ... (나머지 코드는 그대로 둠) ...
def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from models import Member
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone: str = payload.get("sub")
        gym_id: int = payload.get("gym_id") # ✅ 멀티 박스 식별자 추가
        if phone is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # ✅ gym_id 가 있으면 정확한 계정을, 없으면 최초 계정을 가져옴
    query = db.query(Member).filter(Member.phone == phone)
    if gym_id is not None:
        query = query.filter(Member.gym_id == gym_id)
    else:
        query = query.order_by(Member.id.asc())
        
    user = query.first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    """토큰이 있으면 유저를 반환하고, 없으면 None을 반환함 (오류 발생시키지 않음)"""
    from models import Member
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone: str = payload.get("sub")
        gym_id: int = payload.get("gym_id") # ✅ 멀티 박스 식별자 추가
        if phone is None:
            return None
            
        # ✅ gym_id 가 있으면 정확한 계정을, 없으면 최초 계정을 가져옴
        query = db.query(Member).filter(Member.phone == phone)
        if gym_id is not None:
            query = query.filter(Member.gym_id == gym_id)
        else:
            query = query.order_by(Member.id.asc())
            
        user = query.first()
        return user
    except JWTError:
        return None

def require_permission(permission_name: str):
    """
    특정 메뉴 권한이 있는지 확인하는 의존성 함수
    """
    async def permission_checker(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
        # 1. 코치(체육관 마스터), 총관리자, 기존 관리자(admin)는 모든 권한 허용
        if current_user.role in ["coach", "superadmin", "admin"]:
            return current_user
        
        # 2. 서브코치(subcoach)인 경우 해당 체육관의 권한 테이블 확인
        if current_user.role == "subcoach":
            from models import CoachPermission, Permission
            has_perm = db.query(CoachPermission).join(Permission).filter(
                CoachPermission.coach_id == current_user.id,
                CoachPermission.gym_id == current_user.gym_id,
                Permission.name == permission_name
            ).first()
            if not has_perm:
                raise HTTPException(status_code=403, detail="해당 기능에 대한 접근 권한이 없습니다.")
            return current_user
            
        # 3. 기타 사용자(user 등)는 접근 불가
        raise HTTPException(status_code=403, detail="관리자 접근 권한이 없습니다.")
    return permission_checker
