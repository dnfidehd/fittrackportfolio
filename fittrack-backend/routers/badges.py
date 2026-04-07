from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, timedelta, datetime

from database import get_db
from models import Badge, MemberBadge, Member, Workout
from routers.auth import get_current_user
from pydantic import BaseModel, ConfigDict

router = APIRouter()

# --- 응답 스키마 ---
class BadgeSchema(BaseModel):
    name: str
    description: str
    icon: str
    earned_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# 1. 내 배지 목록 조회
@router.get("/", response_model=List[BadgeSchema])
def get_my_badges(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # MemberBadge 테이블을 통해 내가 가진 Badge 정보를 가져옴
    results = db.query(Badge, MemberBadge.earned_at)\
        .join(MemberBadge, Badge.id == MemberBadge.badge_id)\
        .filter(MemberBadge.member_id == current_user.id)\
        .all()
    
    badges = []
    for badge, earned_at in results:
        badges.append(BadgeSchema(
            name=badge.name,
            description=badge.description,
            icon=badge.icon,
            earned_at=earned_at
        ))
    return badges

# ==========================================
# 🛠️ 배지 시스템 관리 및 테스트
# ==========================================

# 2. 배지 데이터 초기화 (서버 켜질 때 또는 관리자가 호출)
# URL: POST /api/badges/init
@router.post("/init")
def initialize_badges(db: Session = Depends(get_db)):
    # criteria 규칙: "streak_3" -> 3일 연속, "first_pr" -> 첫 PR
    default_badges = [
        {"name": "새로운 시작", "desc": "FitTrack에 오신 것을 환영합니다!", "icon": "🐣", "crit": "welcome"},
        {"name": "작심삼일 탈출", "desc": "3일 연속 운동을 완료했습니다!", "icon": "🔥", "crit": "streak_3"},
        {"name": "일주일의 기적", "desc": "7일 연속 운동을 완료했습니다!", "icon": "🏃", "crit": "streak_7"},
        {"name": "꾸준함의 왕", "desc": "30일 연속 운동! 대단합니다.", "icon": "👑", "crit": "streak_30"},
        {"name": "첫 PR 달성", "desc": "자신의 한계를 처음으로 넘었습니다.", "icon": "🏋️", "crit": "first_pr"},
    ]
    
    count = 0
    for b in default_badges:
        exists = db.query(Badge).filter(Badge.name == b["name"]).first()
        if not exists:
            new_badge = Badge(name=b["name"], description=b["desc"], icon=b["icon"], criteria=b["crit"])
            db.add(new_badge)
            count += 1
    
    db.commit()
    return {"message": f"{count}개의 배지가 새로 생성되었습니다."}

# 3. [테스트용] 배지 강제 지급 (테스트할 때 쓰세요!)
# URL: POST /api/badges/test/grant
@router.post("/test/grant")
def grant_test_badge(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # '작심삼일 탈출' 배지를 강제로 줍니다.
    target_badge = db.query(Badge).filter(Badge.criteria == "streak_3").first()
    
    if not target_badge:
        return {"message": "먼저 /init API를 호출해주세요."}
    
    has_badge = db.query(MemberBadge).filter(
        MemberBadge.member_id == current_user.id,
        MemberBadge.badge_id == target_badge.id
    ).first()
    
    if has_badge:
        return {"message": "이미 가지고 있는 배지입니다."}
    
    new_grant = MemberBadge(member_id=current_user.id, badge_id=target_badge.id)
    db.add(new_grant)
    db.commit()
    return {"message": "🎉 테스트 성공! '작심삼일 탈출' 배지를 획득했습니다."}

# 4. [실제 로직] 출석 체크 및 자동 배지 수여
# URL: POST /api/badges/check-streak
@router.post("/check-streak")
def check_streak_and_award(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # 1. 운동 기록 날짜 가져오기
    # Workouts 테이블의 date 컬럼이 'YYYY-MM-DD' 문자열이라고 가정
    workouts = db.query(Workout.date).filter(
        Workout.member_id == current_user.id
    ).order_by(Workout.date.desc()).distinct().all()
    
    if not workouts:
        return {"current_streak": 0, "message": "운동 기록이 없습니다."}

    dates_str = [w[0] for w in workouts] # ['2026-01-27', '2026-01-26', ...]

    # 2. 연속 출석 계산
    streak = 0
    # 오늘 날짜부터 검사
    check_date = date.today() 
    
    # 오늘 안했으면 어제부터 카운트 (연속 기록 유지용)
    if check_date.strftime("%Y-%m-%d") not in dates_str:
        check_date = check_date - timedelta(days=1)

    while True:
        if check_date.strftime("%Y-%m-%d") in dates_str:
            streak += 1
            check_date = check_date - timedelta(days=1)
        else:
            break
            
    # 3. 배지 수여 로직
    awarded_badges = []
    all_badges = db.query(Badge).all()
    
    for badge in all_badges:
        # criteria가 'streak_3' 같은 형식인지 확인
        if badge.criteria and badge.criteria.startswith("streak_"):
            try:
                required_days = int(badge.criteria.split("_")[1])
                
                # 조건 충족 시
                if streak >= required_days:
                    # 이미 있는지 확인
                    has_badge = db.query(MemberBadge).filter(
                        MemberBadge.member_id == current_user.id,
                        MemberBadge.badge_id == badge.id
                    ).first()
                    
                    if not has_badge:
                        db.add(MemberBadge(member_id=current_user.id, badge_id=badge.id))
                        awarded_badges.append(badge.name)
            except:
                continue

    if awarded_badges:
        db.commit()
        return {
            "current_streak": streak, 
            "new_badges": awarded_badges, 
            "message": f"축하합니다! {', '.join(awarded_badges)} 배지를 획득했습니다!"
        }
    
    return {
        "current_streak": streak, 
        "new_badges": [], 
        "message": f"현재 {streak}일 연속 운동 중입니다. 화이팅!"
    }