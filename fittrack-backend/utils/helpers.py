# fittrack-backend/utils/helpers.py
# 도메인별 헬퍼 함수들

from constants import ScoreConstants, ScoreType


# ========== 점수 처리 헬퍼 함수 ==========
def parse_score(score_str: str, score_type: str):
    """
    문자열 점수를 숫자로 변환

    Args:
        score_str: 점수 문자열 (예: "5:30", "135LB", "50REPS", "CAP+3")
        score_type: 점수 유형 (time, weight, reps)

    Returns:
        변환된 점수 (float 또는 int)
    """
    if not score_str:
        return 0

    clean_score = score_str.upper().replace('LB', '').replace('KG', '').replace('REPS', '').strip()

    if score_type == ScoreType.TIME or score_type == 'time':
        # 타임 점수 처리
        if 'CAP' in clean_score:
            try:
                if '+' in clean_score:
                    parts = clean_score.split('+')
                    extra_reps = int(parts[1].strip())
                else:
                    extra_reps = 0
                return ScoreConstants.TIME_CAP_PENALTY - extra_reps
            except:
                return ScoreConstants.TIME_CAP_PENALTY
        try:
            if ':' in clean_score:
                m, s = clean_score.split(':')
                return int(m) * 60 + int(s)
            return int(float(clean_score))
        except:
            return ScoreConstants.MAX_SCORE
    else:
        # 무게 또는 반복 점수 처리
        try:
            return float(clean_score)
        except:
            return 0.0


# ========== 이름 처리 헬퍼 함수 ==========
def anonymize_name(name: str) -> str:
    """
    이름을 익명화 (첫 글자와 마지막 글자만 표시)

    Args:
        name: 원본 이름

    Returns:
        익명화된 이름 (예: "John" → "J**n", "AB" → "A*")
    """
    if not name:
        return "Unknown"
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


# ========== 전화번호 처리 헬퍼 함수 ==========
def mask_phone_number(phone: str) -> str:
    """
    전화번호를 마스킹 (중간 4자리 숨김)

    Args:
        phone: 전화번호 (예: "01012345678")

    Returns:
        마스킹된 전화번호 (예: "010-12**-**78")
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


# ========== 이메일 마스킹 ==========
def mask_email(email: str) -> str:
    """
    이메일을 마스킹 (@보다 앞 일부만 표시)

    Args:
        email: 이메일 주소

    Returns:
        마스킹된 이메일
    """
    if not email or '@' not in email:
        return "***@***"

    parts = email.split('@')
    if len(parts[0]) <= 2:
        masked_local = parts[0][0] + '*'
    else:
        masked_local = parts[0][0] + '*' * (len(parts[0]) - 2) + parts[0][-1]

    return f"{masked_local}@{parts[1]}"


# ========== 시간 포맷팅 ==========
def format_time_seconds(seconds: int) -> str:
    """
    초를 분:초 형식으로 변환

    Args:
        seconds: 초 단위 시간

    Returns:
        MM:SS 형식의 문자열
    """
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"


# ========== 무게 포맷팅 ==========
def format_weight(weight: float, unit: str = "kg") -> str:
    """
    무게를 포맷팅

    Args:
        weight: 무게 값
        unit: 단위 (기본값: "kg")

    Returns:
        포맷된 무게 문자열
    """
    return f"{weight:.1f}{unit}"
