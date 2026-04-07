from database import SessionLocal
from models import Member
from security import get_password_hash
import sys

def change_password(username, new_password):
    db = SessionLocal()
    try:
        user = db.query(Member).filter(Member.phone == username).first()
        if not user:
            print(f"❌ 사용자 '{username}'를 찾을 수 없습니다.")
            return

        user.hashed_password = get_password_hash(new_password)
        # 만약 must_change_password가 True였다면 False로 변경
        user.must_change_password = False 
        db.commit()
        print(f"✅ '{username}'의 비밀번호가 성공적으로 변경되었습니다.")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python change_password.py [아이디] [새비밀번호]")
        print("예시: python change_password.py admin new_secure_password_123")
    else:
        username = sys.argv[1]
        new_pw = sys.argv[2]
        change_password(username, new_pw)
