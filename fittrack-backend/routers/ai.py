from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import List
import google.generativeai as genai
import os
from datetime import date
from dotenv import load_dotenv

# 내부 모듈 임포트
from database import get_db
from routers.auth import get_current_user
# ✅ [수정] WodRecord 모델 추가 임포트 + Goal 모델 추가
from models import Member, Wod, Workout, PersonalRecord, WodRecord, Goal

load_dotenv()

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Coach"]
)

# Gemini API 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("⚠️ 경고: GEMINI_API_KEY가 설정되지 않았습니다.")
else:
    genai.configure(api_key=GEMINI_API_KEY)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class WodRequest(BaseModel):
    prompt: str
    environment: str = "box"  # box 또는 home

@router.post("/chat")
def chat_with_ai(
    request: ChatRequest, 
    current_user: Member = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        # 1. [신체 정보]
        height_info = f"{current_user.height}cm" if current_user.height else "정보 없음"
        weight_info = f"{current_user.weight}kg" if current_user.weight else "정보 없음"
        gender_info = current_user.gender or "정보 없음"
        exp_info = current_user.crossfit_experience or "정보 없음"

        # 2. [PR 기록] (기존 유지)
        prs = db.query(PersonalRecord).filter(
            PersonalRecord.member_id == current_user.id
        ).order_by(
            PersonalRecord.recorded_date.desc()
        ).limit(20).all()
        
        prs.reverse() # 과거 -> 현재

        if prs:
            pr_list = [f"- [{pr.recorded_date}] {pr.exercise_name}: {pr.record_value}{pr.unit}" for pr in prs]
            pr_context = "\n".join(pr_list)
        else:
            pr_context = "등록된 PR 기록이 없습니다."

        # 3. [최근 운동 일지] (개인 운동 - 기존 유지)
        recent_workouts = db.query(Workout).filter(
            Workout.member_id == current_user.id
        ).order_by(
            Workout.date.desc()
        ).limit(5).all()
        
        recent_workouts.reverse()

        if recent_workouts:
            workout_context = "\n".join([f"- [{w.date}] {w.workout} (기록: {w.time})" for w in recent_workouts])
        else:
            workout_context = "최근 개인 운동 기록이 없습니다."

        # ✅ 4. [WOD 랭킹 기록] (여기가 새로 추가된 핵심입니다!)
        # 회원이 수행한 WOD 기록을 가져와서 Rx/Scale 여부까지 AI에게 알려줍니다.
        recent_wod_records = db.query(WodRecord).filter(
            WodRecord.member_id == current_user.id
        ).order_by(
            WodRecord.created_at.desc()
        ).limit(10).all()

        recent_wod_records.reverse() # 과거 -> 현재

        if recent_wod_records:
            wod_record_list = []
            for r in recent_wod_records:
                # WOD 제목 찾기 (관계 설정이 안되어 있을 경우를 대비해 쿼리)
                wod_title = "WOD"
                if r.wod:
                    wod_title = r.wod.title
                else:
                    found_wod = db.query(Wod).filter(Wod.id == r.wod_id).first()
                    if found_wod: wod_title = found_wod.title

                # 레벨 정보 (Rx 또는 Scale A, B...)
                level_info = "Rx" if r.is_rx else (r.note or "Scale")
                
                # 날짜 포맷
                date_str = r.created_at.strftime("%Y-%m-%d")

                wod_record_list.append(f"- [{date_str}] {wod_title}: {r.record_value} ({level_info})")
            
            wod_record_context = "\n".join(wod_record_list)
        else:
            wod_record_context = "아직 WOD 랭킹에 등록된 기록이 없습니다."

        # 5. [오늘의 WOD]
        today = date.today()
        today_wod = db.query(Wod).filter(Wod.date == today).first()
        if today_wod:
            wod_context = f"제목: {today_wod.title}\n내용: {today_wod.content}\n채점방식: {today_wod.score_type}"
        else:
            wod_context = "오늘의 공식 WOD 스케줄이 없습니다 (휴식일)."

        # 6. [회원 목표] - 새로 추가
        active_goals = db.query(Goal).filter(
            Goal.member_id == current_user.id,
            Goal.status == "진행중"
        ).order_by(Goal.created_at.desc()).limit(5).all()
        
        if active_goals:
            goals_list = []
            for g in active_goals:
                progress = min((g.current_value / g.target_value) * 100, 100) if g.target_value > 0 else 0
                deadline_str = f" (D-{(g.deadline - today).days})" if g.deadline and g.deadline > today else ""
                goals_list.append(f"- {g.title}: {g.current_value}/{g.target_value}{g.unit} ({progress:.0f}%){deadline_str}")
            goals_context = "\n".join(goals_list)
        else:
            goals_context = "아직 설정한 목표가 없습니다."

        # 7. [시스템 프롬프트 강화]
        system_instruction = (
            f"당신은 크로스핏 전문 코치 '핏트랙 코치'입니다. 회원의 데이터를 바탕으로 전문적인 피드백을 주세요.\n\n"
            
            f"--- [회원 프로필] ---\n"
            f"이름: {current_user.name}\n"
            f"신체: {height_info}, {weight_info}, {gender_info}\n"
            f"경력: {exp_info}\n"
            f"---------------------\n\n"

            f"--- [🎯 회원 목표 (중요!)] ---\n"
            f"회원이 직접 설정한 피트니스 목표입니다. 목표 달성을 위한 조언과 동기부여를 주세요.\n"
            f"{goals_context}\n"
            f"-----------------------------------\n\n"

            f"--- [WOD 수행 기록 (랭킹 등록)] ---\n"
            f"**가장 중요한 데이터입니다.** 회원이 실제로 수행한 WOD 기록입니다.\n"
            f"Rx는 정식 무게/동작 수행, Scale은 난이도를 조절한 것입니다.\n"
            f"{wod_record_context}\n"
            f"-----------------------------------\n\n"

            f"--- [PR 성장 기록] ---\n"
            f"{pr_context}\n"
            f"-----------------------------------\n\n"

            f"--- [개인 운동 일지] ---\n"
            f"{workout_context}\n"
            f"-----------------------------------\n\n"

            f"--- [오늘의 박스 WOD] ---\n"
            f"{wod_context}\n"
            f"--------------------\n\n"

            f"--- [답변 가이드라인 (중요)] ---\n"
            f"1. **사용자의 질문에 집중:** 운동 외의 질문(운세, 농담, 날씨 등)을 하면, 그 질문에 맞는 **재치 있는 답변을 먼저 해주세요.** 운동 얘기만 하는 로봇처럼 굴지 마세요.\n"
            f"2. **목표 기반 조언:** 회원의 목표를 항상 인식하고, 목표 달성에 도움되는 조언을 주세요. 예: '백스쿼트 100kg 목표까지 10kg 남았네요! 오늘 스쿼트 세션은 꼭 집중하세요!'\n"
            f"3. **자연스러운 연결:** 일상적인 대화 후에는 자연스럽게 운동 동기부여로 연결하세요. (억지스럽다면 생략해도 좋습니다.)\n"
            f"4. **운동 질문일 경우:** WOD 기록과 PR 정보를 바탕으로 구체적이고 전문적인 피드백을 주세요. Rx 수행자에게는 칭찬을, Scale 수행자에게는 격려를 주세요.\n"
            f"5. **말투:** 유쾌하고 에너지 넘치는, 친한 크로스핏 코치님 말투(해요체). **이름은 너무 자주 부르지 마세요**, 친구처럼 대해주세요.\n"
            f"6. **길이:** **최대 3문장**. 짧고 굵게 핵심만. (상세한 식단/운동 추천 요청 시에만 길게)\n"
        )

        # ✅ [디버깅]
        print("\n=== [AI Context Injection] ===")
        print(f"User: {current_user.name}")
        print(f"[WOD Records]\n{wod_record_context}")
        print("==============================\n")

        # 7. 모델 생성
        model = genai.GenerativeModel(
            'gemini-2.5-flash-lite', 
            system_instruction=system_instruction
        )

        gemini_history = []
        for msg in request.history:
            role = "model" if msg.role == "assistant" else "user"
            gemini_history.append({
                "role": role,
                "parts": [msg.content]
            })

        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(request.message)

        return {"response": response.text}

    except Exception as e:
        print(f"❌ AI Chat Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"response": "AI 서버 연결 상태가 좋지 않습니다. (모델: gemini-2.5-flash-lite)"}

@router.get("/recommendation")
def get_recommendation():
    return {"message": "데이터 분석 중..."}
# ✅ [신규] AI 분석 응답 모델
class AIAnalysisResponse(BaseModel):
    can_analyze: bool
    message: str # 분석 불가 시 이유, 가능 시 응원의 한마디
    # 아래는 분석 가능한 경우에만 채워짐
    summary: str = ""
    strengths: List[str] = []
    weaknesses: List[str] = []
    advice: str = ""
    radar_chart: dict = {} # 예: {"근력": 80, "지구력": 70, ...}

@router.post("/analyze", response_model=AIAnalysisResponse)
def analyze_performance(
    current_user: Member = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. 최근 30일간 운동 기록 조회 (Workout + WodRecord)
    # 30일 제한을 두지 않고 전체 기록 중 최근 30개를 가져오는 것이 나을 수 있음 (분석 정확도 위해)
    
    # 개인 운동
    recent_workouts = db.query(Workout).filter(
        Workout.member_id == current_user.id
    ).order_by(Workout.date.desc()).limit(20).all()
    
    # WOD 기록
    recent_wod_records = db.query(WodRecord).filter(
        WodRecord.member_id == current_user.id
    ).order_by(WodRecord.created_at.desc()).limit(20).all()
    
    total_count = len(recent_workouts) + len(recent_wod_records)
    
    # 2. 기록 부족 시 처리
    if total_count < 5:
        return AIAnalysisResponse(
            can_analyze=False,
            message=f"아직 분석할 데이터가 부족해요. (현재 {total_count}/5회)\\n꾸준히 운동하고 기록을 남겨보세요! 💪"
        )

    # 3. 데이터 요약
    data_summary = f"사용자 정보: {current_user.gender}, {current_user.height}cm, {current_user.weight}kg, 경력 {current_user.crossfit_experience}\\n"
    data_summary += "최근 운동 기록:\\n"
    
    for w in recent_workouts:
        data_summary += f"- [개인운동] {w.date}: {w.workout} ({w.time})\\n"
        
    for r in recent_wod_records:
        wod_title = r.wod.title if r.wod else "Unknown WOD"
        level = "Rx" if r.is_rx else (r.scale_rank or "Scaled")
        # Time Cap 여부 포함
        record_val = r.record_value
        if r.is_time_cap:
            record_val = f"Time Cap ({r.record_value})"
        data_summary += f"- [WOD] {wod_title} ({level}): {record_val}\\n"
        
    # 4. 데이터 해시 생성 (Caching Key)
    import hashlib
    import json
    
    # 해시 생성을 위한 원본 데이터 조합 (프로필 + 운동기록 요약문)
    # data_summary 문자열 자체가 이미 고유한 정보를 담고 있으므로 이를 해싱
    data_fingerprint = hashlib.md5(data_summary.encode('utf-8')).hexdigest()
    
    # 4-1. 캐시 조회
    from models import AIAnalysis
    cached_analysis = db.query(AIAnalysis).filter(
        AIAnalysis.member_id == current_user.id,
        AIAnalysis.data_hash == data_fingerprint
    ).order_by(AIAnalysis.created_at.desc()).first()
    
    if cached_analysis:
        print(f"♻️ AI Analysis Cache Hit! (Hash: {data_fingerprint})")
        return AIAnalysisResponse(
            can_analyze=True,
            message="분석이 완료되었습니다! (Cached)",
            summary=cached_analysis.summary,
            strengths=json.loads(cached_analysis.strengths),
            weaknesses=json.loads(cached_analysis.weaknesses),
            advice=cached_analysis.advice,
            radar_chart=json.loads(cached_analysis.radar_chart)
        )

    # 5. Gemini 프롬프트 구성 (Cache Miss 시 실행)
    prompt = f"""
    당신은 크로스핏 전문 AI 코치입니다. 다음 회원의 데이터를 분석하여 JSON 형식으로 응답해주세요.
    
    {data_summary}
    
    반드시 다음 JSON 구조를 따라주세요 (마크다운 없이 순수 JSON만 반환):
    {{
        "summary": "한 줄 요약 (예: 상체 근력이 매우 좋아지고 있어요!)",
        "strengths": ["강점1", "강점2"],
        "weaknesses": ["약점1", "약점2"],
        "advice": "구체적인 조언 한마디",
        "radar_chart": {{
            "근력": 1~100 사이 정수,
            "지구력": 1~100 사이 정수,
            "유연성": 1~100 사이 정수,
            "기술": 1~100 사이 정수,
            "멘탈": 1~100 사이 정수
        }}
    }}
    데이터를 바탕으로 점수(radar_chart)를 합리적으로 추정하세요. 
    """
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)
        
        # JSON 파싱 시도
        import re
        
        text = response.text
        print(f"🔍 AI Raw Response: {text}")

        if not text:
            raise ValueError("AI Response is empty")

        # 코드 블록 제거 (```json ... ```)
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```", "", text)
        result = json.loads(text)
        
        # 6. 결과 DB 저장 (Caching)
        new_analysis = AIAnalysis(
            member_id=current_user.id,
            data_hash=data_fingerprint,
            summary=result.get("summary", ""),
            strengths=json.dumps(result.get("strengths", []), ensure_ascii=False),
            weaknesses=json.dumps(result.get("weaknesses", []), ensure_ascii=False),
            advice=result.get("advice", ""),
            radar_chart=json.dumps(result.get("radar_chart", {"근력": 50, "지구력": 50, "유연성": 50, "기술": 50, "멘탈": 50}), ensure_ascii=False)
        )
        db.add(new_analysis)
        db.commit()
        
        return AIAnalysisResponse(
            can_analyze=True,
            message="분석이 완료되었습니다!",
            summary=result.get("summary", ""),
            strengths=result.get("strengths", []),
            weaknesses=result.get("weaknesses", []),
            advice=result.get("advice", ""),
            radar_chart=result.get("radar_chart", {"근력": 50, "지구력": 50, "유연성": 50, "기술": 50, "멘탈": 50})
        )
        
    except Exception as e:
        print(f"❌ AI Analysis Error: {e}")
        import traceback
        traceback.print_exc()
        # AI 호출 실패 시 캐시된 가장 최신 데이터라도 있으면 그걸 줄 수도 있음 (선택사항)
        return AIAnalysisResponse(
            can_analyze=False,
            message="AI 코치와 연결할 수 없습니다. (gemini-2.5-flash-lite)\\n잠시 후 다시 시도해주세요."
        )

# ✅ [신규] AI WOD 생성 API
@router.post("/generate-wod")
def generate_ai_wod(
    req: WodRequest, 
    current_user: Member = Depends(get_current_user)
):
    try:
        user_prompt = req.prompt
        env = req.environment
        
        # 환경에 따른 제약사항 정의
        env_instruction = ""
        if env == "home":
            env_instruction = (
                "현재 사용자는 [집(Home)]에서 운동 중입니다.\n"
                "- 바벨, 로잉머신, 풀업바, 박스 등 대형 장비가 없다고 가정하세요.\n"
                "- 맨몸 운동(푸시업, 스쿼트, 버피 등)이나 덤벨, 케틀벨을 활용한 운동 위주로 구성하세요.\n"
            )
        else:
            env_instruction = (
                "현재 사용자는 [크로스핏 박스(Box)]에서 운동 중입니다.\n"
                "- 바벨, 로잉머신, 어썰트바이크, 풀업바, 링 등 모든 크로스핏 장비를 활용할 수 있습니다.\n"
            )

        prompt = f"""
        당신은 10년 경력의 크로스핏 헤드 코치입니다.
        사용자의 요청과 장소 상황에 맞춰서 오늘의 WOD(Workout of the Day)를 짜주세요.
        
        [운동 장소 상황]
        {env_instruction}
        
        [사용자 요청]
        "{user_prompt}"
        
        [필수 요구사항]
        1. **데이터 분리**: 
           - 'content' 필드에는 순수하게 운동 동작(동작명, 횟수, 무게 등)만 객체 리스트 형태로 작성하세요.
        2. 운동 동작, 횟수, 무게(lb)를 명확히 명시하세요.
        3. WOD의 제목을 재치있게 지어주세요.
        4. 응답은 **반드시 JSON 형식**으로만 주세요. (마크다운 포맷팅 ```json ``` 없이 순수 JSON 텍스트만)
        5. **실용성**: 선택된 장소 상황({env})에서 불가능한 장비(예: 집에서의 로잉머신)는 절대 포함하지 마세요.
        
        [JSON 구조]
        {{
            "title": "WOD 제목",
            "score_type": "time" (기록이 시간인 경우) 또는 "reps" (기록이 점수/주기인 경우),
            "target_rounds": "5" (Rounds for Time인 경우 라운드 수, 없으면 null),
            "time_cap": "20" (분 단위 Time Cap, 없으면 null),
            "content": [
                {{"movement": "Thrusters", "reps": "21", "weight": "95/65 lb"}},
                {{"movement": "Pull-ups", "reps": "21", "weight": ""}}
            ],
            "comment": "코치의 짧은 한마디 (사용자의 장소 상황에 맞는 격려 포함)"
        }}
        """

        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)
        text = response.text
        print(f"🔍 AI WOD Response: {text}") # ✅ [디버깅] 응답 확인용 로깅 추가
        
        import json
        import re
        
        # JSON 파싱 전처리 (마크다운 코드 블록 제거 및 순수 JSON 추출)
        text = text.strip()
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        if match:
            text = match.group(1)
        else:
            # 매칭되지 않으면 기존 방식대로 청소 시도
            text = re.sub(r"```json\s*", "", text)
            text = re.sub(r"```", "", text)
            
        result = json.loads(text)
        
        return result

    except Exception as e:
        print(f"❌ AI WOD Gen Error: {e}")
        return {
            "title": "AI 생성 실패",
            "score_type": "time",
            "content": "AI가 WOD를 생성하는 도중 오류가 발생했습니다. 다시 시도해주세요.",
            "comment": str(e)
        }

# ✅ [신규] 데일리 리포트 생성 API
from schemas import DailyReportRequest, DailyReportResponse
from models import DietLog

@router.post("/daily-report", response_model=DailyReportResponse)
def generate_daily_report(
    req: DailyReportRequest,
    current_user: Member = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        target_date = req.date
        
        # 1. 식단 기록 조회
        diet_logs = db.query(DietLog).filter(
            DietLog.member_id == current_user.id,
            DietLog.date == target_date
        ).all()
        
        total_calories = 0
        diet_summary = []
        
        for log in diet_logs:
            # 칼로리 합산 (null일 경우 0 처리)
            cal = log.calories or 0
            total_calories += cal
            
            # 탄단지 파싱 (기존 DietLog 모델에는 탄단지 컬럼이 없어서 content 파싱 필요하거나, 
            # 앞서 구현한 DietLog 모델에 탄단지 컬럼이 추가되었는지 확인 필요. 
            # 현재 모델(models.py)에는 탄단지 컬럼이 없으므로 content에서 텍스트로만 전달하거나, 
            # 추후 모델 마이그레이션이 필요함. 여기서는 content 내용을 그대로 전달)
            diet_summary.append(f"- {log.meal_type}: {log.content} ({cal}kcal)")

        diet_context = "\n".join(diet_summary) if diet_summary else "식단 기록 없음"
        
        # 2. 운동 기록 조회 (WOD + 개인운동)
        # 2-1. WOD (날짜 비교 방식 수정: func.date 사용)
        wod_record = db.query(WodRecord).filter(
            WodRecord.member_id == current_user.id,
            func.date(WodRecord.created_at) == target_date
        ).first()
        
        wod_context = "WOD 기록 없음"
        if wod_record:
            wod_title = wod_record.wod.title if wod_record.wod else "Unknown WOD"
            level = "Rx" if wod_record.is_rx else (wod_record.scale_rank or "Scaled")
            wod_context = f"{wod_title} ({level}) - {wod_record.record_value}"

        # 2-2. 개인운동
        # Workout 모델의 date 필드는 String 타입이므로 형변환 주의
        target_date_str = target_date.strftime("%Y-%m-%d")
        workouts = db.query(Workout).filter(
            Workout.member_id == current_user.id,
            Workout.date == target_date_str
        ).all()
        
        workout_context = ""
        if workouts:
            workout_context = "\n".join([f"- {w.workout} ({w.time})" for w in workouts])
        else:
            workout_context = "개인 운동 기록 없음"
            
        # 3. 프롬프트 구성
        prompt = f"""
        당신은 퍼스널 트레이너 AI입니다. 회원의 오늘 하루 운동과 식단을 종합 분석하여 '데일리 리포트'를 작성해주세요.
        
        [회원 정보]
        이름: {current_user.name}
        목표: {current_user.workout_goal or '건강 유지'}
        
        [오늘의 식단]
        총 칼로리: {total_calories}kcal (추정)
        상세:
        {diet_context}
        
        [오늘의 운동]
        WOD: {wod_context}
        개인운동:
        {workout_context}
        
        [요청사항]
        1. **점수(0~100점)**: 운동 강도와 식단 클린함, 영양 밸런스를 고려해 매겨주세요.
           - 운동을 열심히 했고 식단도 좋으면 90점 이상.
           - 운동은 했지만 식단이 부실하거나 과하면 감점.
           - 운동도 안 하고 식단도 엉망이면 낮은 점수.
        2. **한 줄 요약**: 전체적인 하루 평가.
        3. **맞춤 조언**: 부족한 영양소나 내일 운동을 위한 팁.
        
        반드시 JSON 형식으로만 응답해주세요:
        {{
            "score": 85,
            "summary": "오늘 운동 강도는 훌륭했지만 단백질 보충이 조금 부족했네요!",
            "advice": "주무시기 전에 삶은 계란이나 프로틴 쉐이크 한 잔 추천드려요."
        }}
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)
        text = response.text
        
        import json
        import re
        
        # JSON 파싱
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```", "", text)
        
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            # JSON 파싱 실패 시 텍스트에서 추출 시도
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                result = json.loads(match.group(0))
            else:
                raise ValueError("AI 응답이 올바른 JSON 형식이 아닙니다.")
        
        return DailyReportResponse(
            score=result.get("score", 0),
            summary=result.get("summary", "분석 실패"),
            advice=result.get("advice", "다시 시도해주세요.")
        )
        
    except Exception as e:
        print(f"❌ Daily Report Error: {e}")
        return DailyReportResponse(
            score=0,
            summary="분석 중 오류가 발생했습니다.",
            advice=str(e)
        )
