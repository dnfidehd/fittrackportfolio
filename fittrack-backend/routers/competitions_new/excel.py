"""
Excel import/export endpoints: GET /events/{event_id}/export-excel,
GET /events/{event_id}/export-template, POST /events/{event_id}/import-excel
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
import pandas as pd
import io
from fastapi.responses import StreamingResponse

from database import get_db
from security import get_current_user_optional
from models import Competition, CompetitionEvent, CompetitionGym, CompetitionScore, Member
from .helpers import parse_score

router = APIRouter()


# GET /events/{event_id}/export-excel
@router.get("/events/{event_id}/export-excel")
def export_event_leaderboard_excel(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """Export event leaderboard to Excel file, organized by gender and scale."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    comp = event.competition

    # Check permissions
    is_admin = False
    if current_user and current_user.role in ['admin', 'superadmin']:
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

    # Get all scores
    scores = db.query(CompetitionScore).join(
        Member, CompetitionScore.member_id == Member.id, isouter=True
    ).filter(
        CompetitionScore.event_id == event_id,
        or_(Member.role != 'superadmin', CompetitionScore.member_id == None)
    ).all()

    # Sort scores
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

    # Group by gender and scale
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

    # Write to Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if not groups:
            pd.DataFrame(columns=["이름", "연락처", "성별", "소속", "기록", "타이브레이크", "스케일", "비고"]).to_excel(
                writer, index=False, sheet_name="기록데이터"
            )
        else:
            for group_key, data_list in groups.items():
                df = pd.DataFrame(data_list)
                sheet_name = group_key[:31]
                df.to_excel(writer, index=False, sheet_name=sheet_name)

    output.seek(0)

    headers = {
        'Content-Disposition': f'attachment; filename="leaderboard_event_{event_id}.xlsx"'
    }
    return StreamingResponse(
        output,
        headers=headers,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# GET /events/{event_id}/export-template
@router.get("/events/{event_id}/export-template")
def export_event_excel_template(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """Export blank Excel template for bulk score import."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        columns = [
            "이름(필수)",
            "연락처(권장, 중복방지용)",
            "기록(필수, 예: 10:30 또는 150)",
            "타이브레이크",
            "스케일(Rx, A, B, C 중 1)",
            "성별(M/F)",
            "비고"
        ]
        df = pd.DataFrame(columns=columns)

        # Add example row
        example_score = "12:30" if event.score_type == 'time' else "100"
        df.loc[0] = [
            "홍길동",
            "010-1234-5678",
            example_score,
            "",
            "Rx",
            "M",
            "예시입니다. 이 줄은 지우고 입력하세요."
        ]

        df.to_excel(writer, index=False, sheet_name="입력양식")

    output.seek(0)

    headers = {
        'Content-Disposition': f'attachment; filename="template_event_{event_id}.xlsx"'
    }
    return StreamingResponse(
        output,
        headers=headers,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# POST /events/{event_id}/import-excel
@router.post("/events/{event_id}/import-excel")
async def import_event_scores_excel(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[Member] = Depends(get_current_user_optional)
):
    """Import scores from Excel file (bulk upload)."""
    event = db.query(CompetitionEvent).filter(CompetitionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"엑셀 파일을 읽는 중 오류가 발생했습니다: {str(e)}")

    # Check required columns
    required_cols = [
        "이름(필수)",
        "기록(필수, 예: 10:30 또는 150)",
        "스케일(Rx, A, B, C 중 1)"
    ]
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"필수 컬럼이 누락되었습니다: '{col}'. 양식을 다시 확인해주세요."
            )

    processed_count = 0
    my_gym_name = current_user.gym.name if current_user and current_user.gym else "Unknown Gym"

    for idx, row in df.iterrows():
        row = row.fillna("")

        name = str(row.get("이름(필수)", "")).strip()
        raw_score = str(row.get("기록(필수, 예: 10:30 또는 150)", "")).strip()
        scale_val = str(row.get("스케일(Rx, A, B, C 중 1)", "")).strip().upper()

        # Skip example row
        if name == "홍길동" and "예시입니다" in str(row.get("비고", "")):
            continue

        if not name or not raw_score or not scale_val:
            continue

        phone = str(row.get("연락처(권장, 중복방지용)", "")).strip()
        tie_break = str(row.get("타이브레이크", "")).strip()
        gender = str(row.get("성별(M/F)", "")).strip().upper()
        note = str(row.get("비고", "")).strip()

        is_rx = (scale_val == "RX")
        scale_rank = None
        if not is_rx and scale_val in ["A", "B", "C"]:
            scale_rank = scale_val

        # Find existing score
        existing_score = None
        if phone:
            existing_score = db.query(CompetitionScore).filter(
                CompetitionScore.event_id == event_id,
                CompetitionScore.member_name == name,
                CompetitionScore.guest_phone == phone
            ).first()
        else:
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
