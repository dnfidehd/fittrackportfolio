import os
import requests
from dotenv import load_dotenv

# .env 로드
load_dotenv("/Users/pansoo/Desktop/fittrack/fittrack-backend/.env")

kakao_key = os.getenv("KAKAO_API_KEY")
print(f"Loaded Key: {kakao_key[:5]}..." if kakao_key else "Key NOT loaded")

if not kakao_key:
    print("Error: KAKAO_API_KEY not found in .env")
    exit(1)

url = "https://dapi.kakao.com/v2/local/search/address.json"
headers = {"Authorization": f"KakaoAK {kakao_key}"}
params = {"query": "서울시청"}

try:
    print(f"Requesting URL: {url}")
    print(f"Headers: {headers}")
    response = requests.get(url, params=params, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
