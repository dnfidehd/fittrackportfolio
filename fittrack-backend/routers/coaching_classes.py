from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel

from database import get_db
from models import CoachingClass, CoachingClassAssignment, Member, Gym, WorkSchedule, WorkScheduleTemplate
from schemas import (
    CoachingClassCreate, CoachingClassUpdate, CoachingClassResponse,
    CoachingClassAssignmentCreate, CoachingClassAssignmentWithDetails,
    CoachingClassCalendarItem
)
from schemas.coaching_class import CoachingClassAutoAssignRequest
from routers.auth import get_current_user
import json
import google.generativeai as genai
from config import settings

router = APIRouter(
    tags=["coaching_classes"],
    responses={404: {"description": "Not found"}},
)

STAFF_ROLES = {"subcoach", "coach", "admin", "superadmin"}
READABLE_ROLES = STAFF_ROLES | {"user"}


class AssignmentCopyDayRequest(BaseModel):
    source_date: date
    target_date: date


class AssignmentCopyWeekRequest(BaseModel):
    source_week_start: date
    target_week_start: date


def ensure_gym_access(current_user: Member, gym_id: int, db: Session) -> None:
    """회원은 본인 지점만, 코치/서브코치는 소속 지점만, 관리자 계정은 모든 지점 접근을 허용한다."""
    if current_user.role in {"admin", "superadmin"}:
        return

    if current_user.role in {"coach", "subcoach"}:
        coach_in_gym = db.query(Member).filter(
            Member.phone == current_user.phone,
            Member.gym_id == gym_id,
            Member.role.in_(["coach", "subcoach"])
        ).first()
        if not coach_in_gym:
            raise HTTPException(status_code=403, detail="해당 지점에 접근할 권한이 없습니다")
        return

    if current_user.role == "user" and gym_id != (current_user.gym_id or 1):
        raise HTTPException(status_code=403, detail="해당 지점에 접근할 권한이 없습니다")


def build_class_response(coaching_class: CoachingClass) -> CoachingClassResponse:
    """수업 응답 객체 생성"""
    return CoachingClassResponse(
        id=coaching_class.id,
        gym_id=coaching_class.gym_id,
        title=coaching_class.title,
        start_time=coaching_class.start_time,
        end_time=coaching_class.end_time,
        days_of_week=coaching_class.days_of_week,
        max_participants=coaching_class.max_participants,
        description=coaching_class.description,
        color=coaching_class.color,
        is_active=coaching_class.is_active,
        created_at=coaching_class.created_at,
        updated_at=coaching_class.updated_at
    )


def build_assignment_response(assignment: CoachingClassAssignment,
                             coach_name: str,
                             class_title: str) -> CoachingClassAssignmentWithDetails:
    """배정 응답 객체 생성"""
    return CoachingClassAssignmentWithDetails(
        id=assignment.id,
        coaching_class_id=assignment.coaching_class_id,
        coaching_class_title=class_title,
        coach_id=assignment.coach_id,
        coach_name=coach_name,
        date=assignment.date,
        status=assignment.status,
        memo=assignment.memo,
        created_at=assignment.created_at
    )


def build_monthly_class_slots(classes: List[CoachingClass], first_day: date, last_day: date) -> List[dict]:
    """해당 월에 실제 배정해야 하는 수업 슬롯을 생성한다."""
    class_data = []
    current = first_day
    while current <= last_day:
        weekday = current.weekday()
        day_classes = [cls for cls in classes if str(weekday) in cls.days_of_week.split(',')]
        for cls in day_classes:
            class_data.append({
                "date": current.isoformat(),
                "class_id": cls.id,
                "title": cls.title,
                "start_time": cls.start_time,
                "end_time": cls.end_time
            })
        current += timedelta(days=1)
    return class_data


def validate_auto_assignments(assignments_data: list, class_data: List[dict], coaches: List[Member]) -> None:
    """AI 응답이 모든 슬롯을 정확히 한 번씩 채우고 시간 충돌이 없는지 검증한다."""
    if not isinstance(assignments_data, list):
        raise HTTPException(status_code=500, detail="AI 응답 형식이 올바르지 않습니다.")

    valid_coach_ids = {coach.id for coach in coaches}
    slot_map = {(slot["date"], slot["class_id"]): slot for slot in class_data}
    assigned_slots = set()
    coach_schedule_map = {}

    for item in assignments_data:
        if not isinstance(item, dict):
            raise HTTPException(status_code=500, detail="AI 응답 항목 형식이 올바르지 않습니다.")

        date_str = item.get("date")
        class_id = item.get("class_id")
        coach_id = item.get("coach_id")
        slot_key = (date_str, class_id)

        if slot_key not in slot_map:
            raise HTTPException(status_code=500, detail="AI가 유효하지 않은 수업 슬롯을 반환했습니다.")
        if coach_id not in valid_coach_ids:
            raise HTTPException(status_code=500, detail="AI가 유효하지 않은 코치를 반환했습니다.")
        if slot_key in assigned_slots:
            raise HTTPException(status_code=500, detail="AI가 동일한 수업 슬롯을 중복 배정했습니다.")

        slot = slot_map[slot_key]
        coach_day_key = (coach_id, date_str)
        coach_schedule = coach_schedule_map.setdefault(coach_day_key, [])
        slot_start = datetime.strptime(slot["start_time"], "%H:%M").time()
        slot_end = datetime.strptime(slot["end_time"], "%H:%M").time()
        for existing_start, existing_end in coach_schedule:
            if slot_start < existing_end and existing_start < slot_end:
                raise HTTPException(status_code=500, detail="AI가 겹치는 시간대에 같은 코치를 중복 배정했습니다.")

        assigned_slots.add(slot_key)
        coach_schedule.append((slot_start, slot_end))

    if assigned_slots != set(slot_map.keys()):
        raise HTTPException(status_code=500, detail="AI가 일부 수업 슬롯을 누락했거나 초과 배정했습니다.")


def ensure_covering_work_schedule(
    coach_id: int,
    gym_id: int,
    target_date: date,
    class_start: str,
    class_end: str,
    db: Session
) -> None:
    """배정 대상 시간이 근무표 또는 고정 템플릿 범위 안에 있는지 확인한다."""
    schedules = db.query(WorkSchedule).filter(
        WorkSchedule.gym_id == gym_id,
        WorkSchedule.coach_id == coach_id,
        WorkSchedule.date == target_date,
        WorkSchedule.status != "cancelled",
        WorkSchedule.shift_type != "holiday"
    ).all()

    if any(schedule.start_time <= class_start and schedule.end_time >= class_end for schedule in schedules):
        return

    weekday = target_date.weekday()
    templates = db.query(WorkScheduleTemplate).filter(
        WorkScheduleTemplate.gym_id == gym_id,
        WorkScheduleTemplate.coach_id == coach_id,
        WorkScheduleTemplate.shift_type != "holiday"
    ).all()

    created_schedule = False
    for template in templates:
        template_days = [int(day) for day in template.days_of_week.split(',') if day != ""]
        if weekday not in template_days:
            continue
        if not (template.start_time <= class_start and template.end_time >= class_end):
            continue

        existing_schedule = db.query(WorkSchedule).filter(
            WorkSchedule.gym_id == gym_id,
            WorkSchedule.coach_id == coach_id,
            WorkSchedule.date == target_date,
            WorkSchedule.start_time == template.start_time,
            WorkSchedule.end_time == template.end_time,
            WorkSchedule.status != "cancelled"
        ).first()

        if not existing_schedule:
            db.add(WorkSchedule(
                gym_id=gym_id,
                coach_id=coach_id,
                date=target_date,
                start_time=template.start_time,
                end_time=template.end_time,
                work_category="general",
                shift_type=template.shift_type,
                memo=template.memo,
                status="scheduled"
            ))
            db.flush()
        created_schedule = True
        break

    if created_schedule:
        return

    raise HTTPException(
        status_code=400,
        detail="근무표에 없는 시간입니다. 먼저 해당 코치의 근무표를 등록해주세요"
    )


def validate_assignment_availability(
    coach_id: int,
    coaching_class: CoachingClass,
    target_date: date,
    db: Session,
    current_assignment_class_id: Optional[int] = None
) -> None:
    """근무표 범위와 기존 수업 배정 충돌을 함께 검증한다."""
    class_start = coaching_class.start_time
    class_end = coaching_class.end_time

    conflicting_assignments = db.query(CoachingClassAssignment).join(
        CoachingClass
    ).filter(
        CoachingClassAssignment.coach_id == coach_id,
        CoachingClassAssignment.date == target_date,
        CoachingClassAssignment.status != "cancelled",
        CoachingClass.id != (current_assignment_class_id or coaching_class.id)
    ).all()

    for assignment in conflicting_assignments:
        other_class = assignment.coaching_class
        if class_start < other_class.end_time and class_end > other_class.start_time:
            raise HTTPException(status_code=400, detail="같은 시간대에 이미 배정된 수업이 있습니다")

    ensure_covering_work_schedule(
        coach_id=coach_id,
        gym_id=coaching_class.gym_id,
        target_date=target_date,
        class_start=class_start,
        class_end=class_end,
        db=db
    )


def copy_assignments_between_dates(source_date: date, target_date: date, gym_id: int, db: Session) -> int:
    source_assignments = db.query(CoachingClassAssignment).join(
        CoachingClass, CoachingClassAssignment.coaching_class_id == CoachingClass.id
    ).filter(
        CoachingClass.gym_id == gym_id,
        CoachingClassAssignment.date == source_date,
        CoachingClassAssignment.status != "cancelled"
    ).all()

    target_assignments = db.query(CoachingClassAssignment).join(
        CoachingClass, CoachingClassAssignment.coaching_class_id == CoachingClass.id
    ).filter(
        CoachingClass.gym_id == gym_id,
        CoachingClassAssignment.date == target_date,
        CoachingClassAssignment.status != "cancelled"
    ).all()

    for assignment in source_assignments:
        coaching_class = db.query(CoachingClass).filter(CoachingClass.id == assignment.coaching_class_id).first()
        if not coaching_class:
            raise HTTPException(status_code=404, detail="복사 대상 수업을 찾을 수 없습니다")
        validate_assignment_availability(
            coach_id=assignment.coach_id,
            coaching_class=coaching_class,
            target_date=target_date,
            db=db,
            current_assignment_class_id=assignment.coaching_class_id
        )

    for existing in target_assignments:
        existing.status = "cancelled"

    created_count = 0
    for assignment in source_assignments:
        db.add(CoachingClassAssignment(
            coaching_class_id=assignment.coaching_class_id,
            coach_id=assignment.coach_id,
            date=target_date,
            memo=assignment.memo,
            status="scheduled"
        ))
        created_count += 1

    db.commit()
    return created_count


# ✅ 1. 모든 수업 조회
@router.get("/", response_model=List[CoachingClassResponse])
def get_coaching_classes(
    gym_id: Optional[int] = None,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    지점의 모든 수업 조회 (coach, subcoach, user만 가능)
    - gym_id: 특정 지점만 필터링 (선택사항)
    """
    if current_user.role not in READABLE_ROLES:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # gym_id 결정
    if gym_id is None:
        gym_id = current_user.gym_id or 1
    else:
        ensure_gym_access(current_user, gym_id, db)

    classes = db.query(CoachingClass).filter(
        CoachingClass.gym_id == gym_id,
        CoachingClass.is_active == True
    ).order_by(CoachingClass.start_time).all()

    return [build_class_response(cls) for cls in classes]


# ✅ 2. 수업 생성 (coach, subcoach만)
@router.post("/", response_model=CoachingClassResponse)
def create_coaching_class(
    data: CoachingClassCreate,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 수업 생성"""
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    gym_id = current_user.gym_id or 1

    coaching_class = CoachingClass(
        gym_id=gym_id,
        title=data.title,
        start_time=data.start_time,
        end_time=data.end_time,
        days_of_week=data.days_of_week,
        max_participants=data.max_participants,
        description=data.description,
        color=data.color,
        is_active=True
    )
    db.add(coaching_class)
    db.commit()
    db.refresh(coaching_class)

    return build_class_response(coaching_class)


# ✅ 3. 수업 수정
@router.put("/{class_id}", response_model=CoachingClassResponse)
def update_coaching_class(
    class_id: int,
    data: CoachingClassUpdate,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """수업 정보 수정 (coach, subcoach만)"""
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    coaching_class = db.query(CoachingClass).filter(CoachingClass.id == class_id).first()
    if not coaching_class:
        raise HTTPException(status_code=404, detail="수업을 찾을 수 없습니다")

    # 자신의 지점인지 확인
    if current_user.role not in {"admin", "superadmin"} and coaching_class.gym_id != (current_user.gym_id or 1):
        raise HTTPException(status_code=403, detail="해당 지점의 수업만 수정할 수 있습니다")

    # 업데이트
    if data.title is not None:
        coaching_class.title = data.title
    if data.start_time is not None:
        coaching_class.start_time = data.start_time
    if data.end_time is not None:
        coaching_class.end_time = data.end_time
    if data.days_of_week is not None:
        coaching_class.days_of_week = data.days_of_week
    if data.max_participants is not None:
        coaching_class.max_participants = data.max_participants
    if data.description is not None:
        coaching_class.description = data.description
    if data.color is not None:
        coaching_class.color = data.color
    if data.is_active is not None:
        coaching_class.is_active = data.is_active

    db.commit()
    db.refresh(coaching_class)

    return build_class_response(coaching_class)


# ✅ 4. 수업 삭제 (소프트 삭제)
@router.delete("/{class_id}")
def delete_coaching_class(
    class_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """수업 삭제 (소프트 삭제, coach, subcoach만)"""
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    coaching_class = db.query(CoachingClass).filter(CoachingClass.id == class_id).first()
    if not coaching_class:
        raise HTTPException(status_code=404, detail="수업을 찾을 수 없습니다")

    if current_user.role not in {"admin", "superadmin"} and coaching_class.gym_id != (current_user.gym_id or 1):
        raise HTTPException(status_code=403, detail="해당 지점의 수업만 삭제할 수 있습니다")

    # 소프트 삭제
    coaching_class.is_active = False
    db.commit()

    return {"message": "수업이 삭제되었습니다"}


# ✅ 5. 월별 캘린더 조회 (수업 + 배정 정보)
@router.get("/calendar/monthly", response_model=dict)
def get_monthly_coaching_class_calendar(
    year_month: str = Query(..., description="YYYY-MM 형식"),
    gym_id: Optional[int] = None,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    월별 캘린더 뷰 (수업 + 배정 정보, coach, subcoach, user만)
    - year_month: "2026-03"
    - 각 날짜의 요일에 맞는 수업과 배정된 코치를 반환
    """
    if current_user.role not in READABLE_ROLES:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    if gym_id is None:
        gym_id = current_user.gym_id or 1
    else:
        ensure_gym_access(current_user, gym_id, db)

    # year_month 파싱
    try:
        year, month = map(int, year_month.split('-'))
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM")

    # 활성 수업 조회
    classes = db.query(CoachingClass).filter(
        CoachingClass.gym_id == gym_id,
        CoachingClass.is_active == True
    ).all()

    # 월별 배정 조회 (취소된 배정 제외)
    assignments = db.query(CoachingClassAssignment).filter(
        CoachingClassAssignment.date >= first_day,
        CoachingClassAssignment.date <= last_day,
        CoachingClassAssignment.status != "cancelled"
    ).all()

    # 캘린더 구성
    calendar = {}
    current = first_day
    while current <= last_day:
        weekday = current.weekday()  # 0:월, 1:화, ..., 6:일

        # 현재 날짜의 요일에 맞는 수업 필터링
        day_classes = [cls for cls in classes if str(weekday) in cls.days_of_week.split(',')]

        # 각 수업에 배정된 코치 찾기
        day_data = []
        for cls in day_classes:
            assigned_coaches = []
            for assignment in assignments:
                if assignment.coaching_class_id == cls.id and assignment.date == current:
                    coach = db.query(Member).filter(Member.id == assignment.coach_id).first()
                    assigned_coaches.append({
                        "assignment_id": assignment.id,
                        "coach_id": assignment.coach_id,
                        "coach_name": coach.name if coach else "Unknown",
                        "coach_color": coach.color if coach else "#3182F6",
                        "status": assignment.status
                    })

            day_data.append({
                "coaching_class": build_class_response(cls),
                "assigned_coaches": assigned_coaches
            })

        if day_data:
            calendar[current.isoformat()] = day_data

        current += timedelta(days=1)

    return {
        "year_month": year_month,
        "calendar": calendar
    }


# ✅ 6. 코치 배정 생성
@router.post("/assignments", response_model=CoachingClassAssignmentWithDetails)
def create_coaching_class_assignment(
    data: CoachingClassAssignmentCreate,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    수업에 코치 배정 (coach, subcoach만)
    - 중복 배정 체크
    - 시간대 충돌 체크
    """
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    # 수업 확인
    coaching_class = db.query(CoachingClass).filter(
        CoachingClass.id == data.coaching_class_id
    ).first()
    if not coaching_class:
        raise HTTPException(status_code=404, detail="수업을 찾을 수 없습니다")

    # 코치 확인
    coach = db.query(Member).filter(Member.id == data.coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="코치를 찾을 수 없습니다")

    # 중복 배정 체크 (같은 날짜, 같은 수업, 같은 코치)
    existing = db.query(CoachingClassAssignment).filter(
        CoachingClassAssignment.coaching_class_id == data.coaching_class_id,
        CoachingClassAssignment.coach_id == data.coach_id,
        CoachingClassAssignment.date == data.date,
        CoachingClassAssignment.status != "cancelled"
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 배정된 코치입니다")

    validate_assignment_availability(
        coach_id=data.coach_id,
        coaching_class=coaching_class,
        target_date=data.date,
        db=db
    )

    # 배정 생성
    assignment = CoachingClassAssignment(
        coaching_class_id=data.coaching_class_id,
        coach_id=data.coach_id,
        date=data.date,
        memo=data.memo,
        status="scheduled"
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return build_assignment_response(assignment, coach.name, coaching_class.title)


# ✅ 7. 코치 배정 취소
@router.delete("/assignments/{assignment_id}")
def delete_coaching_class_assignment(
    assignment_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """코치 배정 취소 (coach, subcoach만)"""
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    assignment = db.query(CoachingClassAssignment).filter(
        CoachingClassAssignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="배정을 찾을 수 없습니다")

    # 상태를 cancelled로 변경 (소프트 삭제)
    assignment.status = "cancelled"
    db.commit()

    return {"message": "배정이 취소되었습니다"}


@router.post("/assignments/copy-day")
def copy_day_assignments(
    payload: AssignmentCopyDayRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    gym_id = current_user.gym_id or 1
    created_count = copy_assignments_between_dates(payload.source_date, payload.target_date, gym_id, db)
    return {"message": f"{created_count}건의 배정을 복사했습니다.", "created_count": created_count}


@router.post("/assignments/copy-week")
def copy_week_assignments(
    payload: AssignmentCopyWeekRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="코치 이상의 권한이 필요합니다")

    gym_id = current_user.gym_id or 1
    total_created = 0
    for day_offset in range(7):
        source_date = payload.source_week_start + timedelta(days=day_offset)
        target_date = payload.target_week_start + timedelta(days=day_offset)
        total_created += copy_assignments_between_dates(source_date, target_date, gym_id, db)

    return {"message": f"{total_created}건의 주간 배정을 복제했습니다.", "created_count": total_created}


# ✅ 8. 코치별 수업 통계
@router.get("/stats/monthly", response_model=dict)
def get_monthly_coaching_class_stats(
    year_month: str = Query(..., description="YYYY-MM 형식"),
    gym_id: Optional[int] = None,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    월별 코치별 수업 통계 (coach, subcoach, user만)
    - 수업 횟수
    - 예상 급여 (수업당 급여 * 횟수)
    """
    if current_user.role not in READABLE_ROLES:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    if gym_id is None:
        gym_id = current_user.gym_id or 1
    else:
        ensure_gym_access(current_user, gym_id, db)

    # year_month 파싱
    try:
        year, month = map(int, year_month.split('-'))
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM")

    # 월별 배정 조회 (cancelled 제외)
    assignments = db.query(CoachingClassAssignment).filter(
        CoachingClassAssignment.date >= first_day,
        CoachingClassAssignment.date <= last_day,
        CoachingClassAssignment.status != "cancelled"
    ).all()

    # 코치별 통계 구성
    coach_stats = {}
    for assignment in assignments:
        coach_id = assignment.coach_id
        coach = db.query(Member).filter(Member.id == coach_id).first()

        if coach_id not in coach_stats:
            coach_stats[coach_id] = {
                "coach_id": coach_id,
                "coach_name": coach.name if coach else "Unknown",
                "class_count": 0,
                "class_wage": coach.class_wage if coach else 0,
                "expected_wage": 0
            }

        coach_stats[coach_id]["class_count"] += 1
        coach_stats[coach_id]["expected_wage"] = (
            coach_stats[coach_id]["class_count"] * coach_stats[coach_id]["class_wage"]
        )

    return {
        "year_month": year_month,
        "stats": list(coach_stats.values())
    }


# ✅ 9. AI 코치 자동 배정 (BETA)
@router.post("/auto-assign")
def auto_assign_coaching_classes(
    request: CoachingClassAutoAssignRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI를 이용한 월별 수업 자동 배정 (BETA)
    """
    if current_user.role not in ["coach", "admin", "superadmin", "subcoach"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    gym_id = current_user.gym_id or 1

    try:
        year, month = map(int, request.year_month.split('-'))
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM")

    # 1. 수업 목록 조회
    classes = db.query(CoachingClass).filter(
        CoachingClass.gym_id == gym_id,
        CoachingClass.is_active == True
    ).all()

    # 2. 코치 목록 조회
    coaches = db.query(Member).filter(
        Member.gym_id == gym_id,
        Member.role.in_(["coach", "subcoach", "admin"])
    ).all()

    if not classes or not coaches:
        raise HTTPException(status_code=400, detail="수업이나 코치가 등록되어 있지 않습니다.")

    # 3. 프롬프트 데이터 구성
    coach_data = [{"id": c.id, "name": c.name, "role": c.role} for c in coaches]
    class_data = build_monthly_class_slots(classes, first_day, last_day)

    if not class_data:
        raise HTTPException(status_code=400, detail="해당 월에 배정할 수업 슬롯이 없습니다.")

    # 4. Gemini 호출
    GEMINI_API_KEY = settings.gemini_api_key
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI API 키가 설정되지 않았습니다.")
    
    prompt = f"""
    당신은 피트니스 센터의 스마트 스케줄러(AI)입니다.
    사용자(관장/매니저)가 입력한 배정 규칙 사항을 분석하여 한 달 치의 수업 배정표를 작성하세요.

    [규칙 명세]
    "{request.rules}"

    [코치 목록 (이 코치들만 배정 가능)]
    {json.dumps(coach_data, ensure_ascii=False)}

    [배정해야 할 전체 수업 슬롯]
    {json.dumps(class_data, ensure_ascii=False)}

    [지시사항]
    1. [배정해야 할 전체 수업 슬롯]의 모든 항목에 대해 딱 1명씩만 코치를 배정하세요. 무조건 모든 슬롯이 채워져야합니다.
    2. 시간대(start_time ~ end_time)가 겹치는 여러 수업에 동일한 코치(coach_id)를 배정하지 마세요.
    3. [규칙 명세]에 특별히 명시된 선호/기피 조건, 특정 코치의 전담 시간대 등이 있다면 최대한 반영하세요. (예: A는 오전, B는 오후) 먄약 내용이 없다면 균등하게.
    4. 당신의 답변은 어떠한 부연 설명이나 마크다운 코드 블록(```json 등)도 포함하지 않은 순수한 JSON 배열(Array) 형태여야만 합니다. 오류가 발생하므로 다른 텍스트는 절대 출력하지 마세요.

    [반환 JSON 형식 예시]
    [
      {{"date": "2026-03-01", "class_id": 1, "coach_id": 2}},
      {{"date": "2026-03-02", "class_id": 2, "coach_id": 3}}
    ]
    """

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        
        # JSON 블록 정리 (만에 하나 붙어있을 경우)
        if text_resp.startswith("```json"):
            text_resp = text_resp[7:]
        elif text_resp.startswith("```"):
            text_resp = text_resp[3:]
        if text_resp.endswith("```"):
            text_resp = text_resp[:-3]
            
        text_resp = text_resp.strip()
        assignments_data = json.loads(text_resp)

        validate_auto_assignments(assignments_data, class_data, coaches)
        class_map = {cls.id: cls for cls in classes}
        for item in assignments_data:
            coaching_class = class_map.get(item["class_id"])
            if not coaching_class:
                raise HTTPException(status_code=500, detail="AI가 존재하지 않는 수업을 반환했습니다.")
            validate_assignment_availability(
                coach_id=item["coach_id"],
                coaching_class=coaching_class,
                target_date=datetime.strptime(item["date"], "%Y-%m-%d").date(),
                db=db,
                current_assignment_class_id=item["class_id"]
            )

        # 검증이 끝난 뒤 기존 배정을 교체한다.
        assignments_to_delete = db.query(CoachingClassAssignment).join(
            CoachingClass
        ).filter(
            CoachingClass.gym_id == gym_id,
            CoachingClassAssignment.date >= first_day,
            CoachingClassAssignment.date <= last_day
        ).all()

        for assignment in assignments_to_delete:
            db.delete(assignment)

        # 5. DB 저장
        count = 0
        for item in assignments_data:
            new_assign = CoachingClassAssignment(
                coaching_class_id=item["class_id"],
                coach_id=item["coach_id"],
                date=datetime.strptime(item["date"], "%Y-%m-%d").date(),
                status="scheduled"
            )
            db.add(new_assign)
            count += 1
        
        db.commit()
        return {"message": "AI 자동 배정이 완료되었습니다.", "count": count}

    except Exception as e:
        db.rollback()
        print(f"AI Auto Assign Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 배정 생성 중 오류가 발생했습니다: {str(e)}")
