from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
import shutil
import os
import uuid

from database import get_db
from models import Member, DietLog
from schemas import DietLogResponse, DietLogCreate, DietLogUpdate, DietAnalysisResponse
from security import get_current_user
from config import settings
import google.generativeai as genai
import json
import re

router = APIRouter(
    tags=["Diet"]
)

# Gemini API Key 설정
GEMINI_API_KEY = settings.gemini_api_key
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# 0. 식단 사진 AI 분석 (Vision API)
@router.post("/analyze-image", response_model=DietAnalysisResponse)
async def analyze_diet_image(
    file: UploadFile = File(...),
    current_user: Member = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI API Key is not configured.")

    try:
        # 파일 읽기
        image_data = await file.read()
        
        # 모델 설정 (Gemini 2.5 Flash Lite)
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        
        # 프롬프트 구성
        prompt = """
        사용자가 올린 식단 사진을 분석해주세요.
        
        [중요 지침]
        - 탄수화물, 단백질, 지방 함량은 가능한 **보수적으로(적게)** 추정해주세요.
        - 눈대중으로 과대평가되지 않도록 주의하세요. 특히 소스나 조리법에 숨겨진 칼로리를 너무 높게 잡지 마세요.
        
        출력은 반드시 다음과 같은 JSON 형식으로만 해주세요 (마크다운 없이 순수 JSON):
        {
          "menu_name": "메뉴 이름 (예: 닭가슴살 샐러드)",
          "calories": 예상 칼로리 정수 (예: 450),
          "carbs": 예상 탄수화물 g수 (예: 30),
          "protein": 예상 단백질 g수 (예: 40),
          "fat": 예상 지방 g수 (예: 15),
          "comment": "코치로서의 짧은 피드백. 탄단지 비율을 고려해서 칭찬하거나 보완할 점을 한 문장으로 (예: 단백질이 훌륭하네요! 다음엔 탄수화물을 조금만 줄여보세요.)"
        }
        한국어로 답변해주세요.
        """
        
        # 분석 요청
        # byte 데이터를 직접 전달할 때의 형식: {'mime_type': '...', 'data': ...}
        response = model.generate_content([
            prompt,
            {'mime_type': file.content_type, 'data': image_data}
        ])
        
        text = response.text
        # JSON 파싱 (마크다운 코드 블록 제거)
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```", "", text)
        result = json.loads(text.strip())
        
        return result

    except Exception as e:
        print(f"❌ Diet AI Error: {e}")
        raise HTTPException(status_code=500, detail="식단 분석 중 오류가 발생했습니다.")

UPLOAD_DIR = "uploads" # 이미지 업로드 폴더

# 1. 식단 기록 조회 (특정 날짜)
@router.get("/", response_model=List[DietLogResponse])
def get_diet_logs(
    date_str: str, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    logs = db.query(DietLog).filter(
        DietLog.member_id == current_user.id,
        DietLog.date == target_date
    ).all()
    
    return logs


@router.get("/recent", response_model=List[DietLogResponse])
def get_recent_diet_logs(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    if days <= 0 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    start_date = date.today() - timedelta(days=days - 1)
    logs = db.query(DietLog).filter(
        DietLog.member_id == current_user.id,
        DietLog.date >= start_date
    ).order_by(DietLog.date.desc(), DietLog.created_at.desc()).all()

    return logs

# 2. 식단 기록 추가 (이미지 포함 가능)
@router.post("/", response_model=DietLogResponse)
def create_diet_log(
    date_str: str = Form(..., alias="date"),
    meal_type: str = Form(...),
    content: str = Form(...),
    calories: Optional[int] = Form(None),
    carbs: Optional[int] = Form(None),
    protein: Optional[int] = Form(None),
    fat: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    image_url = None
    if file:
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"/uploads/{filename}"

    try:
        date_obj = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    new_log = DietLog(
        member_id=current_user.id,
        date=date_obj,
        meal_type=meal_type,
        content=content,
        calories=calories,
        carbs=carbs,
        protein=protein,
        fat=fat,
        image_url=image_url
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

# 3. 식단 기록 수정
@router.put("/{log_id}", response_model=DietLogResponse)
def update_diet_log(
    log_id: int,
    date_str: Optional[str] = Form(None, alias="date"),
    meal_type: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    calories: Optional[int] = Form(None),
    carbs: Optional[int] = Form(None),
    protein: Optional[int] = Form(None),
    fat: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    delete_image: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    log = db.query(DietLog).filter(DietLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Diet log not found")
    
    if log.member_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    if date_str:
        try:
            log.date = date.fromisoformat(date_str)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if meal_type:
        log.meal_type = meal_type
    if content:
        log.content = content
    if calories is not None:
        log.calories = calories
    if carbs is not None:
        log.carbs = carbs
    if protein is not None:
        log.protein = protein
    if fat is not None:
        log.fat = fat
        
    if delete_image:
        if log.image_url:
            try:
                # 파일 삭제 (선택 사항)
                old_path = log.image_url.lstrip("/")
                if os.path.exists(old_path):
                    os.remove(old_path)
            except:
                pass
            log.image_url = None
            
    if file:
        # 기존 이미지 삭제
        if log.image_url:
             try:
                old_path = log.image_url.lstrip("/")
                if os.path.exists(old_path):
                    os.remove(old_path)
             except:
                pass
                
        filename = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        log.image_url = f"/uploads/{filename}"

    db.commit()
    db.refresh(log)
    return log

# 4. 식단 기록 삭제
@router.delete("/{log_id}")
def delete_diet_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user)
):
    log = db.query(DietLog).filter(DietLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Diet log not found")
    
    if log.member_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    if log.image_url:
        try:
            file_path = log.image_url.lstrip("/")
            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
            
    db.delete(log)
    db.commit()
    return {"message": "Deleted successfully"}
