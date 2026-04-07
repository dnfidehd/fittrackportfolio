from database import SessionLocal
from security import create_access_token
from models import Member
import requests

db = SessionLocal()
superadmin = db.query(Member).filter(Member.role == 'superadmin').first()

if not superadmin:
    print("슈퍼어드민 없음!")
else:
    token = create_access_token(data={"sub": str(superadmin.phone), "gym_id": superadmin.gym_id})
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # PUT 테스트
    payload = {"is_hidden": True}
    res = requests.put("http://localhost:8000/api/competitions/3", json=payload, headers=headers)
    print("STATUS:", res.status_code)
    print("RESPONSE:", res.json())
