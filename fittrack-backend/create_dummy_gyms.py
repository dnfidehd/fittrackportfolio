from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

# DB 세션 생성
db = SessionLocal()

def create_dummy_gyms():
    # 기존 데이터 확인
    existing = db.query(models.Gym).count()
    if existing > 1:
        print("이미 체육관 데이터가 존재합니다.")
        return

    gyms = [
        {
            "name": "크로스핏 강남",
            "location": "서울 강남구 테헤란로 123",
            "latitude": 37.4979,
            "longitude": 127.0276,
            "drop_in_price": 25000,
            "description": "강남 최대 규모, 최신 장비 완비! 샤워실 및 주차 가능.",
            "drop_in_enabled": True
        },
        {
            "name": "크로스핏 홍대",
            "location": "서울 마포구 양화로 156",
            "latitude": 37.5563,
            "longitude": 126.9224,
            "drop_in_price": 20000,
            "description": "젊음의 거리 홍대! 열정 넘치는 코치진과 함께하세요.",
            "drop_in_enabled": True
        },
        {
            "name": "크로스핏 여의도",
            "location": "서울 영등포구 여의대로 108",
            "latitude": 37.5259,
            "longitude": 126.9242,
            "drop_in_price": 30000,
            "description": "직장인을 위한 점심/저녁 클래스 다수 보유. 쾌적한 환경.",
            "drop_in_enabled": True
        },
        {
            "name": "크로스핏 성수",
            "location": "서울 성동구 아차산로 100",
            "latitude": 37.5445,
            "longitude": 127.0560,
            "drop_in_price": 22000,
            "description": "힙한 성수동에서 즐기는 고강도 운동! 초보자 환영.",
            "drop_in_enabled": True
        },
        {
            "name": "크로스핏 판교",
            "location": "경기 성남시 분당구 판교역로 160",
            "latitude": 37.3947,
            "longitude": 127.1112,
            "drop_in_price": 28000,
            "description": "판교 테크노밸리 중심. 넓은 공간과 다양한 기구.",
            "drop_in_enabled": True
        }
    ]

    for gym_data in gyms:
        gym = models.Gym(**gym_data)
        db.add(gym)
    
    db.commit()
    print("✅ 더미 체육관 데이터 생성 완료!")

if __name__ == "__main__":
    create_dummy_gyms()
