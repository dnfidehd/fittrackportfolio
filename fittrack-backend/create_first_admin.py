
from database import SessionLocal
from models import Member
from security import get_password_hash
from datetime import date

def create_first_admin():
    db = SessionLocal()
    try:
        # 이미 관리자가 있는지 확인
        admin = db.query(Member).filter(Member.role == "superadmin").first()
        
        if admin:
            print(f"✅ 이미 총관리자({admin.name}) 계정이 존재합니다.")
            print(f"   아이디(전화번호): {admin.phone}")
            return

        print("👑 스테이징 총관리자 계정을 생성합니다...")
        
        new_admin = Member(
            name="총관리자",
            phone="admin",
            hashed_password=get_password_hash("admin"),
            role="superadmin",
            status='활성',
            membership='슈퍼어드민',
            gym_id=None,
            must_change_password=False,
            join_date=date.today()
        )
        
        db.add(new_admin)
        db.commit()
        print("🎉 생성 완료! 이제 아래 정보로 로그인할 수 있습니다.")
        print("   아이디: admin")
        print("   비밀번호: admin")
        print("⚠️ 로그인 후 보안을 위해 비밀번호를 반드시 변경해 주세요.")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_first_admin()
