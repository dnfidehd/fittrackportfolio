from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import uuid
import pandas as pd # ✅ [신규] 엑셀 처리
import io # ✅ [신규] 엑셀 스트림 처리
from fastapi.responses import StreamingResponse # ✅ [신규] 파일 다운로드 응답
from pydantic import BaseModel, Field

from database import get_db
from security import get_current_user, get_current_user_optional

# ✅ 모든 모델과 스키마는 models.py에서 가져옵니다 (schemas.py 없음) -> 수정: schemas.py 있음
from models import (
    Competition, CompetitionEvent, CompetitionScore, Member, CompetitionRegistration, CompetitionGym,
    Notification
)
from schemas import (
    CompetitionCreate, CompetitionResponse, CompetitionUpdate,
    CompEventCreate, CompEventResponse,
    CompScoreCreate, CompLeaderboardItem,
    OverallLeaderboardItem,
    CompetitionGymResponse
)
from constants import Role
from utils.auth import assert_roles
from utils.rate_limit import (
    check_failed_attempt_lock,
    check_rate_limit,
    register_failed_attempt,
    reset_failed_attempts,
)

# ✅ [신규] 게스트 패스코드 확인용 스키마
class GuestVerifyRequest(BaseModel):
    competition_id: int
    passcode: str

router = APIRouter()

COMPETITION_STAFF_ROLES = [Role.SUBCOACH, Role.COACH, Role.SUPERADMIN, Role.ADMIN]


def assert_competition_staff(current_user: Member) -> None:
    assert_roles(current_user, COMPETITION_STAFF_ROLES)


def is_competition_staff(current_user: Optional[Member]) -> bool:
    return bool(current_user and current_user.role in COMPETITION_STAFF_ROLES)


def assert_superadmin_competition_merge_access(current_user: Member, comp: Competition) -> None:
    assert_roles(current_user, [Role.SUPERADMIN], "중복 참가자 병합은 총관리자만 처리할 수 있습니다.")
    if current_user.role != Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail="총관리자만 중복 참가자 병합을 할 수 있습니다.")

# --- [신규] 관리자 승인용 요청 스키마 ---
class RegistrationStatusUpdate(BaseModel):
    status: str 

# --- [신규] 박스 초대용 요청 스키마 ---
class GymInviteRequest(BaseModel):
    gym_id: int


class CompetitionParticipantRef(BaseModel):
    member_id: Optional[int] = None
    member_name: str = Field(..., min_length=1)
    guest_phone: Optional[str] = None


class CompetitionParticipantMergeRequest(BaseModel):
    source: CompetitionParticipantRef
    target: CompetitionParticipantRef

# --- [신규] 헬퍼 함수: 이름 익명화 ---
def anonymize_name(name: str) -> str:
    if not name:
        return "Unknown"
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]

# ✅ [신규] 헬퍼 함수: 전화번호 마스킹
def mask_phone_number(phone: str) -> str:
    """
    전화번호 마스킹 함수
    예: "01012345678" → "010-12**-**78"
    """
    if not phone:
        return ""
    # 숫자만 추출
    cleaned = phone.replace("-", "").replace(" ", "")

    if len(cleaned) == 11:  # 01012345678
        return f"{cleaned[0:3]}-{cleaned[3:5]}**-**{cleaned[9:11]}"
    elif len(cleaned) == 10:  # 1012345678
        return f"{cleaned[0:3]}-{cleaned[3:5]}**-**{cleaned[8:10]}"
    else:
        return phone  # 형식이 맞지 않으면 그대로 반환

# --- 점수 계산 로직 ---
def parse_score(score_str: str, score_type: str):
    if not score_str: return 0
    clean_score = score_str.upper().replace('LB', '').replace('KG', '').replace('REPS', '').strip()

    if score_type == 'time':
        if 'CAP' in clean_score:
            try:
                if '+' in clean_score:
                    parts = clean_score.split('+')
                    extra_reps = int(parts[1].strip())
                else:
                    extra_reps = 0
                return 1000000 - extra_reps
            except:
                return 1000000
        try:
            if ':' in clean_score:
                m, s = clean_score.split(':')
                return int(m) * 60 + int(s)
            return int(float(clean_score))
        except:
            return 999999
    else:
        try:
            return float(clean_score)
        except:
            return 0.0


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits or None


def participant_matches_score(score: CompetitionScore, participant: CompetitionParticipantRef) -> bool:
    if participant.member_id is not None:
        return score.member_id == participant.member_id

    if score.member_id is not None:
        return False

    if score.member_name != participant.member_name:
        return False

    return normalize_phone(score.guest_phone) == normalize_phone(participant.guest_phone)


def get_competition_participant_scores(
    db: Session,
    comp_id: int,
    participant: CompetitionParticipantRef,
) -> List[CompetitionScore]:
    scores = (
        db.query(CompetitionScore)
        .join(CompetitionEvent, CompetitionScore.event_id == CompetitionEvent.id)
        .filter(CompetitionEvent.competition_id == comp_id)
        .all()
    )
    return [score for score in scores if participant_matches_score(score, participant)]

# ✅ [신규] 대회 데이터에 코치 이름 추가 헬퍼 함수
def enrich_with_admins(comp, db: Session) -> dict:
    comp_dict = CompetitionResponse.model_validate(comp).model_dump()
    gym_ids = [g.gym_id for g in comp.participating_gyms if g.status == 'accepted']
    if gym_ids:
        from models import Member # For safe query
        admins = db.query(Member.name).filter(
            Member.gym_id.in_(gym_ids),
            Member.role.in_(['subcoach', 'coach', 'admin', 'superadmin'])
        ).all()
        comp_dict['admin_names'] = [a[0] for a in admins]
    else:
        comp_dict['admin_names'] = []
    return comp_dict

# 1. 대회 생성
@router.post("/", response_model=CompetitionResponse)
def create_competition(comp: CompetitionCreate, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    assert_competition_staff(current_user)
    new_comp = Competition(
        title=comp.title,
        description=comp.description,
        start_date=comp.start_date,
        end_date=comp.end_date,
        is_active=True,
        # ✅ [신규] 보안 옵션 및 소유자 저장
        is_private=comp.is_private,
        show_leaderboard_to_all=comp.show_leaderboard_to_all,
        show_wod_to_all=comp.show_wod_to_all,
        anonymize_for_all=comp.anonymize_for_all,
        guest_passcode=comp.guest_passcode, # ✅ [수정] 게스트 패스코드 저장 추가
        allow_invited_gym_settings=comp.allow_invited_gym_settings, # ✅ [신규]
        creator_id=current_user.id
    )
    db.add(new_comp)
    db.commit()
    db.refresh(new_comp)
    
    # ✅ [신규] 생성자의 박스를 자동으로 참여 박스로 등록
    host_gym_id = current_user.gym_id
    if host_gym_id:
        host_gym = CompetitionGym(
            competition_id=new_comp.id,
            gym_id=host_gym_id,
            status="accepted"
        )
        db.add(host_gym)
    
    # ✅ [신규] 초대된 박스들 추가
    if comp.invited_gym_ids:
        for gid in comp.invited_gym_ids:
            # 본인 박스는 위에서 이미 추가됨
            if gid == host_gym_id:
                continue
                
            # 중복 체크 (혹시 요청에 중복이 있을 경우)
            exists = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == new_comp.id,
                CompetitionGym.gym_id == gid
            ).first()
            
            if not exists:
                invited_gym = CompetitionGym(
                    competition_id=new_comp.id,
                    gym_id=gid,
                    status="accepted" 
                )
                db.add(invited_gym)
    
    db.commit()
    return enrich_with_admins(new_comp, db)

# 1-1. [신규] 코치용: 대회 참가 신청 대기 건수 (배지용)
# 422 에러 방지를 위해 /{id} 보다 위에 정의
@router.get("/pending-count")
def get_pending_registration_counts(
    current_user: Member = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. 내가 생성한(주최자) 대회 목록 조회
    # 코치나 슈퍼관리자만 가능하도록? 일단 코치 이상. (admin 역할 포함)
    if not is_competition_staff(current_user):
        return {"total_pending": 0, "competitions": {}}

    # 1. 대상 대회 조회 (권한에 따라 필터링)
    target_comp_ids = []

    if current_user.role == Role.SUPERADMIN:
        # 슈퍼관리자: 모든 대회
        comps = db.query(Competition.id).all()
        target_comp_ids = [c.id for c in comps]
    else:
        # 일반 관리자/코치: '내가 생성한 대회' + '공개 대회' + '내 박스가 참여 중인 대회'
        # 1) 전체 대회 가져와서 필터링 (복잡한 로직 재사용)
        all_comps = db.query(Competition).all()
        
        for comp in all_comps:
            # A. 내가 생성한 대회
            if comp.creator_id == current_user.id:
                target_comp_ids.append(comp.id)
                continue
                
            # B. 공개 대회
            if not comp.is_private:
                target_comp_ids.append(comp.id)
                continue
                
            # C. 내 박스가 참여 중인 대회
            if current_user.gym_id:
                is_participating = db.query(CompetitionGym).filter(
                    CompetitionGym.competition_id == comp.id,
                    CompetitionGym.gym_id == current_user.gym_id
                ).first()
                if is_participating:
                    target_comp_ids.append(comp.id)

    if not target_comp_ids:
        return {"total_pending": 0, "competitions": {}}

    # 2. 대상 대회의 'pending' 참가 신청수 조회 (권한 필터링)
    query = db.query(
        CompetitionRegistration.competition_id,
        func.count(CompetitionRegistration.id).label("count")
    ).filter(
        CompetitionRegistration.competition_id.in_(target_comp_ids),
        CompetitionRegistration.status == 'pending'
    )

    # ✅ [추가] 슈퍼관리자나 대회 호스트가 아닌 경우, 자기 박스 회원 것만 카운트
    if current_user.role != Role.SUPERADMIN:
        # 내가 만든 대회가 아닌 경우에 대해서만 필터링 강화
        # 루프를 돌며 처리하거나 서브쿼리/조인 사용
        from models import Member as MemberModel
        query = query.join(MemberModel, CompetitionRegistration.member_id == MemberModel.id)
        
        # 주최자인 대회와 참가자인 대회를 구분해서 필터링
        # (단순화를 위해 일단 주최자가 아닌 대회들에 대해 내 박스 소속만 필터)
        # 실제로는 query.filter(or_(Competition.creator_id == current_user.id, MemberModel.gym_id == current_user.gym_id)) 형태가 좋으나
        # 여기서는 이미 target_comp_ids가 필터링되어 있으므로, 
        # "내가 만든 대회"가 아닌 대회들은 "내 박스 회원"인 조건만 추가하는 식으로 처리 가능하지만
        # SQL 레벨에서 한번에 처리하기 위해 아래와 같이 필터링
        from sqlalchemy import or_
        from models import Competition as CompetitionModel
        query = query.join(CompetitionModel, CompetitionRegistration.competition_id == CompetitionModel.id)
        query = query.filter(
            or_(
                CompetitionModel.creator_id == current_user.id,
                MemberModel.gym_id == current_user.gym_id
            )
        )

    pending_counts = query.group_by(CompetitionRegistration.competition_id).all()

    # 3. 결과 포맷팅
    comp_counts = {pc.competition_id: pc.count for pc in pending_counts}
    total_pending = sum(comp_counts.values())

    return {
        "total_pending": total_pending,
        "competitions": comp_counts 
    }

# 2. 대회 목록 조회 (권한 필터링 적용)
@router.get("/", response_model=List[CompetitionResponse])
def get_competitions(db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # 모든 대회 조회
    all_comps = db.query(Competition).order_by(Competition.start_date.desc()).all()

    # superadmin은 모든 대회 반환
    if current_user.role in [Role.SUPERADMIN, Role.ADMIN]:
        return [enrich_with_admins(c, db) for c in all_comps]

    # 필터링된 목록
    visible_comps = []
    
    for comp in all_comps:
        # 공개 대회면 무조건 추가
        if not comp.is_private:
            visible_comps.append(comp)
            continue
            
        # 비공개 대회인 경우, 내 박스가 참여 중인지 확인
        if current_user.gym_id:
            is_participating = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == comp.id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()
            
            if is_participating:
                visible_comps.append(comp)
                
    return [enrich_with_admins(c, db) for c in visible_comps]

# 3. 대회 상세 조회
@router.get("/{id}")
def get_competition(id: int, db: Session = Depends(get_db)):
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    events = db.query(CompetitionEvent).filter(CompetitionEvent.competition_id == id).all()
    
    return {
        "competition": enrich_with_admins(comp, db),
        "events": [CompEventResponse.model_validate(e) for e in events]
    }

# 3-1. 대회 정보 수정 (관리자용)
@router.put("/{id}", response_model=CompetitionResponse)
def update_competition(id: int, comp_update: CompetitionUpdate, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    # 모든 관리자(코치 이상) 또는 총관리자 접근 허용하도록 일차 검사
    assert_competition_staff(current_user)
        
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
        
    is_superadmin = (current_user.role == Role.SUPERADMIN)
        
    # ✅ [신규] 오직 총관리자만 접근/수정 가능한 필드를 식별
    superadmin_fields = []
    if comp_update.sort_order is not None or comp_update.is_hidden is not None:
         if not is_superadmin:
              raise HTTPException(status_code=403, detail="대회 노출/순서 설정은 총관리자만 수정할 수 있습니다.")
         if comp_update.sort_order is not None: comp.sort_order = comp_update.sort_order
         if comp_update.is_hidden is not None: comp.is_hidden = comp_update.is_hidden
         superadmin_fields = ['sort_order', 'is_hidden']

    # 일반 필드의 경우 추가 권한 체크
    # 현재 전달받은 데이터 중에 총관리자 전용 속성을 뺀 일반 속성들이 있는지 확인
    update_dict = comp_update.model_dump(exclude_unset=True)
    general_fields_updating = any(field not in superadmin_fields for field in update_dict.keys())

    if general_fields_updating:
        # ✅ [수정] 수정 권한 체크: 생성자 본인, superadmin,
        # 또는 allow_invited_gym_settings=True이고 초대된 박스의 어드민이면 허용
        is_creator = (comp.creator_id == current_user.id)
        
        is_invited_admin_allowed = False
        if comp.allow_invited_gym_settings and current_user.gym_id:
            invited_check = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()
            if invited_check:
                is_invited_admin_allowed = True
    
        if not (is_creator or is_superadmin or is_invited_admin_allowed):
            raise HTTPException(status_code=403, detail="대회 일반 설정 변경 권한이 없습니다.")
        
    # 필드 업데이트
    if comp_update.title is not None: comp.title = comp_update.title
    if comp_update.description is not None: comp.description = comp_update.description
    if comp_update.start_date is not None: comp.start_date = comp_update.start_date
    if comp_update.end_date is not None: comp.end_date = comp_update.end_date
    if comp_update.is_active is not None: comp.is_active = comp_update.is_active
    
    # 보안 옵션 업데이트
    if comp_update.is_private is not None: comp.is_private = comp_update.is_private
    if comp_update.show_leaderboard_to_all is not None: comp.show_leaderboard_to_all = comp_update.show_leaderboard_to_all
    if comp_update.show_wod_to_all is not None: comp.show_wod_to_all = comp_update.show_wod_to_all
    if comp_update.anonymize_for_all is not None: comp.anonymize_for_all = comp_update.anonymize_for_all
    if comp_update.guest_passcode is not None: comp.guest_passcode = comp_update.guest_passcode # ✅ [수정]
    if comp_update.allow_invited_gym_settings is not None: comp.allow_invited_gym_settings = comp_update.allow_invited_gym_settings # ✅ [신규]
    
    db.commit()
    db.refresh(comp)
    return enrich_with_admins(comp, db)

# 3-2. 대회 삭제 (생성자 전용)
@router.delete("/{id}")
def delete_competition(id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    # 생성자 또는 슈퍼관리자만 삭제 가능
    if comp.creator_id != current_user.id and current_user.role != Role.SUPERADMIN:
        raise HTTPException(status_code=403, detail="본인이 생성한 대회만 삭제할 수 있습니다.")
    
    db.delete(comp)
    db.commit()
    return {"message": "Competition deleted successfully"}

# 4. 이벤트(WOD) 생성
@router.post("/{id}/events", response_model=CompEventResponse)
def create_event(id: int, event: CompEventCreate, db: Session = Depends(get_db)):
    comp = db.query(Competition).filter(Competition.id == id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    new_event = CompetitionEvent(
        competition_id=id,
        title=event.title,
        description=event.description,
        score_type=event.score_type,
        time_cap=event.time_cap,
        max_reps=event.max_reps
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

# 4-1. 대회 참가 신청
@router.post("/{competition_id}/register")
def register_competition(
    competition_id: int,
    current_user: Member = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    existing = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()
    
    if existing:
        return {"message": "이미 참가 신청된 대회입니다."}

    # ✅ [신규] 초대된 박스 회원만 참가 신청 가능
    is_invited = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == competition_id,
        CompetitionGym.gym_id == current_user.gym_id,
        CompetitionGym.status == 'accepted'
    ).first()

    if not is_invited:
        raise HTTPException(status_code=403, detail="본인의 박스가 초대된 대회만 참가 신청이 가능합니다.")

    new_reg = CompetitionRegistration(
        competition_id=competition_id,
        member_id=current_user.id,
        member_name=current_user.name,
        status="pending" 
    )
    db.add(new_reg)
    db.commit()
    return {"message": "참가 신청이 접수되었습니다. 관리자 승인 후 기록 등록이 가능합니다."}

# 4-2. 내 참가 상태 확인
@router.get("/{competition_id}/my-status")
def check_registration_status(
    competition_id: int,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()
    
    if reg:
        return {"registered": True, "status": reg.status}
    else:
        return {"registered": False, "status": None}

# 4-3. 참가 신청자 목록 조회
@router.get("/{competition_id}/registrations")
def get_competition_registrations(
    competition_id: int, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    query = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id
    )

    # ✅ [추가] 권한 필터링: 슈퍼관리자나 대회 호스트가 아닌 경우 자기 박스 회원만 노출
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    if current_user.role != Role.SUPERADMIN and comp and comp.creator_id != current_user.id:
        from models import Member as MemberModel
        query = query.join(MemberModel, CompetitionRegistration.member_id == MemberModel.id).filter(
            MemberModel.gym_id == current_user.gym_id
        )

    regs = query.all()
    return regs

# 4-4. 참가 승인/거절 처리
@router.put("/{competition_id}/registrations/{member_id}")
def update_registration_status(
    competition_id: int, 
    member_id: int, 
    status_update: RegistrationStatusUpdate, 
    db: Session = Depends(get_db), 
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)
    
    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == competition_id, 
        CompetitionRegistration.member_id == member_id
    ).first()
    
    if not reg:
        raise HTTPException(status_code=404, detail="신청 내역을 찾을 수 없습니다.")

    # ✅ [추가] 수정 권한 상세 체크
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    is_host = comp and comp.creator_id == current_user.id
    
    # 신청자의 박스 정보 확인
    applicant = db.query(Member).filter(Member.id == member_id).first()
    is_same_gym = applicant and applicant.gym_id == current_user.gym_id

    if not (is_host or is_same_gym or current_user.role == Role.SUPERADMIN):
        raise HTTPException(status_code=403, detail="본인 박스 회원이 아니거나 대회 주최자가 아닙니다.")
    
    reg.status = status_update.status
    
    # 알림 생성
    comp = db.query(Competition).filter(Competition.id == competition_id).first()
    comp_title = comp.title if comp else "대회"
    
    if status_update.status == "approved":
        noti = Notification(
            recipient_id=member_id,
            sender_id=current_user.id,
            type="competition_status",
            title="대회 참가 승인",
            message=f"'{comp_title}' 참가 신청이 승인되었습니다! 🎉",
            related_link=f"/competition"
        )
        db.add(noti)
    elif status_update.status == "rejected":
        noti = Notification(
            recipient_id=member_id,
            sender_id=current_user.id,
            type="competition_status",
            title="대회 참가 거절",
            message=f"'{comp_title}' 참가 신청이 거절되었습니다.",
            related_link=f"/competition"
        )
        db.add(noti)
        
    db.commit()
    return {"message": f"참가 상태가 {status_update.status}로 변경되었습니다."}

# 5. 점수 등록
@router.post("/events/{event_id}/scores")
def submit_score(
    event_id: int, 
    score_data: CompScoreCreate, 
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    reg = db.query(CompetitionRegistration).filter(
        CompetitionRegistration.competition_id == event.competition_id,
        CompetitionRegistration.member_id == current_user.id
    ).first()

    # ✅ [수정] registration이 없어도 초대된 박스 소속 회원이면 기록 제출 허용
    # (오픈 대회 참가 흐름: 참가 신청 없이 바로 기록 제출)
    if not reg:
        # 내 소속 박스가 이 대회에 초대(accepted)되어 있으면 허용
        if current_user.gym_id:
            gym_link = db.query(CompetitionGym).filter(
                CompetitionGym.competition_id == event.competition_id,
                CompetitionGym.gym_id == current_user.gym_id
            ).first()
            if not gym_link:
                raise HTTPException(status_code=403, detail="이 대회에 참가 자격이 없습니다.")
            # registration 자동 생성
            reg = CompetitionRegistration(
                competition_id=event.competition_id,
                member_id=current_user.id,
                member_name=current_user.name,
                status="approved"
            )
            db.add(reg)
            db.commit()
            db.refresh(reg)
        else:
            raise HTTPException(status_code=403, detail="소속 체육관이 없습니다. 관리자에게 문의하세요.")
    elif reg.status != "approved":
        raise HTTPException(status_code=403, detail="관리자의 참가 승인 대기 중입니다.")
    
    #   (대회 시작후, 끝난후 등 검증은 생략, 필요시 추가)
    
    # 2) 저장
    existing_score = db.query(CompetitionScore).filter(
        CompetitionScore.event_id == event_id,
        CompetitionScore.member_id == current_user.id
    ).first()
    
    if existing_score:
        existing_score.score_value = score_data.score_value
        existing_score.is_rx = score_data.is_rx
        existing_score.scale_rank = score_data.scale_rank
        existing_score.is_time_cap = score_data.is_time_cap
        existing_score.tie_break = score_data.tie_break
        existing_score.note = score_data.note
        existing_score.status = "approved" # ✅ [수정] 수정 시에도 무조건 승인 처리
        db.commit()
        return {"message": "Score updated"}
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=current_user.id,
            member_name=current_user.name,
            score_value=score_data.score_value,
            is_rx=score_data.is_rx,
            scale_rank=score_data.scale_rank,
            is_time_cap=score_data.is_time_cap,
            tie_break=score_data.tie_break,
            note=score_data.note,
            status="approved" # ✅ [수정] 신규 제출 시 무조건 승인 처리
        )
        db.add(new_score)
        db.commit()
        return {"message": "Score submitted"}

# 6. 이벤트별 리더보드
@router.get("/events/{event_id}/leaderboard", response_model=List[CompLeaderboardItem])
def get_event_leaderboard(
    event_id: int, 
    request: Request,
    is_guest_viewer: bool = False, # ✅ [신규] 게스트 사이드 뷰어 여부
    db: Session = Depends(get_db), 
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    if is_guest_viewer:
        check_rate_limit(request, scope=f"competition_event_leaderboard:{event_id}", limit=90, window_seconds=60)

    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    comp = event.competition
    
    # ✅ [신규] 권한 체크: 내 박스가 참여 중인가?
    is_participating_gym = False
    if current_user and current_user.gym_id:
        participating = db.query(CompetitionGym).filter(
            CompetitionGym.competition_id == comp.id,
            CompetitionGym.gym_id == current_user.gym_id
        ).first()
        if participating:
            is_participating_gym = True
            
    # ✅ [신규] 접근 제어: 리더보드 비공개 설정이고 내가 참여 박스 회원이 아니라면
    if not comp.show_leaderboard_to_all and not is_participating_gym:
        if not is_competition_staff(current_user):
             raise HTTPException(status_code=403, detail="이 대회의 리더보드는 참가 박스 회원에게만 공개됩니다.")

    from sqlalchemy import or_
    scores = db.query(CompetitionScore).join(Member, CompetitionScore.member_id == Member.id, isouter=True).filter(
        CompetitionScore.event_id == event_id,
        or_(Member.role != Role.SUPERADMIN, CompetitionScore.member_id == None)
    ).all()
    
    is_time = (event.score_type == 'time')
    
    def sort_key(s):
        rx = 1 if s.is_rx else 0
        
        # ✅ [신규] scale_rank에 따른 우선순위 부여 (Rx가 아닐 때)
        scale_weights = {'A': 3, 'B': 2, 'C': 1}
        # s.scale_rank가 없거나 매핑에 없으면 0으로 처리 (기본 스케일 등)
        scale_weight = scale_weights.get(s.scale_rank, 0) if not s.is_rx else 0

        val = parse_score(s.score_value, event.score_type)
        tb_val = parse_score(s.tie_break, 'time') if s.tie_break else 999999
        
        if is_time:
            # -rx: Rx(1) -> -1 가 제일 리스트 앞에 (오름차순이므로), 비Rx(0) -> 0이 그 다음
            # -scale_weight: SA(3) -> -3이 SB(2)->-2 보다 앞에 오도록 음수로 정렬 축 부여
            return (-rx, -scale_weight, val, tb_val)
        else:
            return (-rx, -scale_weight, -val, tb_val)
            
    sorted_scores = sorted(scores, key=sort_key)
    
    result = []
    for idx, s in enumerate(sorted_scores):
        member_name_display = s.member_name
        
        # ✅ [신규] 익명화 처리
        if comp.anonymize_for_all and not is_participating_gym and not is_guest_viewer:
             if not current_user or s.member_id != current_user.id:
                 member_name_display = anonymize_name(s.member_name)

        # ✅ [신규] 성별 데이터 추출
        gender = None
        if s.member_id:
            gender = s.member.gender if s.member else None
        else:
            gender = s.guest_gender

        # ✅ [신규] 박스 데이터 추출
        gym_name = None
        if s.member_id:
            gym_name = s.member.gym.name if s.member and s.member.gym else None
        else:
            gym_name = s.guest_gym

        # ✅ [수정] 동순위 처리 (Standard Competition Ranking: 1-2-2-4)
        # 현재 항목의 정렬키와 이전 항목의 정렬키를 비교해 같으면 동일 순위 부여
        if idx == 0:
            rank = 1
        else:
            prev = sorted_scores[idx - 1]
            prev_key = sort_key(prev)
            curr_key = sort_key(s)
            if curr_key == prev_key:
                # 이전 항목과 완전히 같은 기록 → 동순위
                rank = result[-1].rank
            else:
                # 다르면 현재 인덱스 + 1 (앞의 동순위만큼 자동으로 밀림)
                rank = idx + 1

        result.append(CompLeaderboardItem(
            rank=rank,
            member_name=member_name_display,
            score_value=s.score_value,
            is_rx=s.is_rx,
            scale_rank=s.scale_rank,
            is_time_cap=s.is_time_cap if s.is_time_cap is not None else False,
            tie_break=s.tie_break,
            note=s.note,
            gender=gender,
            gym_name=gym_name,
            status=s.status or 'approved', # ✅ [수정] NULL 방어: 기존 기록은 approved 처리
            guest_phone=s.guest_phone  # ✅ [신규] 게스트 전화번호 (동명이인 구분)
        ))
    return result

# 7. 종합 리더보드 (Overall)
@router.get("/{comp_id}/overall", response_model=List[OverallLeaderboardItem])
def get_overall_leaderboard(
    comp_id: int,
    request: Request,
    is_guest_viewer: bool = False,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional),
):
    if is_guest_viewer:
        check_rate_limit(request, scope=f"competition_overall_leaderboard:{comp_id}", limit=60, window_seconds=60)

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp: raise HTTPException(status_code=404, detail="Competition not found")
    
    # ✅ [신규] 접근 제어: 리더보드 비공개 설정이고 내가 참여 박스 회원이 아니라면
    is_participating_gym = False
    if current_user and current_user.gym_id:
        participating = db.query(CompetitionGym).filter(
            CompetitionGym.competition_id == comp.id,
            CompetitionGym.gym_id == current_user.gym_id
        ).first()
        if participating:
            is_participating_gym = True

    if not comp.show_leaderboard_to_all and not is_participating_gym:
        if not is_competition_staff(current_user):
             raise HTTPException(status_code=403, detail="이 대회의 리더보드는 참가 박스 회원에게만 공개됩니다.")

    from sqlalchemy import or_
    events = db.query(CompetitionEvent).filter(CompetitionEvent.competition_id == comp_id).all() # Keep this line
    event_ids = [e.id for e in events] # Use the fetched events
    all_scores = db.query(CompetitionScore).join(Member, CompetitionScore.member_id == Member.id, isouter=True).filter(
        CompetitionScore.event_id.in_(event_ids),
        or_(Member.role != Role.SUPERADMIN, CompetitionScore.member_id == None)
    ).all()
    leaderboard_map = {}
    
    for event in events:
        # Filter all_scores for the current event
        scores = [s for s in all_scores if s.event_id == event.id]
        is_time = event.score_type == 'time'
        
        def sort_key(s):
            rx = 1 if s.is_rx else 0
            
            # ✅ [신규] scale_rank에 따른 우선순위 부여 (Rx가 아닐 때)
            scale_weights = {'A': 3, 'B': 2, 'C': 1}
            scale_weight = scale_weights.get(s.scale_rank, 0) if not s.is_rx else 0

            val = parse_score(s.score_value, event.score_type)
            tb_val = parse_score(s.tie_break, 'time') if s.tie_break else 999999
            
            if is_time: 
                return (-rx, -scale_weight, val, tb_val)
            else: 
                return (-rx, -scale_weight, -val, tb_val)
            
        sorted_scores = sorted(scores, key=sort_key)
        
        # ✅ [수정] 포인트 계산 시 동순위 처리 (같은 기록 = 같은 포인트)
        point_rank = 1
        for idx, s in enumerate(sorted_scores):
            if idx == 0:
                point_rank = 1
            else:
                prev_s = sorted_scores[idx - 1]
                if sort_key(s) == sort_key(prev_s):
                    pass  # 동순위: point_rank 유지
                else:
                    point_rank = idx + 1  # 이전 동순위 수만큼 밀림
            
            # ✅ [수정] user_key에 게스트 전화번호도 포함 (동명이인 구분)
            user_key = f"member_{s.member_id}" if s.member_id else f"guest_{s.member_name}_{s.guest_phone or ''}"

            if user_key not in leaderboard_map:
                leaderboard_map[user_key] = {
                    "member_id": s.member_id,
                    "member_name": s.member_name,
                    "guest_phone": s.guest_phone,  # ✅ [신규]
                    "total_points": 0,
                    "event_details": {},
                    "gender": s.member.gender if s.member_id and s.member else s.guest_gender,
                    "gym_name": s.member.gym.name if s.member_id and s.member and s.member.gym else s.guest_gym
                }
            
            leaderboard_map[user_key]["total_points"] += point_rank
            leaderboard_map[user_key]["event_details"][event.title] = point_rank

    # ✅ [신규] 불참 종목 포인트 패널티 부여 (전체 참가자 수 + 1)
    total_participants = len(leaderboard_map)
    penalty_point = total_participants + 1

    overall_list = []
    for u_key, data in leaderboard_map.items():
        # 참가한 이벤트 수가 전체 이벤트 수보다 적은 경우 패널티 부여
        participated_events = len(data["event_details"])
        missing_events_count = len(events) - participated_events
        
        if missing_events_count > 0:
            data["total_points"] += penalty_point * missing_events_count
            
        overall_list.append(
            OverallLeaderboardItem(
                rank=0,
                member_id=data["member_id"],
                member_name=data["member_name"],
                total_points=data["total_points"],
                event_details=data["event_details"],
                gender=data.get("gender"),
                gym_name=data.get("gym_name"),
                guest_phone=data.get("guest_phone")  # ✅ [신규] 게스트 전화번호
            )
        )
    
    overall_list.sort(key=lambda x: x.total_points)
    
    # ✅ [수정] 동순위 처리 (Standard Competition Ranking: 1-2-2-4)
    for i, item in enumerate(overall_list):
        if i == 0:
            item.rank = 1
        else:
            prev = overall_list[i - 1]
            if item.total_points == prev.total_points:
                # 동일 총점 → 동순위
                item.rank = prev.rank
            else:
                # 다르면 현재 인덱스 + 1 (앞 동순위만큼 자동 밀림)
                item.rank = i + 1

        # ✅ [신규] 익명화 적용 (게스트 뷰어는 통과)
        if comp.anonymize_for_all and not is_participating_gym and not is_guest_viewer:
            if not current_user or item.member_id != current_user.id:
                 item.member_name = anonymize_name(item.member_name)
        
    return overall_list


@router.post("/{comp_id}/merge-participants")
def merge_competition_participants(
    comp_id: int,
    payload: CompetitionParticipantMergeRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    assert_superadmin_competition_merge_access(current_user, comp)

    source_scores = get_competition_participant_scores(db, comp_id, payload.source)
    if not source_scores:
        raise HTTPException(status_code=404, detail="병합할 원본 참가자 기록을 찾을 수 없습니다.")

    target_scores = get_competition_participant_scores(db, comp_id, payload.target)
    if not target_scores:
        raise HTTPException(status_code=404, detail="병합 대상 참가자 기록을 찾을 수 없습니다.")

    source_signature = (
        payload.source.member_id,
        payload.source.member_name,
        normalize_phone(payload.source.guest_phone),
    )
    target_signature = (
        payload.target.member_id,
        payload.target.member_name,
        normalize_phone(payload.target.guest_phone),
    )
    if source_signature == target_signature:
        raise HTTPException(status_code=400, detail="같은 참가자는 병합할 수 없습니다.")

    target_member = None
    if payload.target.member_id is not None:
        target_member = db.query(Member).filter(Member.id == payload.target.member_id).first()
        if not target_member:
            raise HTTPException(status_code=404, detail="병합 대상 회원을 찾을 수 없습니다.")

    target_score_map = {score.event_id: score for score in target_scores}
    moved_count = 0
    conflict_events: List[str] = []

    for source_score in source_scores:
        if source_score.event_id in target_score_map:
            conflict_events.append(source_score.event.title if source_score.event else f"event_{source_score.event_id}")
            continue

        if target_member:
            source_score.member_id = target_member.id
            source_score.member_name = target_member.name
            source_score.guest_phone = None
            source_score.guest_gender = None
            source_score.guest_gym = None
        else:
            source_score.member_id = None
            source_score.member_name = payload.target.member_name
            source_score.guest_phone = payload.target.guest_phone

        moved_count += 1

    db.commit()

    return {
        "message": "참가자 기록 병합을 완료했습니다.",
        "moved_count": moved_count,
        "conflict_events": conflict_events,
        "source_remaining_scores": len(source_scores) - moved_count,
    }

# 8. 이벤트 수정 (관리자용)
@router.put("/events/{event_id}")
def update_event(event_id: int, event_data: CompEventCreate, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    assert_competition_staff(current_user)
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.title = event_data.title
    event.description = event_data.description
    event.score_type = event_data.score_type
    event.time_cap = event_data.time_cap
    event.max_reps = event_data.max_reps
    db.commit()
    db.refresh(event)
    return {"message": "이벤트가 수정되었습니다."}

# 9. 이벤트 삭제 (관리자용)
@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    assert_competition_staff(current_user)
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.query(CompetitionScore).filter(CompetitionScore.event_id == event_id).delete()
    db.delete(event)
    db.commit()
    db.delete(event)
    db.commit()
    return {"message": "이벤트가 삭제되었습니다."}


# 10. [신규] 대회에 박스 초대 (연합 추가)
@router.post("/{comp_id}/gyms", response_model=CompetitionGymResponse)
def add_gym_to_competition(
    comp_id: int,
    request: GymInviteRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")

    # 이미 초대된 박스인지 확인
    existing = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == comp_id,
        CompetitionGym.gym_id == request.gym_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 초대되거나 참여 중인 박스입니다.")

    new_gym_relation = CompetitionGym(
        competition_id=comp_id,
        gym_id=request.gym_id,
        status="pending" # 초대 상태 (추후 수락 기능 추가 가능) -> 현재는 주최자가 넣으면 바로 accepted로 할지, 아님 pending인지? 관장님 말씀이 '초대'였으므로 pending이 맞으나 간소화를 위해 일단 수락된 상태로 가정하거나, 추후 수락 API 추가. 여기선 'accepted'로 바로 처리 (간소화)
        # 관장님 기획에서는 "초대 -> 수락"이었음. 일단 accepted로 처리하여 기능 테스트 용이하게 함.
    )
    new_gym_relation.status = "accepted" # MVP 간소화: 주최자가 추가하면 바로 참여됨.

    db.add(new_gym_relation)
    db.commit()
    db.refresh(new_gym_relation)
    return new_gym_relation

# 11. [신규] 참여 박스 목록 조회
@router.get("/{comp_id}/gyms")
def get_participating_gyms(comp_id: int, db: Session = Depends(get_db)):
    relations = db.query(CompetitionGym).filter(CompetitionGym.competition_id == comp_id).all()
    # 체육관 상세 정보도 같이 주면 좋음 (models.py 관계 활용)
    result = []
    for rel in relations:
        result.append({
            "gym_id": rel.gym_id,
            "gym_name": rel.gym.name if rel.gym else "Unknown",
            "status": rel.status
        })
    return result

# 12. [신규] 대회에서 박스 제외 (삭제)
@router.delete("/{comp_id}/gyms/{gym_id}")
def remove_gym_from_competition(
    comp_id: int,
    gym_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)

    relation = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == comp_id,
        CompetitionGym.gym_id == gym_id
    ).first()

    if not relation:
        raise HTTPException(status_code=404, detail="해당 박스는 이 대회에 등록되지 않았습니다.")

    db.delete(relation)
    db.commit()
    return {"message": "박스가 대회 참가 목록에서 삭제되었습니다."}

# =========================================================
# 13. [신규] 게스트 전용 기능 (회원가입 없이 사용)
# =========================================================

# 13-0. 게스트용 활성 대회 목록 조회
@router.get("/guest/available")
def get_available_competitions_for_guest(request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, scope="competition_guest_available", limit=30, window_seconds=60)
    comps = db.query(Competition).filter(Competition.is_active == True).all()
    # 게스트는 불필요한 정보(권한 등)를 알 필요가 없으므로 간단하게 변환
    return [
        {
            "id": c.id, 
            "title": c.title, 
            "start_date": c.start_date, 
            "end_date": c.end_date,
            "is_hidden": c.is_hidden,        # ✅ [추가] 게스트 화면 필터링용
            "sort_order": c.sort_order       # ✅ [추가] 게스트 화면 정렬용
        } for c in comps
    ]

# 13-1. 게스트 패스코드 확인 및 대회 정보 조회
@router.post("/guest/verify")
def verify_guest_passcode(payload: GuestVerifyRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, scope=f"competition_guest_verify:{payload.competition_id}", limit=8, window_seconds=300)
    check_failed_attempt_lock(request, scope=f"competition_guest_verify_fail:{payload.competition_id}")

    # 특정 대회 ID와 패스코드가 일치하는 활성 대회 조회
    comp = db.query(Competition).filter(
        Competition.id == payload.competition_id,
        Competition.guest_passcode == payload.passcode,
        Competition.is_active == True
    ).first()
    
    if not comp:
        register_failed_attempt(request, scope=f"competition_guest_verify_fail:{payload.competition_id}")
        raise HTTPException(status_code=401, detail="올바르지 않은 패스코드입니다.")

    reset_failed_attempts(request, scope=f"competition_guest_verify_fail:{payload.competition_id}")
    
    events = db.query(CompetitionEvent).filter(CompetitionEvent.competition_id == comp.id).all()
    
    return {
        "competition": enrich_with_admins(comp, db),
        "events": [CompEventResponse.model_validate(e) for e in events]
    }

# ✅ [신규] 13-1-1. 대회에 참가한 체육관 목록 조회 (게스트용, 인증 불필요)
@router.get("/guest/competition-gyms")
def get_competition_gyms_for_guest(competition_id: int, request: Request, db: Session = Depends(get_db)):
    """대회에 참가 등록된 체육관 목록만 반환합니다 (게스트 프로필 선택용)"""
    check_rate_limit(request, scope=f"competition_guest_gyms:{competition_id}", limit=30, window_seconds=60)
    from models import Gym
    gym_links = db.query(CompetitionGym).filter(
        CompetitionGym.competition_id == competition_id
    ).all()

    result = []
    for link in gym_links:
        if link.gym:
            result.append({"id": link.gym.id, "name": link.gym.name})
    
    # 이름 기준 정렬
    result.sort(key=lambda x: x["name"])
    return result

# 13-1-2. [신규] 게스트 프로필 조회 (전화번호 기반 식별)
@router.get("/guest/profile")
def get_guest_profile(phone: str, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, scope="competition_guest_profile", limit=20, window_seconds=60)
    # 가장 최근에 등록된 해당 전화번호의 기록을 찾음
    last_score = db.query(CompetitionScore).filter(
        CompetitionScore.guest_phone == phone,
        CompetitionScore.member_id == None
    ).order_by(CompetitionScore.id.desc()).first()
    
    if not last_score:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")
        
    return {
        "name": last_score.member_name,
        "phone": last_score.guest_phone,
        "gender": last_score.guest_gender,
        "gym_name": last_score.guest_gym # ✅ [신규]
    }

# 13-2. 게스트 기록 등록
@router.post("/guest/scores")
def submit_guest_score(
    event_id: int,
    request: Request,
    score_data: CompScoreCreate,
    db: Session = Depends(get_db)
):
    check_rate_limit(request, scope=f"competition_guest_scores:{event_id}", limit=20, window_seconds=300)

    # 이벤트 존재 확인
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not score_data.member_name:
        raise HTTPException(status_code=400, detail="성함을 입력해주세요.")

    # ✅ [신규] 동명이인 감지 로직
    # 1. 전화번호가 있는 경우: 전화번호 + 이름으로 정확히 매칭
    # 2. 전화번호가 없는 경우: 이름으로 동명이인 검색 후 확인 요청
    existing_score = None

    if score_data.guest_phone:
        # 전화번호 + 이름으로 정확히 매칭
        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.guest_phone == score_data.guest_phone,
            CompetitionScore.member_name == score_data.member_name,
            CompetitionScore.member_id == None
        ).first()
    else:
        # 전화번호 없음: 이름으로 검색
        same_name_scores = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_name == score_data.member_name,
            CompetitionScore.member_id == None
        ).all()

        # 동명이인 존재 → 사용자 확인 요청
        if len(same_name_scores) > 0:
            return {
                "status": "duplicate_found",
                "message": "동명이인이 존재합니다. 확인이 필요합니다.",
                "duplicates": [
                    {
                        "masked_phone": mask_phone_number(s.guest_phone),
                        "name": s.member_name,
                        "score_id": s.id
                    }
                    for s in same_name_scores
                ],
                "action_required": True
            }

        existing_score = same_name_scores[0] if same_name_scores else None

    if existing_score:
        existing_score.score_value = score_data.score_value
        existing_score.is_rx = score_data.is_rx
        existing_score.scale_rank = score_data.scale_rank
        existing_score.is_time_cap = score_data.is_time_cap
        existing_score.tie_break = score_data.tie_break
        existing_score.note = score_data.note

        # ✅ 기존 기록 업데이트 시에도 게스트 정보 갱신
        if score_data.guest_gender: existing_score.guest_gender = score_data.guest_gender
        if score_data.guest_phone: existing_score.guest_phone = score_data.guest_phone
        existing_score.guest_gym = score_data.guest_gym
        existing_score.status = "pending"

        db.commit()
        return {
            "status": "success",
            "message": f"{score_data.member_name}님의 기록이 업데이트되었습니다.",
            "action_required": False
        }
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=None,
            member_name=score_data.member_name,
            score_value=score_data.score_value,
            is_rx=score_data.is_rx,
            scale_rank=score_data.scale_rank,
            is_time_cap=score_data.is_time_cap,
            tie_break=score_data.tie_break,
            note=score_data.note,
            guest_gender=score_data.guest_gender,
            guest_phone=score_data.guest_phone,
            guest_gym=score_data.guest_gym,
            status="approved"
        )
        db.add(new_score)
        db.commit()
        return {
            "status": "success",
            "message": f"{score_data.member_name}님의 기록이 등록되었습니다.",
            "action_required": False
        }


# =========================================================
# 14. [신규] 코치 전용: 소속 체육관 회원들의 특정 이벤트 참가 현황 및 기록 조회
# =========================================================
@router.get("/{comp_id}/my-gym-members")
def get_my_gym_members_records(comp_id: int, event_id: Optional[int] = None, db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    assert_competition_staff(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=403, detail="소속 체육관이 있는 관리자/코치만 접근 가능합니다.")
        
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp: raise HTTPException(status_code=404, detail="대회를 찾을 수 없습니다.")
    
    # ✅ [수정] 코치의 체육관 이름 조회 (guest_gym 매칭용)
    from models import Gym
    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None
    
    # 이 대회의 모든 이벤트 ID 목록
    event_ids = [e.id for e in db.query(CompetitionEvent).filter(CompetitionEvent.competition_id == comp_id).all()]
    
    # 참가자 map: key = "member:{id}" or "guest:{name}:{phone}"
    participant_map = {}
    
    # ✅ [신규] 코치 체육관의 모든 정식 회원을 기록 유무 상관없이 기본 추가 (총관리자 제외)
    all_gym_members = db.query(Member).filter(
        Member.gym_id == current_user.gym_id,
        Member.role != Role.SUPERADMIN # ✅ [수정] 총관리자는 미제출자 등으로 노출되지 않도록 제외
    ).all()
    for m in all_gym_members:
        participant_map[f"member:{m.id}"] = {
            "member_id": m.id,
            "member_name": m.name,
            "is_guest": False,
            "profile_image": None, # Member 모델에 해당 컬럼 없음
            "score": None
        }
    
    if event_ids:
        all_scores = db.query(CompetitionScore).filter(
            CompetitionScore.event_id.in_(event_ids)
        ).all()
        
        for s in all_scores:
            if s.member_id:
                # 정식 회원 추가/업데이트 (이미 위에서 다 추가되었지만, 방어 코드)
                if s.member and s.member.gym_id == current_user.gym_id:
                    key = f"member:{s.member_id}"
                    if key not in participant_map:
                        participant_map[key] = {
                            "member_id": s.member_id,
                            "member_name": s.member_name,
                            "is_guest": False,
                            "score": None
                        }
            else:
                # ✅ 소스 2: 게스트 (내 체육관 이름으로 guest_gym 매칭)
                if my_gym_name and s.guest_gym == my_gym_name:
                    phone = s.guest_phone or ''
                    key = f"guest:{s.member_name}:{phone}"
                    if key not in participant_map:
                        participant_map[key] = {
                            "member_id": None,
                            "member_name": s.member_name,
                            "guest_phone": phone,
                            "is_guest": True,
                            "score": None
                        }
    
    # 선택된 이벤트의 기록 매핑
    if event_id:
        for key, data in participant_map.items():
            if data["member_id"]:
                # 정식 회원 기록 조회
                score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == data["member_id"]
                ).first()
            else:
                # 게스트 기록 조회 (이름 + 전화번호 매칭)
                score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id.is_(None),
                    CompetitionScore.member_name == data["member_name"],
                    CompetitionScore.guest_phone == data.get("guest_phone", "")
                ).first()
            
            if score:
                data["score"] = {
                    "id": score.id,
                    "score_value": score.score_value,
                    "is_rx": score.is_rx,
                    "scale_rank": score.scale_rank,
                    "is_time_cap": score.is_time_cap,
                    "status": score.status or 'approved'
                }
    
    return list(participant_map.values())

# =========================================================
# 15. [신규] 코치 전용: 기록 상태 변경 (승인, 반려)
# =========================================================
@router.patch("/scores/{score_id}/status")
def update_score_status(score_id: int, status: str = Body(..., embed=True), db: Session = Depends(get_db), current_user: Member = Depends(get_current_user)):
    assert_competition_staff(current_user)
        
    score = db.query(CompetitionScore).filter(CompetitionScore.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
        
    score.status = status
    db.commit()
    return {"message": f"기록이 {status} 상태로 변경되었습니다."}

# =========================================================================
# ✅ [신규] 엑셀 내보내기 / 가져오기 / 양식 다운로드 API
# =========================================================================

@router.get("/events/{event_id}/export-excel")
def export_event_leaderboard_excel(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """
    해당 이벤트의 리더보드를 남녀/스케일별로 시트를 분리하여 엑셀 파일로 다운로드합니다.
    """
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    comp = event.competition
    
    # 권한 체크 (간략히: 어드민이거나, 대회 만든 사람이거나, 참가 체육관 관련자)
    # 필요한 경우 더 엄격하게 제한할 수 있습니다.
    is_admin = False
    if current_user and current_user.role in [Role.ADMIN, Role.SUPERADMIN]:
        is_admin = True
    elif current_user and current_user.gym_id:
         participating = db.query(CompetitionGym).filter(
             CompetitionGym.competition_id == comp.id,
             CompetitionGym.gym_id == current_user.gym_id
         ).first()
         if participating:
             is_admin = True

    if not is_admin:
         raise HTTPException(status_code=403, detail="엑셀 다운로드 권한이 없습니다.")

    # 1. 모든 점수 가져오기
    from sqlalchemy import or_
    scores = db.query(CompetitionScore).join(Member, CompetitionScore.member_id == Member.id, isouter=True).filter(
        CompetitionScore.event_id == event_id,
        or_(Member.role != Role.SUPERADMIN, CompetitionScore.member_id == None)
    ).all()

    # 2. 정렬 로직 (get_event_leaderboard와 동일)
    is_time = (event.score_type == 'time')
    def sort_key(s):
        rx = 1 if s.is_rx else 0
        scale_weights = {'A': 3, 'B': 2, 'C': 1}
        scale_weight = scale_weights.get(s.scale_rank, 0) if not s.is_rx else 0
        val = parse_score(s.score_value, event.score_type)
        tb_val = parse_score(s.tie_break, 'time') if s.tie_break else 999999
        if is_time:
            return (-rx, -scale_weight, val, tb_val)
        else:
            return (-rx, -scale_weight, -val, tb_val)
            
    sorted_scores = sorted(scores, key=sort_key)

    # 3. 데이터프레임 생성을 위한 그룹핑 (성별, 스케일별)
    # 그룹 키: (gender, scale_category)
    # gender: 'M', 'F', None(알수없음)
    # scale_category: 'Rx', 'ScaleA', 'ScaleB', 'ScaleC', 'ScaleNone'
    groups = {}

    for s in sorted_scores:
        gender = 'M' if s.member_id and s.member and s.member.gender == 'M' else \
                 'F' if s.member_id and s.member and s.member.gender == 'F' else \
                 s.guest_gender if s.guest_gender in ['M', 'F'] else 'Unknown'
        
        scale_cat = 'Rx' if s.is_rx else \
                    f"Scale{s.scale_rank}" if s.scale_rank in ['A', 'B', 'C'] else 'Scale_Other'
                    
        group_key = f"{gender}_{scale_cat}"
        if group_key not in groups:
            groups[group_key] = []
            
        # 순위 계산 로직 생략 (엑셀 자체가 정렬되어 나가므로 단순히 인덱스로 등수 표기 가능, 여기서는 간단히 리스트 길이+1)
        # 등수는 엑셀에서 확인하거나 별도 컬럼으로 저장
        
        # 이름, 전화번호 마스킹 해제 (관리자용이므로 원본 허용 시)
        # 하지만 연락처는 guest_phone 필드를 활용하거나 member의 핸드폰 번호를 가져옴
        phone = s.guest_phone or (s.member.phone if s.member else "")
        gym_name = s.guest_gym or (s.member.gym.name if s.member and s.member.gym else "")
        
        groups[group_key].append({
            "이름": s.member_name,
            "연락처": phone,
            "성별": gender,
            "소속": gym_name,
            "기록": s.score_value,
            "타이브레이크": s.tie_break or "",
            "스케일": scale_cat,
            "비고": s.note or ""
        })

    # 4. 엑셀 쓰기
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if not groups:
            # 빈 시트 생성
            pd.DataFrame(columns=["이름", "연락처", "성별", "소속", "기록", "타이브레이크", "스케일", "비고"]).to_excel(writer, index=False, sheet_name="기록데이터")
        else:
            for group_key, data_list in groups.items():
                df = pd.DataFrame(data_list)
                # 시트명은 최대 31자 제한 유의
                sheet_name = group_key[:31] 
                df.to_excel(writer, index=False, sheet_name=sheet_name)

    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="leaderboard_event_{event_id}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/events/{event_id}/export-template")
def export_event_excel_template(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """
    점수 일괄 등록을 위한 엑셀 빈 양식을 다운로드합니다.
    """
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # 양식 컬럼 정의
        columns = ["이름(필수)", "연락처(권장, 중복방지용)", "기록(필수, 예: 10:30 또는 150)", "타이브레이크", "스케일(Rx, A, B, C 중 1)", "성별(M/F)", "비고"]
        df = pd.DataFrame(columns=columns)
        
        # 예시 데이터 1행 추가
        df.loc[0] = ["홍길동", "010-1234-5678", "12:30" if event.score_type == 'time' else "100", "", "Rx", "M", "예시입니다. 이 줄은 지우고 입력하세요."]
        
        df.to_excel(writer, index=False, sheet_name="입력양식")

    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="template_event_{event_id}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.post("/events/{event_id}/import-excel")
async def import_event_scores_excel(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """
    엑셀 파일을 업로드하여 점수를 일괄 등록/수정합니다.
    """
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # 권한 체크 생략 (데모용, 실제로는 필요)

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"엑셀 파일을 읽는 중 오류가 발생했습니다: {str(e)}")

    # 필수 컬럼 체크 (이름, 기록, 스케일)
    required_cols = ["이름(필수)", "기록(필수, 예: 10:30 또는 150)", "스케일(Rx, A, B, C 중 1)"]
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"필수 컬럼이 누락되었습니다: '{col}'. 양식을 다시 확인해주세요.")

    processed_count = 0
    
    # 내 체육관 이름 (관리자가 대행 업로드하는 경우 소속 표기용)
    my_gym_name = current_user.gym.name if current_user and current_user.gym else "Unknown Gym"

    for idx, row in df.iterrows():
        # NaN 값 처리
        row = row.fillna("")
        
        name = str(row.get("이름(필수)", "")).strip()
        raw_score = str(row.get("기록(필수, 예: 10:30 또는 150)", "")).strip()
        scale_val = str(row.get("스케일(Rx, A, B, C 중 1)", "")).strip().upper()
        
        # 예시 행 스킵
        if name == "홍길동" and "예시입니다" in str(row.get("비고", "")):
            continue
            
        if not name or not raw_score or not scale_val:
            continue # 데이터가 없는 행 스킵
            
        phone = str(row.get("연락처(권장, 중복방지용)", "")).strip()
        tie_break = str(row.get("타이브레이크", "")).strip()
        gender = str(row.get("성별(M/F)", "")).strip().upper()
        note = str(row.get("비고", "")).strip()

        is_rx = (scale_val == "RX")
        scale_rank = None
        if not is_rx and scale_val in ["A", "B", "C"]:
            scale_rank = scale_val

        # 기존 기록 찾기 (이름과 번호 기반으로)
        existing_score = None
        if phone:
            existing_score = db.query(CompetitionScore).filter(
                CompetitionScore.event_id == event_id,
                CompetitionScore.member_name == name,
                CompetitionScore.guest_phone == phone
            ).first()
        else:
            # 번호가 없으면 이름만으로 검색 (이 경우는 동명이인 문제가 발생할 수 있지만 엑셀 일괄 업로드에서는 첫번째 것 덮어쓰기)
            existing_score = db.query(CompetitionScore).filter(
                CompetitionScore.event_id == event_id,
                CompetitionScore.member_name == name
            ).first()
            
        if existing_score:
            existing_score.score_value = raw_score
            existing_score.is_rx = is_rx
            existing_score.scale_rank = scale_rank
            existing_score.tie_break = tie_break
            existing_score.note = note
            existing_score.status = "approved"
            if gender in ['M', 'F']:
                existing_score.guest_gender = gender
        else:
            new_score = CompetitionScore(
                event_id=event_id,
                member_name=name,
                score_value=raw_score,
                is_rx=is_rx,
                scale_rank=scale_rank,
                tie_break=tie_break,
                note=note,
                guest_phone=phone,
                guest_gender=gender if gender in ['M', 'F'] else None,
                guest_gym=my_gym_name,
                status="approved"
            )
            db.add(new_score)
            
        processed_count += 1

    db.commit()
    return {"message": f"{processed_count}개의 기록이 성공적으로 일괄 등록/수정되었습니다."}

# =========================================================
# 16-1. [신규] 코치 전용: 기록 삭제
# =========================================================
@router.delete("/scores/{score_id}")
def delete_score(
    score_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)

    score = db.query(CompetitionScore).filter(CompetitionScore.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")

    db.delete(score)
    db.commit()
    return {"message": "기록이 삭제되었습니다."}

# =========================================================
# 17. [신규] 코치 전용: 누락 회원 및 게스트 기록 일괄 추가 (Bulk Entry)
# =========================================================
from pydantic import BaseModel

class CoachSubmitRequest(BaseModel):
    member_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_gender: Optional[str] = None
    score_value: str
    is_rx: bool
    scale_rank: Optional[str] = None
    is_time_cap: Optional[bool] = False
    tie_break: Optional[str] = None
    note: Optional[str] = None

@router.post("/events/{event_id}/coach-submit")
def coach_submit_score(
    event_id: int,
    req: CoachSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)
        
    from models import Gym
    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None

    # 회원 ID가 있는 경우 (정식 회원)
    if req.member_id:
        target_member = db.query(Member).filter(Member.id == req.member_id).first()
        if not target_member: 
            raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
            
        # ✅ [보안] 본인 박스 소속 회원인지 확인 (총관리자는 패스)
        if current_user.role != Role.SUPERADMIN and target_member.gym_id != current_user.gym_id:
            raise HTTPException(status_code=403, detail="본인 박스 소속 회원만 기록을 대리 등록할 수 있습니다.")
            
        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_id == req.member_id
        ).first()
        
        name_to_save = target_member.name
        guest_phone_to_save = None
        guest_gender_to_save = None
    else:
        # 게스트인 경우
        if not req.guest_name:
            raise HTTPException(status_code=400, detail="게스트 이름이 필요합니다.")
            
        existing_score = db.query(CompetitionScore).filter(
            CompetitionScore.event_id == event_id,
            CompetitionScore.member_id == None,
            CompetitionScore.member_name == req.guest_name,
            CompetitionScore.guest_phone == (req.guest_phone or "")
        ).first()
        
        name_to_save = req.guest_name
        guest_phone_to_save = req.guest_phone or ""
        guest_gender_to_save = req.guest_gender
        
    if existing_score:
        existing_score.score_value = req.score_value
        existing_score.is_rx = req.is_rx
        existing_score.scale_rank = req.scale_rank
        existing_score.is_time_cap = req.is_time_cap
        existing_score.tie_break = req.tie_break
        existing_score.note = req.note
        existing_score.status = "approved" # 코치 대리제출이므로 무조건 승인
        # ✅ 이름 수정 지원 (게스트)
        if req.guest_name and not req.member_id:
            existing_score.member_name = req.guest_name
        db.commit()
        return {"message": "기록이 대리 수정 및 승인되었습니다."}
    else:
        new_score = CompetitionScore(
            event_id=event_id,
            member_id=req.member_id,
            member_name=name_to_save,
            score_value=req.score_value,
            is_rx=req.is_rx,
            scale_rank=req.scale_rank,
            is_time_cap=req.is_time_cap,
            tie_break=req.tie_break,
            note=req.note,
            guest_phone=guest_phone_to_save,
            guest_gender=guest_gender_to_save,
            guest_gym=my_gym_name if not req.member_id else None,
            status="approved" # 코치 대리 제출이므로 승인 완료
        )
        db.add(new_score)
        db.commit()
        return {"message": "기록이 대리 등록 및 승인되었습니다."}

# =========================================================
# 17. [신규] 코치 전용: 누락 회원 및 게스트 기록 일괄 추가 (Bulk Entry)
# =========================================================
@router.post("/events/{event_id}/bulk-submit")
def coach_bulk_submit_scores(
    event_id: int,
    req_list: List[CoachSubmitRequest],
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    assert_competition_staff(current_user)

    from models import Gym
    my_gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
    my_gym_name = my_gym.name if my_gym else None

    # ✅ [신규] 동명이인 감지 결과 저장
    duplicates_found = []
    processed_count = 0

    for idx, req in enumerate(req_list):
        if req.member_id:
            target_member = db.query(Member).filter(Member.id == req.member_id).first()
            if not target_member:
                continue

            # ✅ [보안] 본인 박스 소속 회원인지 확인 (총관리자는 패스)
            if current_user.role != Role.SUPERADMIN and target_member.gym_id != current_user.gym_id:
                continue

            existing_score = db.query(CompetitionScore).filter(
                CompetitionScore.event_id == event_id,
                CompetitionScore.member_id == req.member_id
            ).first()

            name_to_save = target_member.name
            guest_phone_to_save = None
            guest_gender_to_save = None
        else:
            if not req.guest_name:
                continue

            # ✅ [신규] 동명이인 감지
            if req.guest_phone:
                # 전화번호 + 이름으로 정확히 매칭
                existing_score = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == None,
                    CompetitionScore.guest_phone == req.guest_phone,
                    CompetitionScore.member_name == req.guest_name
                ).first()
            else:
                # 전화번호 없음: 이름으로 동명이인 검색
                same_name_scores = db.query(CompetitionScore).filter(
                    CompetitionScore.event_id == event_id,
                    CompetitionScore.member_id == None,
                    CompetitionScore.member_name == req.guest_name
                ).all()

                # 동명이인 존재 → 사용자 확인 필요
                if len(same_name_scores) > 0:
                    duplicates_found.append({
                        "row_index": idx,
                        "guest_name": req.guest_name,
                        "duplicates": [
                            {
                                "masked_phone": mask_phone_number(s.guest_phone),
                                "name": s.member_name
                            }
                            for s in same_name_scores
                        ]
                    })
                    continue  # 이 행은 일단 건너뜀

                existing_score = same_name_scores[0] if same_name_scores else None

            name_to_save = req.guest_name
            guest_phone_to_save = req.guest_phone or ""
            guest_gender_to_save = req.guest_gender

        if existing_score:
            existing_score.score_value = req.score_value
            existing_score.is_rx = req.is_rx
            existing_score.scale_rank = req.scale_rank
            existing_score.is_time_cap = req.is_time_cap
            existing_score.tie_break = req.tie_break
            existing_score.note = req.note
            existing_score.status = "approved"
        else:
            new_score = CompetitionScore(
                event_id=event_id,
                member_id=req.member_id,
                member_name=name_to_save,
                score_value=req.score_value,
                is_rx=req.is_rx,
                scale_rank=req.scale_rank,
                is_time_cap=req.is_time_cap,
                tie_break=req.tie_break,
                note=req.note,
                guest_phone=guest_phone_to_save,
                guest_gender=guest_gender_to_save,
                guest_gym=my_gym_name if not req.member_id else None,
                status="approved"
            )
            db.add(new_score)

        processed_count += 1

    db.commit()

    # ✅ [신규] 동명이인이 있으면 경고와 함께 반환
    if duplicates_found:
        return {
            "status": "duplicates_found",
            "message": f"총 {processed_count}건의 기록이 등록되었습니다. {len(duplicates_found)}건의 동명이인이 발견되었습니다.",
            "processed_count": processed_count,
            "duplicates": duplicates_found,
            "action_required": True
        }

    return {
        "status": "success",
        "message": f"총 {processed_count}건의 기록이 성공적으로 등록되었습니다.",
        "processed_count": processed_count,
        "action_required": False
    }
