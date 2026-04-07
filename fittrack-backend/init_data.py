from database import engine, SessionLocal
from models import Base, Gym, Member, Wod, WodRecord, Competition, CompetitionEvent, CompetitionScore, Post, Badge, Comment, MemberBadge
from security import get_password_hash
from datetime import date, datetime, timedelta
import random

def init_db():
    print("🚀 [통합 초기화] 데이터베이스 재구축을 시작합니다...")
    
    # 1. 기존 테이블 싹 지우고 새로 만들기
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # ==========================================
        # 2. 박스(Gym) 및 관리자 생성 (외래 키 제약 때문에 먼저 생성)
        # ==========================================
        print("🏢 박스 2개(강남, 홍대) 생성 중...")
        gym1 = Gym(name="강남 크로스핏", location="서울 강남구")
        gym2 = Gym(name="홍대 크로스핏", location="서울 마포구")
        db.add_all([gym1, gym2])
        db.commit()
        db.refresh(gym1)
        db.refresh(gym2)

        # ==========================================
        # 3. 슈퍼어드민 생성
        # ==========================================
        print("👑 슈퍼어드민 계정 생성 중...")
        superadmin = Member(
            name="총관리자",
            phone="admin",
            hashed_password=get_password_hash("admin"),
            role="superadmin",
            status='활성',
            membership='슈퍼어드민',
            gym_id=None,  # 슈퍼어드민은 특정 체육관에 속하지 않음
            must_change_password=False,
            join_date=date.today()
        )
        db.add(superadmin)
        db.commit()

        print("👤 관리자(강남코치, 홍대코치) 생성 중...")
        admin1 = Member(
            name="강남코치", phone="010-1111-1111", 
            hashed_password=get_password_hash("1234"),
            role="admin", status='활성', membership='관리자', gym_id=gym1.id,
            must_change_password=False,
            join_date=date.today()
        )
        admin2 = Member(
            name="홍대코치", phone="010-2222-2222", 
            hashed_password=get_password_hash("1234"),
            role="admin", status='활성', membership='관리자', gym_id=gym2.id,
            must_change_password=False,
            join_date=date.today()
        )
        db.add_all([admin1, admin2])
        db.commit()

        # ==========================================
        # 4. 테스트용 일반 회원 생성
        # ==========================================
        print("👥 테스트용 일반 회원 20명 생성 중 (비번: 뒷번호 4자리)...")
        test_members = []
        
        # 강남 회원 10명
        for i in range(1, 11):
            phone = f"010-1000-00{i:02d}"
            m = Member(
                name=f"강남회원{i}", phone=phone, 
                hashed_password=get_password_hash(phone.split('-')[-1]),
                role="user", gym_id=gym1.id, membership="무제한 이용권", 
                join_date=date.today(),
                status="활성",
                must_change_password=True,
                crossfit_experience="1년 미만"
            )
            db.add(m)
            test_members.append(m)
            
        # 홍대 회원 10명
        for i in range(1, 11):
            phone = f"010-2000-00{i:02d}"
            m = Member(
                name=f"홍대회원{i}", phone=phone, 
                hashed_password=get_password_hash(phone.split('-')[-1]),
                role="user", gym_id=gym2.id, membership="주3회 이용권", 
                join_date=date.today(),
                status="활성",
                must_change_password=True,
                crossfit_experience="2년"
            )
            db.add(m)
            test_members.append(m)
        
        db.commit()

        # ==========================================
        # 5. 리더보드 채우기용 가짜 회원 30명
        # ==========================================
        print("🤖 리더보드용 가짜 회원 30명 생성 중...")
        last_names = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"]
        first_names = ["서준", "민준", "도윤", "예준", "시우", "하준", "지호", "지유", "서윤", "수아", "하윤", "지안", "서현", "하은", "민서"]
        
        mock_members = []
        for _ in range(30):
            name = random.choice(last_names) + random.choice(first_names)
            phone = f"010-{random.randint(3000,9999)}-{random.randint(1000,9999)}"
            m = Member(
                name=name, phone=phone,
                hashed_password=get_password_hash("0000"),
                role="user", gym_id=gym1.id,
                membership="무제한 이용권", 
                join_date=date.today(),
                status="활성",
                must_change_password=False,
                crossfit_experience="3년 이상"
            )
            db.add(m)
            mock_members.append(m)
        
        db.commit()
        
        all_members = test_members + mock_members
        for m in all_members: db.refresh(m)

        # ==========================================
        # 6. 대회 및 기록 데이터 생성
        # ==========================================
        print("🏆 '제1회 핏트랙 챔피언십' 및 기록 데이터 생성 중...")
        comp = Competition(
            title="제1회 핏트랙 챔피언십 (Winter)",
            start_date=date.today().strftime("%Y-%m-%d"),
            end_date=(date.today() + timedelta(days=7)).strftime("%Y-%m-%d"),
            is_active=True,
            description="총 상금 100만원! 당신의 한계를 시험하세요."
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

        evt1 = CompetitionEvent(competition_id=comp.id, title="Event 1: Fran Speed", description="21-15-9 Thrusters & Pull-ups", score_type="time")
        evt2 = CompetitionEvent(competition_id=comp.id, title="Event 2: Snatch Ladder", description="1RM Snatch", score_type="weight")
        evt3 = CompetitionEvent(competition_id=comp.id, title="Event 3: Box Jump Over", description="Max Reps in 2 mins", score_type="reps")
        db.add_all([evt1, evt2, evt3])
        db.commit()
        db.refresh(evt1); db.refresh(evt2); db.refresh(evt3)

        print("   - 선수 50명의 기록 입력 중...")
        for member in all_members:
            is_rx = random.choice([True, True, True, False])
            
            # Event 1 (Time)
            score_val = f"CAP + {random.randint(1, 30)}" if random.random() < 0.15 else f"0{random.randint(3, 9)}:{random.randint(0, 59):02d}"
            db.add(CompetitionScore(event_id=evt1.id, member_id=member.id, member_name=member.name, score_value=score_val, is_rx=is_rx, tie_break=f"0{random.randint(1,5)}:00"))

            # Event 2 (Weight)
            db.add(CompetitionScore(event_id=evt2.id, member_id=member.id, member_name=member.name, score_value=f"{random.randint(95, 245)}", is_rx=is_rx))

            # Event 3 (Reps)
            db.add(CompetitionScore(event_id=evt3.id, member_id=member.id, member_name=member.name, score_value=f"{random.randint(30, 90)}", is_rx=is_rx))
        db.commit()

        # ==========================================
        # 7. 배지(Badge) 데이터 (✅ 여기가 수정된 부분입니다!)
        # ==========================================
        print("🏅 배지 기초 데이터 생성 중...")
        badges = [
            # title="..." -> name="..." 으로 변경
            # criteria_type="...", criteria_value=... -> criteria="streak_3" 으로 변경
            Badge(name="작심삼일 탈출", description="3일 연속 출석 달성!", icon="🐣", criteria="streak_3"),
            Badge(name="일주일의 기적", description="7일 연속 출석 달성!", icon="🔥", criteria="streak_7"),
            Badge(name="크로스핏 중독자", description="30일 연속 출석 달성!", icon="🏋️", criteria="streak_30"),
            Badge(name="첫 PR 달성", description="자신의 한계를 처음으로 넘었습니다.", icon="🔥", criteria="first_pr"),
        ]
        db.add_all(badges)
        db.commit()

        # ==========================================
        # 8. 커뮤니티 게시글
        # ==========================================
        print("💬 커뮤니티 게시글 샘플 생성 중...")
        sample_posts = [
            ("공지", "🚨 [필독] 2월 운영 시간 변경 안내", "설 연휴 기간 동안 단축 운영합니다.", admin1.id, "강남코치", 150),
            ("공지", "💪 이번 달 챌린지: 런지 1000개", "한 달 동안 누적 1000개 달성 시 선물 증정!", admin1.id, "강남코치", 89),
            ("자유", "오늘 와드 너무 힘드네요 ㅠㅠ", "프란 하다가 토할 뻔...", test_members[0].id, test_members[0].name, 12),
            ("질문", "역도화 추천 부탁드립니다!", "나이키랑 리복 중에 고민 중입니다.", test_members[1].id, test_members[1].name, 34),
            ("장터", "로그 무릎 보호대 팝니다 (미개봉)", "사이즈 미스로 팝니다. 싸게 드려요.", test_members[2].id, test_members[2].name, 5),
            ("자유", "드디어 머슬업 성공했습니다!!", "영상 첨부합니다 ㅎㅎ", test_members[3].id, test_members[3].name, 102),
        ]
        
        for p in sample_posts:
            new_post = Post(
                board_type=p[0], title=p[1], content=p[2], author_id=p[3], author_name=p[4],
                views=p[5], created_at=datetime.now() - timedelta(days=random.randint(0, 5))
            )
            db.add(new_post)
        
        db.commit()

        print("\n✅ 모든 초기화 작업이 완료되었습니다!")

    except Exception as e:
        print(f"❌ 초기화 중 에러 발생: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()