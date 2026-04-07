from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, func

# DB 및 모델 임포트
from database import get_db
from models import Workout, Member, Attendance
from schemas import WorkoutCreate, WorkoutResponse, WorkoutUpdate
from routers.auth import get_current_user

router = APIRouter()

# 1. 운동 기록 생성 (과거 날짜도 출석 인정!)
@router.post("/", response_model=WorkoutResponse)
def create_workout(
    workout: WorkoutCreate, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 1. 날짜 문자열 정리 (YYYY-MM-DD)
    try:
        if workout.date:
            # "2024-01-28T00:00:00" -> "2024-01-28"
            final_date_str = str(workout.date).split("T")[0].split(" ")[0]
        else:
            final_date_str = str(date.today())
    except:
        final_date_str = str(date.today())

    # 2. 운동 기록 저장
    db_workout = Workout(
        member_id=current_user.id,
        member_name=current_user.name,
        date=final_date_str, 
        workout=workout.workout, 
        time=workout.time,
        type="Personal",
        description=None, 
        is_public=True
    )
    db.add(db_workout)
    
    # ======================================================
    # ✅ [수정됨] 날짜가 언제든, 그 날짜로 출석 생성
    # ======================================================
    try:
        # 문자열 날짜("2024-01-27")를 파이썬 날짜 객체(date)로 변환
        target_date_obj = datetime.strptime(final_date_str, "%Y-%m-%d").date()
        
        # 해당 날짜에 출석 기록이 있는지 확인
        existing_attendance = db.query(Attendance).filter(
            Attendance.member_id == current_user.id,
            Attendance.date == target_date_obj 
        ).first()

        if not existing_attendance:
            new_attendance = Attendance(
                gym_id=current_user.gym_id,
                member_id=current_user.id,
                date=target_date_obj, # ✅ 기록한 그 날짜로 저장
                check_in_time=datetime.now() # 실제 DB 입력 시간
            )
            db.add(new_attendance)
            print(f"✅ [Auto] {final_date_str} 날짜로 출석 생성 완료!")
        else:
            print(f"ℹ️ [Info] {final_date_str}엔 이미 출석이 있습니다.")

    except Exception as e:
        print(f"⚠️ 출석 처리 중 오류: {e}")

    # 3. DB 저장
    try:
        db.commit()
        db.refresh(db_workout)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="저장 실패")
        
    return db_workout

    return db_workout

# 1-2. 운동 기록 수정 (PUT)
@router.put("/{workout_id}", response_model=WorkoutResponse)
def update_workout(
    workout_id: int,
    workout_update: WorkoutUpdate,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    # 1. 기존 기록 확인
    db_workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not db_workout:
        raise HTTPException(status_code=404, detail="Workout not found")
        
    # 2. 권한 확인 (본인 또는 관리자)
    if db_workout.member_id != current_user.id and current_user.role != 'subcoach':
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # 3. 필드 업데이트
    if workout_update.workout is not None:
        db_workout.workout = workout_update.workout
    if workout_update.time is not None:
        db_workout.time = workout_update.time
    if workout_update.description is not None:
        db_workout.description = workout_update.description
        
    # 4. 날짜 변경 시 처리
    old_date = db_workout.date
    if workout_update.date is not None:
        # 날짜 포맷 정리
        try:
            new_date_str = str(workout_update.date).split("T")[0].split(" ")[0]
        except:
            new_date_str = str(date.today())
            
        db_workout.date = new_date_str
        
        # 날짜가 변경되었다면, 새 날짜에 출석 기록 생성 체크
        if old_date != new_date_str:
            try:
                target_date_obj = datetime.strptime(new_date_str, "%Y-%m-%d").date()
                
                existing_attendance = db.query(Attendance).filter(
                    Attendance.member_id == db_workout.member_id,
                    Attendance.date == target_date_obj
                ).first()
                
                if not existing_attendance:
                    new_attendance = Attendance(
                        gym_id=current_user.gym_id,
                        member_id=db_workout.member_id,
                        date=target_date_obj,
                        check_in_time=datetime.now()
                    )
                    db.add(new_attendance)
                    print(f"✅ [Auto-Update] {new_date_str} 날짜로 출석 생성 완료!")
            except Exception as e:
                print(f"⚠️ 출석 자동 생성 실패: {e}")

    try:
        db.commit()
        db.refresh(db_workout)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="수정 실패")
        
    return db_workout

# 2. 내 운동 기록 조회
@router.get("/me", response_model=List[WorkoutResponse])
def read_my_workouts(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    return db.query(Workout).filter(
        Workout.member_id == current_user.id
    ).order_by(
        Workout.date.desc(), 
        Workout.id.desc()
    ).offset(skip).limit(limit).all()

# 3. 관리자용 조회
@router.get("/admin", response_model=List[WorkoutResponse])
def read_workouts_admin(
    skip: int = 0, 
    limit: int = 300,
    member_name: Optional[str] = Query(None),
    workout_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    query = db.query(Workout).join(Member).filter(
        Member.gym_id == current_user.gym_id
    )

    if member_name:
        query = query.filter(Workout.member_name.ilike(f"%{member_name}%"))
    if workout_name:
        query = query.filter(Workout.workout.ilike(f"%{workout_name}%"))
    if date_from:
        query = query.filter(Workout.date >= date_from)
    if date_to:
        query = query.filter(Workout.date <= date_to)

    return query.order_by(
        Workout.date.desc(), 
        Workout.id.desc()
    ).offset(skip).limit(limit).all()

# 4. 삭제
@router.delete("/{workout_id}")
def delete_workout(
    workout_id: int, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    if workout.member_id != current_user.id and current_user.role != 'subcoach':
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
        
    db.delete(workout)
    db.commit()
    return {"message": "Successfully deleted"}

# =========================================================
# 🛠️ [긴급 복구] 누락된 출석 채워넣기 (Sync)
# =========================================================
@router.get("/fix-attendance")
def sync_missing_attendance(db: Session = Depends(get_db)):
    """
    운동 기록(Workout)은 있는데 출석(Attendance)이 없는 날짜를 찾아
    자동으로 출석을 만들어주는 복구 도구입니다.
    """
    try:
        # 1. 모든 운동 기록 조회
        all_workouts = db.query(Workout).all()
        count = 0
        
        for wk in all_workouts:
            try:
                # 날짜 변환
                date_str = wk.date.split("T")[0].split(" ")[0]
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                
                # 해당 날짜/회원의 출석 확인
                att = db.query(Attendance).filter(
                    Attendance.member_id == wk.member_id,
                    Attendance.date == date_obj
                ).first()
                
                # 출석 없으면 생성
                if not att:
                    # 회원의 gym_id 찾기
                    member = db.query(Member).filter(Member.id == wk.member_id).first()
                    gym_id = member.gym_id if member else 1
                    
                    new_att = Attendance(
                        gym_id=gym_id,
                        member_id=wk.member_id,
                        date=date_obj,
                        check_in_time=datetime.now()
                    )
                    db.add(new_att)
                    count += 1
            except Exception as e:
                print(f"Error skipping workout {wk.id}: {e}")
                continue
                
        db.commit()
        return {"message": f"복구 완료! 총 {count}개의 누락된 출석이 생성되었습니다."}
        
    except Exception as e:
        return {"error": str(e)}

@router.get("/fix-dates")
def fix_broken_dates(db: Session = Depends(get_db)):
    try:
        sql = text("UPDATE workouts SET date = SUBSTR(date, 1, 10) WHERE date LIKE '%T%' OR date LIKE '% %';")
        db.execute(sql)
        db.commit()
        return {"message": "날짜 형식 복구 완료"}
    except Exception as e:
        return {"error": str(e)}
