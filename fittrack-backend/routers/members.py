from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, timedelta

from database import get_db

# 모델 및 스키마 임포트 (Sale, WodRecord 추가됨!)
from models import (
    Member,
    Gym,
    Attendance,
    PersonalRecord,
    Workout,
    MembershipHold,
    Sale,
    WodRecord,
    ClassReservation,
    ClassSchedule,
    Wod,
    CompetitionScore,
    Post, Comment, CompetitionRegistration
)
from schemas import (
    MemberCreate,
    MemberUpdate,
    MemberResponse,
    MemberProfileUpdate,
    MemberPaginationResponse,
    HoldCreate,
    HoldStatusResponse
)

from security import get_current_user, get_password_hash, require_permission

from config import settings # ✅ DB URL 확인용

router = APIRouter(
    tags=["members"],
    responses={404: {"description": "Not found"}},
)

# 1. 회원 목록 조회 (필터링 포함)
@router.get("/", response_model=MemberPaginationResponse)
def read_members(
    skip: int = 0, 
    limit: int = 10, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    gender: Optional[str] = None,
    sort: Optional[str] = "name",
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):
    today = date.today()

    query = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role == "user"
    )

    if search:
        search_fmt = f"%{search}%"
        query = query.filter((Member.name.like(search_fmt)) | (Member.phone.like(search_fmt)))
    
    if status and status != "all":
        query = query.filter(Member.status == status)

    if gender and gender != "all":
        query = query.filter(Member.gender == gender)

    import re

    def natural_key(text):
        return [int(c) if c.isdigit() else c for c in re.split(r'(\d+)', text)]

    # 1. DB 쿼리 실행 (정렬과 페이징은 파이썬에서 처리하기 위해 일단 가져옴)
    # 단, 이름 정렬이 아닌 경우(만료일순)는 DB 정렬 사용
    if sort == "expiry":
        query = query.filter(Member.end_date != None).order_by(Member.end_date.asc())
        total_count = query.count()
        members = query.offset(skip).limit(limit).all()
    else:
        # 이름순 (기본) -> Natural Sort 적용
        # 전체를 가져와서 파이썬에서 정렬 (데이터 양이 많지 않다고 가정)
        all_members = query.all()
        total_count = len(all_members)
        
        # Natural Sort
        all_members.sort(key=lambda m: natural_key(m.name))
        
        # 파이썬 리스트 슬라이싱으로 페이징
        members = all_members[skip : skip + limit]
    
    member_ids = [member.id for member in members]

    unpaid_amount_map = {}
    unpaid_count_map = {}
    last_attendance_map = {}
    if member_ids:
        unpaid_rows = db.query(
            Sale.member_id,
            func.sum(Sale.amount),
            func.count(Sale.id)
        ).filter(
            Sale.member_id.in_(member_ids),
            Sale.status == "pending"
        ).group_by(Sale.member_id).all()

        for member_id, amount, count in unpaid_rows:
            unpaid_amount_map[member_id] = amount or 0
            unpaid_count_map[member_id] = count or 0

        attendance_rows = db.query(
            Attendance.member_id,
            func.max(Attendance.date)
        ).filter(
            Attendance.member_id.in_(member_ids)
        ).group_by(Attendance.member_id).all()

        for member_id, last_attendance in attendance_rows:
            last_attendance_map[member_id] = last_attendance

    for member in members:
        last_attendance = last_attendance_map.get(member.id)
        member.unpaid_amount = unpaid_amount_map.get(member.id, 0)
        member.unpaid_sales_count = unpaid_count_map.get(member.id, 0)
        member.last_attendance_date = last_attendance
        member.days_since_last_attendance = (today - last_attendance).days if last_attendance else None
        member.expiring_soon = bool(member.end_date and 0 <= (member.end_date - today).days <= 7)

    return {"total": total_count, "members": members}

# 2. 내 정보 조회
@router.get("/me", response_model=MemberResponse)
def read_users_me(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # ✅ [추가] 멀티 박스 지원: 동일 전화번호로 가입된 모든 체육관 정보 조회
    gyms = db.query(Member.gym_id, Gym.name).join(Gym, Member.gym_id == Gym.id).filter(
        Member.phone == current_user.phone,
        Member.status == "활성"
    ).all()

    current_user.available_gyms = [{"id": g.gym_id, "name": g.name} for g in gyms]

    # ✅ [추가] 부코치 권한 로드 (현재 체육관의 권한만)
    if current_user.role == "subcoach":
        from models import CoachPermission, Permission
        # ✅ [중요] gym_id로 필터링하여 다른 체육관의 권한 혼동 방지
        permissions = db.query(Permission).join(
            CoachPermission, CoachPermission.permission_id == Permission.id
        ).filter(
            CoachPermission.coach_id == current_user.id,
            CoachPermission.gym_id == current_user.gym_id  # ✅ CoachPermission에서 직접 gym_id 확인
        ).all()
        current_user.permissions = permissions

    return current_user

# 3. 내 프로필 수정
@router.put("/me/profile", response_model=MemberResponse)
def update_my_profile(
    profile_data: MemberProfileUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    update_data = profile_data.dict(exclude_unset=True)

    if "password" in update_data:
        plain_password = update_data.pop("password") 
        current_user.hashed_password = get_password_hash(plain_password) 

    # 이름 변경 시도 차단 (실명제 정책)
    if "name" in update_data and update_data["name"] != current_user.name:
        raise HTTPException(
            status_code=400, 
            detail="실명제 정책에 따라 이름은 직접 변경할 수 없습니다. 관리자에게 문의해주세요."
        )

    # (이전 로직 주석 처리 또는 삭제 - 이름 변경이 불가능하므로 연관 업데이트도 불필요)
    # 기존 코드 보존을 위해 주석 처리하거나, 위 에러 발생으로 인해 도달하지 않음.
    
    # if "name" in update_data and update_data["name"] != current_user.name:
    #     new_name = update_data["name"]
    #     db.query(WodRecord).filter(WodRecord.member_id == current_user.id).update({WodRecord.member_name: new_name})
    #     ... (생략)

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user

# 4. 회원 생성
@router.post("/", response_model=MemberResponse)
def create_member(
    member: MemberCreate, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    # ✅ [수정] 박스 독립성을 위해 번호 + gym_id 로 중복 체크
    db_user = db.query(Member).filter(
        Member.phone == member.phone, 
        Member.gym_id == current_user.gym_id
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="해당 박스에 이미 등록된 전화번호입니다.")
    
    hashed_pw = get_password_hash(member.password)
    member_data = member.dict(exclude={"password"}) 
    
    if "gym_id" in member_data:
        del member_data["gym_id"]

    new_member = Member(
        **member_data, 
        hashed_password=hashed_pw,
        gym_id=current_user.gym_id 
    )
    
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member

# 5. 회원 정보 수정 (관리자용)
@router.put("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: int, 
    member_data: MemberUpdate, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    member = db.query(Member).filter(
        Member.id == member_id, 
        Member.gym_id == current_user.gym_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    update_data = member_data.dict(exclude_unset=True)
    if "password" in update_data:
        member.hashed_password = get_password_hash(update_data.pop("password"))

    # 이름 변경 시 연관 테이블 일괄 업데이트
    if "name" in update_data and update_data["name"] != member.name:
        new_name = update_data["name"]
        db.query(WodRecord).filter(WodRecord.member_id == member.id).update({WodRecord.member_name: new_name})
        db.query(CompetitionScore).filter(CompetitionScore.member_id == member.id).update({CompetitionScore.member_name: new_name})
        db.query(CompetitionRegistration).filter(CompetitionRegistration.member_id == member.id).update({CompetitionRegistration.member_name: new_name})
        db.query(Post).filter(Post.author_id == member.id).update({Post.author_name: new_name})
        db.query(Comment).filter(Comment.author_id == member.id).update({Comment.author_name: new_name})
        db.query(Workout).filter(Workout.member_id == member.id).update({Workout.member_name: new_name})

    for key, value in update_data.items():
        setattr(member, key, value)

    db.commit()
    db.refresh(member)
    return member

# 6. 회원 삭제
@router.delete("/{member_id}")
def delete_member(
    member_id: int, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    member = db.query(Member).filter(
        Member.id == member_id, 
        Member.gym_id == current_user.gym_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    
    db.delete(member)
    db.commit()
    return {"message": "회원이 삭제되었습니다."}

# 7-0. 코치 목록 조회 (회원용/공용)
@router.get("/list/coaches", response_model=List[MemberResponse])
def get_coaches(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 코치, 부코치 또는 관리자 목록 반환
    coaches = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role.in_(["coach", "subcoach", "admin"])
    ).all()
    return coaches

# 7. 통계 정보 (마이페이지용)
@router.get("/me/stats")
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # ✅ [수정] DB 종류에 따른 날짜 포맷 함수 분기 처리
    is_sqlite = "sqlite" in settings.sqlalchemy_database_url
    
    if is_sqlite:
        date_col = func.strftime("%Y-%m", Attendance.date).label("month")
    else:
        date_col = func.to_char(Attendance.date, 'YYYY-MM').label("month")

    attendance_stats = db.query(
        date_col,
        func.count(Attendance.id)
    ).filter(
        Attendance.member_id == current_user.id
    ).group_by("month").order_by("month").all()
    
    attendance_history = []
    for row in attendance_stats:
        try:
            month_str = f"{int(row[0].split('-')[1])}월"
        except:
            month_str = row[0]
        attendance_history.append({"name": month_str, "attendance": row[1]})

    pr_records = db.query(PersonalRecord).filter(
        PersonalRecord.member_id == current_user.id
    ).order_by(PersonalRecord.recorded_date.asc()).all()
    
    pr_history = [{
        "date": pr.recorded_date.strftime("%Y-%m-%d"),
        "exercise_name": pr.exercise_name,
        "record_value": float(pr.record_value)
    } for pr in pr_records]

    today = date.today()
    current_month_str = today.strftime("%Y-%m")
    
    if is_sqlite:
        month_filter = func.strftime("%Y-%m", Attendance.date) == current_month_str
    else:
        month_filter = func.to_char(Attendance.date, 'YYYY-MM') == current_month_str

    current_month_attendance = db.query(Attendance).filter(
        Attendance.member_id == current_user.id,
        month_filter
    ).count()

    # 총 운동 횟수 합산 (개인 운동기록 + WOD 기록 + 대회 기록)
    workout_count = db.query(Workout).filter(Workout.member_id == current_user.id).count()
    wod_record_count = db.query(WodRecord).filter(WodRecord.member_id == current_user.id).count()
    comp_score_count = db.query(CompetitionScore).filter(CompetitionScore.member_id == current_user.id).count()
    
    total_workouts = workout_count + wod_record_count + comp_score_count

    # ✅ [Dashboard 추가 데이터]
    # 1. 멤버십 정보
    membership_info = {
        "type": current_user.membership,
        "start_date": current_user.start_date,
        "end_date": current_user.end_date,
        "remaining_days": (current_user.end_date - today).days if current_user.end_date else 0
    }

    # 2. 다음 수업 예약
    next_reservation = db.query(ClassReservation).join(ClassSchedule).filter(
        ClassReservation.member_id == current_user.id,
        ClassReservation.status == "reserved",
        ClassSchedule.date >= today
        # 시간까지 체크하면 좋지만, 일단 날짜 기준
    ).order_by(ClassSchedule.date, ClassSchedule.time).first()
    
    next_class_info = None
    if next_reservation:
        next_class_info = {
            "id": next_reservation.schedule.id,
            "date": next_reservation.schedule.date,
            "time": next_reservation.schedule.time,
            "title": next_reservation.schedule.title
        }

    # 3. 오늘의 WOD
    today_wod = db.query(Wod).filter(
        Wod.gym_id == current_user.gym_id,
        Wod.date == today
    ).first()
    
    today_wod_info = None
    if today_wod:
        today_wod_info = {
            "id": today_wod.id,
            "title": today_wod.title,
            "content": today_wod.content,
            "is_rest_day": today_wod.is_rest_day
        }
    # 4. 🔥 출석 스트릭 (Current Streak) 계산
    all_attendances = db.query(Attendance.date).filter(
        Attendance.member_id == current_user.id
    ).order_by(Attendance.date.desc()).all()
    
    attendance_dates_set = set([a[0] for a in all_attendances])
    
    current_streak = 0
    # 오늘 출석했는지 확인
    check_date = today
    if check_date not in attendance_dates_set:
        # 오늘 출석 안했으면 어제부터 확인 (어제 출석했으면 스트릭 유지 중인 것으로 간주)
        check_date = today - timedelta(days=1)

    # 연속 출석 카운트
    if check_date in attendance_dates_set:
        while check_date in attendance_dates_set:
            current_streak += 1
            check_date -= timedelta(days=1)

    return {
        "attendance_history": attendance_history,
        "pr_history": pr_history,
        "attendance_count": current_month_attendance, 
        "total_workouts": total_workouts,
        "user_name": current_user.name,
        "workout_goal": current_user.workout_goal,
        # 추가 필드
        "membership_info": membership_info,
        "next_reservation": next_class_info,
        "today_wod": today_wod_info,
        "current_streak": current_streak # ✅ 추가됨
    }

# 8. 홀딩 상태 조회
@router.get("/me/hold-status", response_model=HoldStatusResponse)
def get_hold_status(
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    if not current_user.start_date or not current_user.end_date:
        return {"max_days": 0, "used_days": 0, "remaining_days": 0}

    total_duration = (current_user.end_date - current_user.start_date).days
    max_hold_days = 3 if total_duration < 60 else (9 if total_duration < 150 else 14)

    used_holds = db.query(MembershipHold).filter(MembershipHold.member_id == current_user.id).all()
    used_days = sum([h.days for h in used_holds])

    return {
        "max_days": max_hold_days,
        "used_days": used_days,
        "remaining_days": max(0, max_hold_days - used_days)
    }

# 9. 홀딩 신청
@router.post("/me/hold", response_model=MemberResponse)
def request_hold(
    hold_data: HoldCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    request_days = (hold_data.end_date - hold_data.start_date).days + 1
    if request_days <= 0:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 같거나 늦어야 합니다.")
    if hold_data.start_date <= date.today():
         raise HTTPException(status_code=400, detail="홀딩은 '내일'부터 신청 가능합니다.")

    status_info = get_hold_status(db, current_user)
    if request_days > status_info["remaining_days"]:
         raise HTTPException(status_code=400, detail=f"홀딩 한도 초과! (남은 한도: {status_info['remaining_days']}일)")

    new_hold = MembershipHold(
        member_id=current_user.id,
        start_date=hold_data.start_date,
        end_date=hold_data.end_date,
        days=request_days
    )
    db.add(new_hold)

    if current_user.end_date:
        current_user.end_date = current_user.end_date + timedelta(days=request_days)
    
    db.commit()
    db.refresh(current_user)
    return current_user

# 10. 메모 수정
@router.put("/{member_id}/memo")
def update_member_memo(
    member_id: int, 
    memo: str = Body(..., embed=True), 
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.memo = memo
    db.commit()
    return {"message": "Memo updated", "memo": member.memo}

# 10-1. 태그 수정
@router.put("/{member_id}/tags")
def update_member_tags(
    member_id: int, 
    tags: str = Body(..., embed=True), 
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.tags = tags
    db.commit()
    return {"message": "Tags updated", "tags": member.tags}


# 11. 일괄 연장
@router.post("/batch-extend")
def batch_extend_membership(
    member_ids: List[int] = Body(...), 
    days: int = Body(...),             
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    if current_user.role not in ['subcoach', 'coach']:
        raise HTTPException(status_code=403, detail="관리자(코치)만 가능합니다.")

    targets = db.query(Member).filter(Member.id.in_(member_ids)).all()
    count = 0
    today_date = date.today()

    for member in targets:
        if member.end_date:
            member.end_date += timedelta(days=days)
        else:
            member.end_date = today_date + timedelta(days=days)
        count += 1
            
    db.commit()
    return {"message": f"{count}명의 회원 기간이 {days}일 연장되었습니다."}

# 12. 전체 연장
@router.post("/extend-all-active")
def extend_all_active_members(
    days: int = Body(..., embed=True), 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    if current_user.role not in ['subcoach', 'coach']:
        raise HTTPException(status_code=403, detail="관리자(코치)만 가능합니다.")

    active_members = db.query(Member).filter(Member.gym_id == current_user.gym_id, Member.status == "활성").all()
    for member in active_members:
        if member.end_date:
            member.end_date += timedelta(days=days)
    
    db.commit()
    return {"message": f"활성 회원 {len(active_members)}명의 기간이 {days}일 연장되었습니다."}


# ✅ [CRM 핵심] 회원 상세 정보 종합 조회
@router.get("/{member_id}/detail")
def get_member_detail(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):

    # 1. 회원 기본 정보
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # 2. 결제 내역 (최신순)
    sales = db.query(Sale).filter(Sale.member_id == member_id).order_by(Sale.payment_date.desc()).all()
    
    # 3. 출석 기록 (최신 30건)
    attendances = db.query(Attendance).filter(Attendance.member_id == member_id).order_by(Attendance.date.desc()).limit(30).all()
    
    # 4. 최근 WOD 기록 (최신 5건)
    recent_records = db.query(WodRecord).filter(WodRecord.member_id == member_id).order_by(WodRecord.created_at.desc()).limit(5).all()

    return {
        "member": member,
        "sales": sales,
        "attendances": attendances,
        "recent_records": recent_records
    }




    # ✅ [신규] 관리자용 회원 홀딩 처리 (강제 적용)
@router.post("/{member_id}/hold")
def create_hold_by_admin(
    member_id: int,
    hold_data: HoldCreate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 1. 권한 체크
    if current_user.role not in ['subcoach', 'coach']:
        raise HTTPException(status_code=403, detail="관리자만 가능합니다.")

    target_member = db.query(Member).filter(Member.id == member_id).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    # 2. 날짜 계산
    request_days = (hold_data.end_date - hold_data.start_date).days + 1
    
    if request_days <= 0:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 같거나 늦어야 합니다.")

    # 3. 홀딩 기록 저장
    new_hold = MembershipHold(
        member_id=target_member.id,
        start_date=hold_data.start_date,
        end_date=hold_data.end_date,
        days=request_days
    )
    db.add(new_hold)

    # 4. 회원 만료일 자동 연장
    if target_member.end_date:
        target_member.end_date = target_member.end_date + timedelta(days=request_days)

    db.commit()
    return {"message": f"{request_days}일간 홀딩 처리가 완료되었습니다."}


# ✅ [신규] 코치를 다른 지점에 추가 (총관리자용)
@router.post("/{coach_id}/add-to-gym/{target_gym_id}")
def add_coach_to_gym(
    coach_id: int,
    target_gym_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(require_permission("members"))
):
    """
    기존 코치를 다른 지점에 추가 (총관리자만 가능)
    - coach_id: 코치의 ID
    - target_gym_id: 추가할 지점의 ID
    """
    # 1. 원본 코치 조회
    coach = db.query(Member).filter(Member.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="코치를 찾을 수 없습니다.")

    if coach.role not in ["coach", "subcoach"]:
        raise HTTPException(status_code=400, detail="코치만 추가 가능합니다.")

    # 2. 대상 지점 존재 확인
    target_gym = db.query(Gym).filter(Gym.id == target_gym_id).first()
    if not target_gym:
        raise HTTPException(status_code=404, detail="대상 지점을 찾을 수 없습니다.")

    # 3. 이미 해당 지점에 등록되었는지 확인
    existing = db.query(Member).filter(
        Member.phone == coach.phone,
        Member.gym_id == target_gym_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 해당 지점에 등록된 코치입니다.")

    # 4. 같은 전화번호로 새로운 지점에 코치 계정 생성
    new_coach = Member(
        phone=coach.phone,
        name=coach.name,
        hashed_password=coach.hashed_password,  # 동일한 비밀번호
        role=coach.role,
        gym_id=target_gym_id,
        status="활성",
        gender=coach.gender,
        birth_date=coach.birth_date,
        crossfit_experience=coach.crossfit_experience,
        squat_1rm=coach.squat_1rm,
        deadlift_1rm=coach.deadlift_1rm,
        bench_1rm=coach.bench_1rm,
        height=coach.height,
        weight=coach.weight,
        activity_level=coach.activity_level,
        workout_goal=coach.workout_goal,
        membership=coach.membership,
        start_date=coach.start_date,
        end_date=coach.end_date,
        memo=coach.memo,
        tags=coach.tags,
        is_active=True
    )

    db.add(new_coach)
    db.commit()
    db.refresh(new_coach)

    return {"message": f"{coach.name} 코치를 {target_gym.name}에 추가했습니다.", "coach_id": new_coach.id}
