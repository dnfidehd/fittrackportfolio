"""
Shared helper functions and utilities for competition routers.
"""
from sqlalchemy.orm import Session
from models import Member
from schemas import CompetitionResponse


def anonymize_name(name: str) -> str:
    """Anonymize a name by masking middle characters."""
    if not name:
        return "Unknown"
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


def mask_phone_number(phone: str) -> str:
    """
    Mask phone number for privacy.
    Examples:
    - "01012345678" → "010-12**-**78"
    - "1012345678" → "101-23**-**78"
    """
    if not phone:
        return ""
    # Remove non-digit characters
    cleaned = phone.replace("-", "").replace(" ", "")

    if len(cleaned) == 11:  # 01012345678
        return f"{cleaned[0:3]}-{cleaned[3:5]}**-**{cleaned[9:11]}"
    elif len(cleaned) == 10:  # 1012345678
        return f"{cleaned[0:3]}-{cleaned[3:5]}**-**{cleaned[8:10]}"
    else:
        return phone  # Return as-is if format doesn't match


def parse_score(score_str: str, score_type: str):
    """
    Parse score string based on score type (time or reps).

    Args:
        score_str: Raw score string (e.g., "12:30", "150", "CAP+5")
        score_type: Either 'time' or other (reps/weight)

    Returns:
        Numeric score for comparison
    """
    if not score_str:
        return 0

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


def enrich_with_admins(comp, db: Session) -> dict:
    """
    Enrich competition data with list of admin names.

    Args:
        comp: Competition model instance
        db: Database session

    Returns:
        Dictionary with competition data and admin_names list
    """
    comp_dict = CompetitionResponse.model_validate(comp).model_dump()
    gym_ids = [g.gym_id for g in comp.participating_gyms if g.status == 'accepted']

    if gym_ids:
        admins = db.query(Member.name).filter(
            Member.gym_id.in_(gym_ids),
            Member.role.in_(['subcoach', 'coach', 'admin', 'superadmin'])
        ).all()
        comp_dict['admin_names'] = [a[0] for a in admins]
    else:
        comp_dict['admin_names'] = []

    return comp_dict
