import sys
import os

# 현재 디렉토리를 path에 추가하여 모듈 로드 가능하게 함
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Member
from security import get_password_hash

def change_admin_credentials():
    print("=== 🔐 Fittrack 관리자 계정 변경 ===")
    
    new_id = input("새로운 아이디(전화번호 형식 권장): ").strip()
    new_pw = input("새로운 비밀번호: ").strip()
    confirm_pw = input("비밀번호 확인: ").strip()

    if not new_id or not new_pw:
        print("❌ 아이디와 비밀번호는 비어있을 수 없습니다.")
        return

    if new_pw != confirm_pw:
        print("❌ 비밀번호가 일치하지 않습니다.")
        return

    db = SessionLocal()
    try:
        # 기존 슈퍼어드민 찾기
        admin = db.query(Member).filter(Member.role == "superadmin").first()
        
        if not admin:
            print("❌ 관리자 계정을 찾을 수 없습니다.")
            return

        admin.phone = new_id
        admin.hashed_password = get_password_hash(new_pw)
        
        db.commit()
        print("\n" + "="*40)
        print("🎉 관리자 계정이 성공적으로 변경되었습니다!")
        print(f"✅ 새로운 ID: {new_id}")
        print(f"✅ 새로운 PW: {new_pw}")
        print("="*40)
        print("💡 이제 새 계정으로 로그인해 보세요.")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    change_admin_credentials()
