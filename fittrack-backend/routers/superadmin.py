# fittrack-backend/routers/superadmin.py
# 총관리자(Super Admin) 전용 API

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import requests  # ✅ requests 추가

from database import get_db
from security import get_current_user, get_password_hash
from models import Gym, Member, Sale, Attendance, Notification, Wod, Post
from schemas import GymResponse, GymCreate, GymUpdate  # ✅ schemas에서 import
from fastapi import File, UploadFile, Form
import shutil
import os
import uuid
from config import settings

router = APIRouter(
    prefix="/api/superadmin",
    tags=["Super Admin"],
)


# =========================================================
# Pydantic Schemas
# =========================================================

# GymCreate, GymResponse는 schemas.py에서 가져옴

class CoachCreate(BaseModel):
    gym_id: int
    name: str
    phone: str
    password: str
    role: str = "coach"  # coach 또는 subcoach

class CoachResponse(BaseModel):
    id: int
    gym_id: int
    gym_name: str
    name: str
    phone: str
    role: str
    is_active: bool
    must_change_password: bool
    created_at: datetime


class CoachUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class SystemAnnouncementCreate(BaseModel):
    title: str
    message: str
    target: str = "all"  # all, admins, users

class GymStatsResponse(BaseModel):
    total_gyms: int
    total_members: int
    total_coaches: int
    total_revenue: int

class GeocodeRequest(BaseModel):
    address: str


class AnnouncementVisibilityUpdate(BaseModel):
    is_popup: bool


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    author_name: str
    created_at: datetime
    is_popup: bool
    image_url: Optional[str] = None


# =========================================================
# 권한 체크 함수
# =========================================================

def require_superadmin(current_user: Member = Depends(get_current_user)):
    """총관리자 권한 체크 (role이 superadmin이거나 gym_id가 없는 admin)"""
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="총관리자 권한이 필요합니다.")
    return current_user


# =========================================================
# 대시보드 통계
# =========================================================

@router.get("/stats", response_model=GymStatsResponse)
def get_superadmin_stats(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """총관리자 대시보드 통계"""
    total_gyms = db.query(Gym).count()
    total_members = db.query(Member).filter(Member.role == "user").count()
    total_coaches = db.query(Member).filter(Member.role.in_(["admin", "subcoach", "coach"])).count()

    # 이번 달 전체 매출
    today = date.today()
    start_of_month = today.replace(day=1)
    
    # ✅ [변경] 플랫폼 매출 = 전체 체육관의 월 구독료 합계
    # (실제로는 결제 테이블을 따로 두어야 정확하지만, 약식으로 '활성 체육관 수 * 월정액' 또는 'monthly_fee 합계'로 계산)
    total_revenue = db.query(func.sum(Gym.monthly_fee)).scalar() or 0

    return {
        "total_gyms": total_gyms,
        "total_members": total_members,
        "total_coaches": total_coaches,
        "total_revenue": total_revenue
    }


# =========================================================
# 체육관(지점) 관리
# =========================================================

@router.get("/gyms", response_model=List[GymResponse])
def get_all_gyms(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """전체 체육관 목록 조회 (구독 정보 포함) - N+1 쿼리 최적화 완료"""
    gyms = db.query(Gym).all()

    # ✅ 성능 최적화: 루프 안에서 개별 쿼리(N+1) 대신 전체 데이터를 미리 가져옴
    # 1. 회원 수 합계 (user)
    user_counts = dict(db.query(Member.gym_id, func.count(Member.id))
                      .filter(Member.role == "user")
                      .group_by(Member.gym_id).all())

    # 2. 코치 수 합계 (admin, subcoach, coach)
    coach_counts = dict(db.query(Member.gym_id, func.count(Member.id))
                       .filter(Member.role.in_(["admin", "subcoach", "coach"]))
                       .group_by(Member.gym_id).all())

    # 3. 최근 WOD 등록일
    last_wods = dict(db.query(Wod.gym_id, func.max(Wod.date))
                    .group_by(Wod.gym_id).all())

    # 4. 최근 출석일
    last_attendances = dict(db.query(Attendance.gym_id, func.max(Attendance.date))
                           .group_by(Attendance.gym_id).all())

    result = []
    for gym in gyms:
        member_count = user_counts.get(gym.id, 0)
        coach_count = coach_counts.get(gym.id, 0)

        # ✅ 최근 활동일 계산
        last_wod = last_wods.get(gym.id)
        last_att = last_attendances.get(gym.id)
        
        last_activity = None
        if last_wod and last_att:
            last_activity = max(last_wod, last_att)
        elif last_wod:
            last_activity = last_wod
        elif last_att:
            last_activity = last_att

        result.append(GymResponse(
            id=gym.id,
            name=gym.name,
            location=gym.location,
            
            subscription_plan=gym.subscription_plan,
            subscription_start_date=gym.subscription_start_date,
            next_billing_date=gym.next_billing_date,
            monthly_fee=gym.monthly_fee,
            payment_status=gym.payment_status,

            member_count=member_count,
            coach_count=coach_count,
            
            last_activity_date=last_activity,

            # ✅ GymResponse에 추가된 드랍인 필드들 (필요시)
            latitude=gym.latitude,
            longitude=gym.longitude,
            drop_in_price=gym.drop_in_price,
            description=gym.description,
            drop_in_enabled=gym.drop_in_enabled
        ))

    return result


@router.post("/gyms", response_model=GymResponse)
def create_gym(
    gym_data: GymCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """새 체육관 추가"""
    new_gym = Gym(
        name=gym_data.name,
        location=gym_data.location,
        latitude=gym_data.latitude,
        longitude=gym_data.longitude,
        drop_in_price=gym_data.drop_in_price,
        description=gym_data.description,
        drop_in_enabled=gym_data.drop_in_enabled
    )
    db.add(new_gym)
    db.commit()
    db.refresh(new_gym)

    return GymResponse(
        id=new_gym.id,
        name=new_gym.name,
        location=new_gym.location,
        
        # ✅ 필수 필드 추가
        subscription_plan=new_gym.subscription_plan,
        monthly_fee=new_gym.monthly_fee,
        payment_status=new_gym.payment_status,
        
        # ✅ 드랍인 정보 추가
        latitude=new_gym.latitude,
        longitude=new_gym.longitude,
        drop_in_price=new_gym.drop_in_price,
        description=new_gym.description,
        drop_in_enabled=new_gym.drop_in_enabled,
        
        member_count=0,
        coach_count=0
    )


@router.put("/gyms/{gym_id}")
def update_gym(
    gym_id: int,
    gym_data: GymUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """체육관 정보 수정"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="체육관을 찾을 수 없습니다.")

    gym.name = gym_data.name
    gym.location = gym_data.location
    gym.latitude = gym_data.latitude
    gym.longitude = gym_data.longitude
    gym.drop_in_price = gym_data.drop_in_price
    gym.description = gym_data.description
    gym.drop_in_enabled = gym_data.drop_in_enabled
    gym.subscription_plan = gym_data.subscription_plan
    gym.subscription_start_date = gym_data.subscription_start_date
    gym.next_billing_date = gym_data.next_billing_date
    gym.monthly_fee = gym_data.monthly_fee
    gym.payment_status = gym_data.payment_status
    db.commit()

    return {"message": "수정되었습니다."}


@router.delete("/gyms/{gym_id}")
def delete_gym(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """체육관 삭제 (회원이 있으면 삭제 불가)"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="체육관을 찾을 수 없습니다.")

    member_count = db.query(Member).filter(Member.gym_id == gym_id).count()
    if member_count > 0:
        raise HTTPException(status_code=400, detail=f"해당 체육관에 {member_count}명의 회원이 있어 삭제할 수 없습니다.")

    db.delete(gym)
    db.commit()

    return {"message": "삭제되었습니다."}


# =========================================================
# 코치/관리자 계정 관리
# =========================================================

@router.get("/coaches", response_model=List[CoachResponse])
def get_all_coaches(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """전체 코치/관리자 목록 조회 - 최적화 완료"""
    coaches = db.query(Member).filter(
        Member.role.in_(["admin", "subcoach", "coach"])
    ).order_by(Member.gym_id, Member.created_at.desc()).all()

    # 모든 체육관 이름을 미리 가져와서 매핑
    gym_names = {g.id: g.name for g in db.query(Gym.id, Gym.name).all()}

    result = []
    for coach in coaches:
        result.append(CoachResponse(
            id=coach.id,
            gym_id=coach.gym_id or 0,
            gym_name=gym_names.get(coach.gym_id, "미배정"),
            name=coach.name,
            phone=coach.phone,
            role=coach.role,
            is_active=coach.is_active,
            must_change_password=coach.must_change_password,
            created_at=coach.created_at
        ))

    return result


@router.post("/coaches", response_model=CoachResponse)
def create_coach(
    coach_data: CoachCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """새 코치/관리자 계정 생성"""
    # 전화번호 중복 체크
    existing = db.query(Member).filter(Member.phone == coach_data.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 등록된 전화번호입니다.")

    # 체육관 존재 여부 확인
    gym = db.query(Gym).filter(Gym.id == coach_data.gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="체육관을 찾을 수 없습니다.")

    new_coach = Member(
        gym_id=coach_data.gym_id,
        name=coach_data.name,
        phone=coach_data.phone,
        hashed_password=get_password_hash(coach_data.password),
        role=coach_data.role,
        status="활성",
        must_change_password=True  # 첫 로그인 시 비밀번호 변경 유도
    )
    db.add(new_coach)
    db.commit()
    db.refresh(new_coach)

    return CoachResponse(
        id=new_coach.id,
        gym_id=new_coach.gym_id,
        gym_name=gym.name,
        name=new_coach.name,
        phone=new_coach.phone,
        role=new_coach.role,
        is_active=new_coach.is_active,
        must_change_password=new_coach.must_change_password,
        created_at=new_coach.created_at
    )


@router.put("/coaches/{coach_id}", response_model=CoachResponse)
def update_coach(
    coach_id: int,
    payload: CoachUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    coach = db.query(Member).filter(
        Member.id == coach_id,
        Member.role.in_(["admin", "subcoach", "coach"])
    ).first()

    if not coach:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    if payload.role is not None:
        if payload.role not in ["admin", "coach", "subcoach"]:
            raise HTTPException(status_code=400, detail="유효하지 않은 권한입니다.")
        coach.role = payload.role

    if payload.is_active is not None:
        coach.is_active = payload.is_active

    if payload.password:
        coach.hashed_password = get_password_hash(payload.password)
        coach.must_change_password = True

    db.commit()
    db.refresh(coach)

    gym = db.query(Gym).filter(Gym.id == coach.gym_id).first()
    return CoachResponse(
        id=coach.id,
        gym_id=coach.gym_id or 0,
        gym_name=gym.name if gym else "미배정",
        name=coach.name,
        phone=coach.phone,
        role=coach.role,
        is_active=coach.is_active,
        must_change_password=coach.must_change_password,
        created_at=coach.created_at
    )


@router.delete("/coaches/{coach_id}")
def delete_coach(
    coach_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """코치/관리자 계정 삭제"""
    coach = db.query(Member).filter(
        Member.id == coach_id,
        Member.role.in_(["admin", "subcoach", "coach"])
    ).first()

    if not coach:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

    db.delete(coach)
    db.commit()

    return {"message": "삭제되었습니다."}


# =========================================================
# 시스템 공지
# =========================================================

@router.post("/announcements")
def send_system_announcement(
    title: str = Form(...),
    message: str = Form(...),
    target: str = Form("all"),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """
    시스템 공지 작성 (팝업 공지 및 커뮤니티 게시글로 자동 등록)
    - 이미지 첨부 가능 (Multipart/form-data)
    """
    
    image_url = None
    if file:
        # 파일 저장 경로 설정
        UPLOAD_DIR = "uploads/announcements"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        # 파일명 생성 (UUID)
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        
        # 파일 저장
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # URL 생성
        image_url = f"/uploads/announcements/{file_name}"

    # 1. 커뮤니티 'notice' 보드에 게시글로 등록
    new_post = Post(
        gym_id=None,  # 전체 공지는 gym_id 없음
        board_type="notice",
        title=title,
        content=message,
        author_id=current_user.id,
        author_name=current_user.name,
        is_popup=True,
        popup_expires_at=None,  # 무기한 (수동 삭제/해제 전까지)
        image_url=image_url  # ✅ 이미지 URL 저장
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return {"message": "글로벌 팝업 공지가 등록되었습니다.", "post_id": new_post.id, "image_url": image_url}


@router.get("/announcements", response_model=List[AnnouncementResponse])
def get_system_announcements(
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    return db.query(Post).filter(
        Post.board_type == "notice",
        Post.gym_id.is_(None)
    ).order_by(Post.created_at.desc()).limit(20).all()


@router.put("/announcements/{post_id}/visibility")
def update_system_announcement_visibility(
    post_id: int,
    payload: AnnouncementVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    post = db.query(Post).filter(
        Post.id == post_id,
        Post.board_type == "notice",
        Post.gym_id.is_(None)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")

    post.is_popup = payload.is_popup
    post.popup_expires_at = None if payload.is_popup else datetime.now()
    db.commit()

    return {"message": "공지 노출 상태가 변경되었습니다."}


# =========================================================
# 체육관별 상세 통계
# =========================================================

@router.get("/gyms/{gym_id}/stats")
def get_gym_stats(
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_superadmin)
):
    """특정 체육관 상세 통계"""
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="체육관을 찾을 수 없습니다.")

    # 회원 수
    total_members = db.query(Member).filter(
        Member.gym_id == gym_id,
        Member.role == "user"
    ).count()

    active_members = db.query(Member).filter(
        Member.gym_id == gym_id,
        Member.role == "user",
        Member.status == "활성"
    ).count()

    # 이번 달 매출
    today = date.today()
    start_of_month = today.replace(day=1)
    monthly_revenue = db.query(func.sum(Sale.amount)).filter(
        Sale.gym_id == gym_id,
        Sale.payment_date >= start_of_month,
        Sale.status == "paid"
    ).scalar() or 0

    # 오늘 출석
    today_attendance = db.query(Attendance).filter(
        Attendance.gym_id == gym_id,
        Attendance.date == today
    ).count()

    return {
        "gym_name": gym.name,
        "total_members": total_members,
        "active_members": active_members,
        "monthly_revenue": monthly_revenue,
        "today_attendance": today_attendance
    }


# =========================================================
# 유틸리티 API
# =========================================================

@router.post("/geocode")
def geocode_address(
    req: GeocodeRequest,
    current_user: Member = Depends(require_superadmin)
):
    """주소를 좌표로 변환 (Kakao Local API)"""
    if not settings.kakao_api_key:
        print("Kakao API Key is missing!")
        raise HTTPException(status_code=500, detail="서버에 카카오 API 키가 설정되지 않았습니다.")

    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {settings.kakao_api_key}"}
    params = {"query": req.address}
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        if data['documents']:
            # 가장 첫 번째 검색 결과 사용
            first_match = data['documents'][0]
            return {
                "lat": float(first_match['y']),  # Kakao는 y가 위도
                "lon": float(first_match['x'])   # Kakao는 x가 경도
            }
        else:
            print(f"Geocode Failed (Kakao): No results for '{req.address}'")
            raise HTTPException(status_code=404, detail="카카오 지도에서 해당 주소를 찾을 수 없습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Geocode Internal Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"좌표 변환 중 오류 발생: {str(e)}")
