# fittrack-backend/ai_service.py
import google.generativeai as genai
from config import settings
from sqlalchemy.orm import Session
from models import Member, PersonalRecord

GEMINI_API_KEY = settings.gemini_api_key

def get_ai_coaching(member_id: int, member_name: str, wod_info: dict, user_records: str, question: str, db: Session):
    if not GEMINI_API_KEY:
        print("❌ [AI Error] API 키가 없습니다.")
        return "API 키가 설정되지 않았어요. 관리자에게 문의해주세요."

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # 1. 회원 상세 정보 조회 (신체 스펙)
        member = db.query(Member).filter(Member.id == member_id).first()
        
        # ▼▼▼ [중요] 변수 초기화 (이 줄이 없으면 에러가 납니다!)
        body_info = "신체 정보 없음 (입력되지 않음)" 
        
        if member:
            gender = member.gender or "미설정"
            height = f"{member.height}cm" if member.height else "?"
            weight = f"{member.weight}kg" if member.weight else "?"
            goal = member.workout_goal or "건강관리"
            # 여기서 정보가 있으면 덮어씌웁니다.
            body_info = f"성별: {gender}, 키: {height}, 체중: {weight}, 운동목표: {goal}"

        # 2. PR 기록 조회 (최고 기록)
        prs = db.query(PersonalRecord).filter(PersonalRecord.member_id == member_id).all()
        pr_text = "등록된 PR 기록 없음"
        if prs:
            pr_list = [f"{pr.exercise_name}: {pr.record_value} ({pr.recorded_date})" for pr in prs]
            pr_text = ", ".join(pr_list)

        # 3. 프롬프트 작성
        prompt = f"""
        당신은 'FitTrack AI'라는 전문 크로스핏 코치입니다.
        회원 이름: {member_name}
        
        [회원 신체 스펙]
        {body_info}
        
        [회원 최고 기록(PR)]
        {pr_text}
        
        [오늘의 WOD]
        {wod_info['title']} ({wod_info['score_type']})
        {wod_info['description']}
        
        [최근 운동 기록]
        {user_records}
        
        [회원의 질문]
        "{question}"
        
        [지시사항]
        1. 회원의 **신체 스펙(키, 몸무게, 목표)**과 **PR 기록**을 고려해서 맞춤형 조언을 해주세요.
           (예: "회원님은 PR이 높으시니 오늘은 무게를 좀 더 쳐보세요!" 또는 "다이어트가 목표시니 휴식 시간을 줄여보세요!")
        2. 말투: 친절하고 활기찬 해요체, 이모지 사용 (💪, 🔥).
        3. 분량: 3~4문장으로 핵심만 간결하게.
        4. 같은 말을 반복하지 말고, 질문에 대한 구체적인 답변을 주세요.
        """

        # ▼▼▼ 디버깅용 출력 (서버 터미널 확인용)
        print("="*50)
        print(f"📢 AI에게 들어간 신체 정보:\n{body_info}")
        print("="*50)

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        print(f"❌ [AI Error] Gemini 오류 발생: {e}")
        return "죄송해요, 지금은 AI 코치와 연결할 수 없어요. (서버 오류)"