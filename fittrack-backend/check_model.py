import google.generativeai as genai
import os
from dotenv import load_dotenv

# .env 파일에서 키 로딩
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ .env 파일에서 GEMINI_API_KEY를 찾을 수 없습니다.")
else:
    print(f"🔑 API Key 확인됨: {api_key[:5]}...")
    
    try:
        genai.configure(api_key=api_key)
        
        print("\n📋 --- 사용 가능한 모델 목록 ---")
        found = False
        for m in genai.list_models():
            # 텍스트 생성이 가능한 모델만 출력
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
                found = True
        
        if not found:
            print("⚠️ 텍스트 생성이 가능한 모델을 찾지 못했습니다. API 키 권한을 확인해보세요.")
            
    except Exception as e:
        print(f"❌ 에러 발생: {e}")