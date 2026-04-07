
from database import SessionLocal
from models import Member
from security import get_password_hash

def update_superadmin():
    db = SessionLocal()
    try:
        # 1. '총관리자' 또는 role='superadmin' 찾기
        superadmin = db.query(Member).filter(Member.role == "superadmin").first()
        
        if not superadmin:
            print("❌ 슈퍼어드민 계정을 찾을 수 없습니다.")
            return

        print(f"✅ 슈퍼어드민({superadmin.name}) 계정을 발견했습니다. 업데이트 중...")
        
        # 2. 정보 업데이트
        # 기존 phone(010-0000-0000) -> 'admin'
        # 기존 pw -> 'admin' (해시)
        superadmin.phone = "admin"
        superadmin.hashed_password = get_password_hash("admin")
        
        db.commit()
        print("🎉 업데이트 완료! 이제 ID: admin / PW: admin 으로 로그인할 수 있습니다.")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_superadmin()
