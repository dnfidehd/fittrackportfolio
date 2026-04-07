# ai_logic.py

from typing import List, Dict
from datetime import date

# 각 운동이 어떤 부위/종류에 속하는지 정의
EXERCISE_MAP = {
    "스쿼트": "하체", "데드리프트": "하체",
    "클린": "전신", "스내치": "전신", "저크": "전신",
    "숄더프레스": "상체-밀기", "벤치프레스": "상체-밀기",
    "풀업": "상체-당기기", "바벨 로우": "상체-당기기",
}

# 추천 규칙
RECOMMENDATION_RULES = {
    "하체": "풀업",
    "상체-밀기": "바벨 로우",
    "상체-당기기": "벤치프레스",
    "전신": "케틀벨 스윙",
}

def get_recommendation(user_workouts: List[Dict]) -> str:
    if not user_workouts:
        return "스쿼트를 통해 강한 하체를 만들어보세요!"

    # 가장 최근에 한 운동을 찾음
    # date가 문자열일 수 있으므로 date 객체로 변환하여 비교
    latest_workout = max(user_workouts, key=lambda x: date.fromisoformat(str(x['date'])))
    exercise_name = latest_workout['workout']
    
    exercise_type = EXERCISE_MAP.get(exercise_name)
    if not exercise_type:
        return "가벼운 조깅으로 심폐지구력을 길러보세요!"

    recommended_exercise = RECOMMENDATION_RULES.get(exercise_type)
    if not recommended_exercise:
        return "휴식도 중요한 훈련입니다. 충분히 쉬어주세요!"
    
    return f"최근 {exercise_name}을 하셨군요! 다음엔 {recommended_exercise}(으)로 균형을 맞춰보세요."