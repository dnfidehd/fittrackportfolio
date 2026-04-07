# fittrack-backend/auto_migrate.py
# 자동 데이터베이스 마이그레이션 스크립트
# SQLite와 PostgreSQL 모두 지원

from database import engine, SessionLocal
from sqlalchemy import text, inspect
from models import Permission
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _pk_column_sql(dialect_name: str) -> str:
    if dialect_name == "sqlite":
        return "INTEGER PRIMARY KEY AUTOINCREMENT"
    return "SERIAL PRIMARY KEY"


def create_default_permissions():
    """
    기본 권한 목록을 생성합니다 (존재하지 않는 경우에만)
    """
    try:
        db = SessionLocal()

        default_permissions = [
            {"name": "members", "display_name": "회원 관리"},
            {"name": "member_sms", "display_name": "회원 문의함"},
            {"name": "classes", "display_name": "수업 관리"},
            {"name": "wods", "display_name": "WOD 관리"},
            {"name": "sales", "display_name": "매출 관리"},
            {"name": "community", "display_name": "커뮤니티"},
            {"name": "competitions", "display_name": "대회 관리"},
            {"name": "dropin", "display_name": "드랍인 관리"},
            {"name": "records", "display_name": "기록 조회"},
            {"name": "notifications", "display_name": "알림 관리"},
            {"name": "settings", "display_name": "환경 설정"},
        ]

        for perm_data in default_permissions:
            existing = db.query(Permission).filter(Permission.name == perm_data["name"]).first()
            if existing:
                # 기존 권한이 있으면 display_name 업데이트
                existing.display_name = perm_data["display_name"]
                db.add(existing)
                logger.info(f"✅ Updated permission: {perm_data['display_name']}")
            else:
                # 새로운 권한 생성
                perm = Permission(name=perm_data["name"], display_name=perm_data["display_name"])
                db.add(perm)
                logger.info(f"✅ Created permission: {perm_data['display_name']}")

        db.commit()
        db.close()
        logger.info("✅ Default permissions initialized")

    except Exception as e:
        logger.error(f"❌ Error creating default permissions: {e}")
        try:
            db.close()
        except:
            pass


def run_auto_migration(raise_on_error: bool = True):
    """
    애플리케이션 시작 시 자동으로 실행되는 마이그레이션
    누락된 컬럼을 안전하게 추가합니다.
    """
    try:
        logger.info("🔄 Starting auto-migration...")
        dialect_name = engine.dialect.name
        
        with engine.connect() as conn:
            inspector = inspect(engine)
            
            # ==========================================
            # 1. WODS 테이블 마이그레이션
            # ==========================================
            if 'wods' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('wods')]
                
                # description 컬럼 추가
                if 'description' not in columns:
                    logger.info("Adding 'description' column to 'wods' table...")
                    conn.execute(text("ALTER TABLE wods ADD COLUMN description TEXT"))
                    conn.commit()
                    logger.info("✅ Successfully added 'description' column")
                else:
                    logger.info("✓ 'description' column already exists")
                
                # is_team 컬럼 추가
                if 'is_team' not in columns:
                    logger.info("Adding 'is_team' column to 'wods' table...")
                    conn.execute(text("ALTER TABLE wods ADD COLUMN is_team BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                    logger.info("✅ Successfully added 'is_team' column")
                else:
                    logger.info("✓ 'is_team' column already exists")
                
                # team_size 컬럼 추가
                if 'team_size' not in columns:
                    logger.info("Adding 'team_size' column to 'wods' table...")
                    conn.execute(text("ALTER TABLE wods ADD COLUMN team_size INTEGER"))
                    conn.commit()
                    logger.info("✅ Successfully added 'team_size' column")
                else:
                    logger.info("✓ 'team_size' column already exists")
            
            # ==========================================
            # 2. GYMS 테이블 마이그레이션
            # ==========================================
            if 'gyms' in inspector.get_table_names():
                gym_columns = [col['name'] for col in inspector.get_columns('gyms')]
                
                # 구독 정보 필드들
                subscription_fields = {
                    'subscription_plan': "VARCHAR DEFAULT 'Standard'",
                    'subscription_start_date': "DATE",
                    'next_billing_date': "DATE",
                    'monthly_fee': "INTEGER DEFAULT 199000",
                    'payment_status': "VARCHAR DEFAULT 'paid'",
                }
                
                for field, field_type in subscription_fields.items():
                    if field not in gym_columns:
                        logger.info(f"Adding '{field}' column to 'gyms' table...")
                        conn.execute(text(f"ALTER TABLE gyms ADD COLUMN {field} {field_type}"))
                        conn.commit()
                        logger.info(f"✅ Successfully added '{field}' column")
                
                # 드랍인 & 지도 정보 필드들
                dropin_fields = {
                    'latitude': "FLOAT",
                    'longitude': "FLOAT",
                    'drop_in_price': "INTEGER DEFAULT 20000",
                    'description': "TEXT",
                    'drop_in_enabled': "BOOLEAN DEFAULT TRUE",
                }
                
                for field, field_type in dropin_fields.items():
                    if field not in gym_columns:
                        logger.info(f"Adding '{field}' column to 'gyms' table...")
                        conn.execute(text(f"ALTER TABLE gyms ADD COLUMN {field} {field_type}"))
                        conn.commit()
                        logger.info(f"✅ Successfully added '{field}' column")
            
            # ==========================================
            # 2-1. MEMBERS 테이블 마이그레이션 (추가)
            # ==========================================
            if 'members' in inspector.get_table_names():
                member_columns = [col['name'] for col in inspector.get_columns('members')]
                
                # 코치 시급 필드
                if 'hourly_wage' not in member_columns:
                    logger.info("Adding 'hourly_wage' column to 'members' table...")
                    conn.execute(text("ALTER TABLE members ADD COLUMN hourly_wage INTEGER DEFAULT 0"))
                    conn.commit()
                    logger.info("✅ Successfully added 'hourly_wage' column")
                    
                # 코치 수업당 급여 필드
                if 'class_wage' not in member_columns:
                    logger.info("Adding 'class_wage' column to 'members' table...")
                    conn.execute(text("ALTER TABLE members ADD COLUMN class_wage INTEGER DEFAULT 0"))
                    conn.commit()
                    logger.info("✅ Successfully added 'class_wage' column")

                # 코치 고유 색상 필드
                if 'color' not in member_columns:
                    logger.info("Adding 'color' column to 'members' table...")
                    conn.execute(text("ALTER TABLE members ADD COLUMN color VARCHAR DEFAULT '#3182F6'"))
                    conn.commit()
                    logger.info("✅ Successfully added 'color' column")
            
            # ==========================================
            # 2-2. WORK_SCHEDULES 테이블 마이그레이션 (추가)
            # ==========================================
            if 'work_schedules' in inspector.get_table_names():
                ws_columns = [col['name'] for col in inspector.get_columns('work_schedules')]
                if 'work_category' not in ws_columns:
                    logger.info("Adding 'work_category' column to 'work_schedules' table...")
                    conn.execute(text("ALTER TABLE work_schedules ADD COLUMN work_category VARCHAR DEFAULT 'general'"))
                    conn.commit()
                    logger.info("✅ Successfully added 'work_category' column")

                if 'created_at' not in ws_columns:
                    logger.info("Adding 'created_at' column to 'work_schedules' table...")
                    conn.execute(text("ALTER TABLE work_schedules ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                    conn.commit()
                    logger.info("✅ Successfully added 'created_at' column")

                if 'updated_at' not in ws_columns:
                    logger.info("Adding 'updated_at' column to 'work_schedules' table...")
                    conn.execute(text("ALTER TABLE work_schedules ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                    conn.commit()
                    logger.info("✅ Successfully added 'updated_at' column")
            
            # ==========================================
            # 3. COMPETITIONS 테이블 마이그레이션
            # ==========================================
            if 'competitions' in inspector.get_table_names():
                comp_columns = [col['name'] for col in inspector.get_columns('competitions')]
                
                # 대회 공개 및 보안 설정 필드들
                competition_fields = {
                    'is_private': "BOOLEAN DEFAULT FALSE",
                    'show_leaderboard_to_all': "BOOLEAN DEFAULT TRUE",
                    'show_wod_to_all': "BOOLEAN DEFAULT TRUE",
                    'anonymize_for_all': "BOOLEAN DEFAULT FALSE",
                    'creator_id': "INTEGER",
                    'sort_order': "INTEGER",
                    'is_hidden': "BOOLEAN DEFAULT FALSE",
                }
                
                for field, field_type in competition_fields.items():
                    if field not in comp_columns:
                        logger.info(f"Adding '{field}' column to 'competitions' table...")
                        conn.execute(text(f"ALTER TABLE competitions ADD COLUMN {field} {field_type}"))
                        conn.commit()
                        logger.info(f"✅ Successfully added '{field}' column")

                # guest_passcode 컬럼 추가 (별도 관리)
                if 'guest_passcode' not in comp_columns:
                    logger.info("Adding 'guest_passcode' column to 'competitions' table...")
                    conn.execute(text("ALTER TABLE competitions ADD COLUMN guest_passcode VARCHAR"))
                    conn.commit()
                    logger.info("✅ Successfully added 'guest_passcode' column")
            
            # ==========================================
            # 4. POSTS 테이블 마이그레이션 (커뮤니티)
            # ==========================================
            if 'posts' in inspector.get_table_names():
                post_columns = [col['name'] for col in inspector.get_columns('posts')]
                
                # region 컬럼 추가
                if 'region' not in post_columns:
                    logger.info("Adding 'region' column to 'posts' table...")
                    # 백엔드 DB 종류에 따라 타입 지정이 다를 수 있으나, 보통 VARCHAR나 TEXT 호환됨
                    conn.execute(text("ALTER TABLE posts ADD COLUMN region VARCHAR"))
                    conn.commit()
                    logger.info("✅ Successfully added 'region' column")

                # is_popup 컬럼 추가
                if 'is_popup' not in post_columns:
                    logger.info("Adding 'is_popup' column to 'posts' table...")
                    conn.execute(text("ALTER TABLE posts ADD COLUMN is_popup BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                    logger.info("✅ Successfully added 'is_popup' column")

                # popup_expires_at 컬럼 추가
                if 'popup_expires_at' not in post_columns:
                    logger.info("Adding 'popup_expires_at' column to 'posts' table...")
                    conn.execute(text("ALTER TABLE posts ADD COLUMN popup_expires_at TIMESTAMP"))
                    conn.commit()
                    logger.info("✅ Successfully added 'popup_expires_at' column")

            # ==========================================
            # 5. DIET_LOGS 테이블 마이그레이션 (탄단지)
            # ==========================================
            if 'diet_logs' in inspector.get_table_names():
                diet_columns = [col['name'] for col in inspector.get_columns('diet_logs')]
                
                # 탄단지 컬럼 추가
                macro_fields = {
                    'carbs': "INTEGER",
                    'protein': "INTEGER",
                    'fat': "INTEGER",
                }
                
                for field, field_type in macro_fields.items():
                    if field not in diet_columns:
                        logger.info(f"Adding '{field}' column to 'diet_logs' table...")
                        conn.execute(text(f"ALTER TABLE diet_logs ADD COLUMN {field} {field_type}"))
                        conn.commit()
                        logger.info(f"✅ Successfully added '{field}' column")

            # ==========================================
            # 6. COMPETITION_SCORES 테이블 마이그레이션 (게스트 정보)
            # ==========================================
            if 'competition_scores' in inspector.get_table_names():
                score_columns = [col['name'] for col in inspector.get_columns('competition_scores')]
                
                guest_fields = {
                    'guest_gender': "VARCHAR", # M/F
                    'guest_phone': "VARCHAR",
                    'guest_gym': "VARCHAR", # ✅ [신규] 게스트 소속 박스
                    'status': "VARCHAR DEFAULT 'approved'", # ✅ [신규] 기록 상태 추가
                }
                
                for field, field_type in guest_fields.items():
                    if field not in score_columns:
                        logger.info(f"Adding '{field}' column to 'competition_scores' table...")
                        conn.execute(text(f"ALTER TABLE competition_scores ADD COLUMN {field} {field_type}"))
                        conn.commit()
                        logger.info(f"✅ Successfully added '{field}' column")
                        
                        # 기존 데이터 일괄 업데이트 (소급 적용)
                        if field == 'status':
                            conn.execute(text("UPDATE competition_scores SET status = 'approved'"))
                            conn.commit()
                            logger.info("✅ Successfully updated existing records to 'approved' status")

            # ==========================================
            # 7. COMPETITIONS 테이블 마이그레이션 (초대 박스 설정 권한)
            # ==========================================
            if 'competitions' in inspector.get_table_names():
                comp_columns = [col['name'] for col in inspector.get_columns('competitions')]

                # ✅ [신규] 초대된 박스 어드민 설정 권한 허용 컬럼
                if 'allow_invited_gym_settings' not in comp_columns:
                    logger.info("Adding 'allow_invited_gym_settings' column to 'competitions' table...")
                    conn.execute(text("ALTER TABLE competitions ADD COLUMN allow_invited_gym_settings BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                    logger.info("✅ Successfully added 'allow_invited_gym_settings' column")

                # ==========================================
            # 8. COMPETITION_EVENTS 테이블 마이그레이션 (신규)
            # ==========================================
            if 'competition_events' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('competition_events')]
                
                # time_cap 컬럼 추가
                if 'time_cap' not in columns:
                    logger.info("Adding 'time_cap' column to 'competition_events' table...")
                    conn.execute(text("ALTER TABLE competition_events ADD COLUMN time_cap INTEGER DEFAULT NULL"))
                    conn.commit()
                    logger.info("✅ Successfully added 'time_cap' column")
                else:
                    logger.info("✓ 'time_cap' column already exists")
                    
                # max_reps 컬럼 추가
                if 'max_reps' not in columns:
                    logger.info("Adding 'max_reps' column to 'competition_events' table...")
                    conn.execute(text("ALTER TABLE competition_events ADD COLUMN max_reps INTEGER DEFAULT NULL"))
                    conn.commit()
                    logger.info("✅ Successfully added 'max_reps' column")
                else:
                    logger.info("✓ 'max_reps' column already exists")

            # ==========================================
            # 9. COACH_PERMISSIONS 테이블 마이그레이션 (gym_id 추가)
            # ==========================================
            if 'coach_permissions' in inspector.get_table_names():
                cp_columns = [col['name'] for col in inspector.get_columns('coach_permissions')]

                # gym_id 컬럼 추가
                if 'gym_id' not in cp_columns:
                    logger.info("Adding 'gym_id' column to 'coach_permissions' table...")
                    conn.execute(text("ALTER TABLE coach_permissions ADD COLUMN gym_id INTEGER"))
                    conn.commit()

                    # 기존 데이터에 gym_id 채우기 (Member 테이블에서 gym_id 조회)
                    conn.execute(text("""
                        UPDATE coach_permissions
                        SET gym_id = (SELECT gym_id FROM members WHERE members.id = coach_permissions.coach_id)
                    """))
                    conn.commit()
                    logger.info("✅ Successfully added 'gym_id' column to coach_permissions")
                else:
                    logger.info("✓ 'gym_id' column already exists")

            # ==========================================
            # 10. COACHING_CLASSES 및 COACHING_CLASS_ASSIGNMENTS 테이블 마이그레이션
            # ==========================================
            if 'coaching_classes' not in inspector.get_table_names():
                logger.info("Creating 'coaching_classes' table...")
                conn.execute(text("""
                    CREATE TABLE coaching_classes (
                        id {coaching_classes_pk},
                        gym_id INTEGER NOT NULL,
                        title VARCHAR NOT NULL,
                        start_time VARCHAR NOT NULL,
                        end_time VARCHAR NOT NULL,
                        days_of_week VARCHAR NOT NULL,
                        max_participants INTEGER DEFAULT 20,
                        description TEXT,
                        color VARCHAR DEFAULT '#3182F6',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (gym_id) REFERENCES gyms(id)
                    )
                """.format(coaching_classes_pk=_pk_column_sql(dialect_name))))
                conn.execute(text("""
                    CREATE INDEX idx_coaching_class_gym_active ON coaching_classes(gym_id, is_active)
                """))
                conn.commit()
                logger.info("✅ Created 'coaching_classes' table")

            if 'coaching_class_assignments' not in inspector.get_table_names():
                logger.info("Creating 'coaching_class_assignments' table...")
                conn.execute(text("""
                    CREATE TABLE coaching_class_assignments (
                        id {coaching_class_assignments_pk},
                        coaching_class_id INTEGER NOT NULL,
                        coach_id INTEGER NOT NULL,
                        date DATE NOT NULL,
                        status VARCHAR DEFAULT 'scheduled',
                        memo TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (coaching_class_id) REFERENCES coaching_classes(id),
                        FOREIGN KEY (coach_id) REFERENCES members(id)
                    )
                """.format(coaching_class_assignments_pk=_pk_column_sql(dialect_name))))
                conn.execute(text("""
                    CREATE INDEX idx_coaching_class_assignment_date_gym ON coaching_class_assignments(date, coaching_class_id)
                """))
                conn.execute(text("""
                    CREATE INDEX idx_coaching_class_assignment_coach_date ON coaching_class_assignments(coach_id, date)
                """))
                conn.commit()
                logger.info("✅ Created 'coaching_class_assignments' table")

            # ==========================================
            # 11. MEMBER_CRM_FOLLOWUPS 테이블 마이그레이션
            # ==========================================
            if 'member_crm_followups' not in inspector.get_table_names():
                logger.info("Creating 'member_crm_followups' table...")
                conn.execute(text("""
                    CREATE TABLE member_crm_followups (
                        id {crm_followups_pk},
                        gym_id INTEGER NOT NULL,
                        member_id INTEGER NOT NULL,
                        trigger_type VARCHAR(50) NOT NULL,
                        status VARCHAR(30) DEFAULT 'pending',
                        note TEXT,
                        contact_method VARCHAR(30),
                        last_contacted_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (gym_id) REFERENCES gyms(id),
                        FOREIGN KEY (member_id) REFERENCES members(id)
                    )
                """.format(crm_followups_pk=_pk_column_sql(dialect_name))))
                conn.execute(text("""
                    CREATE INDEX idx_member_crm_followups_gym_member ON member_crm_followups(gym_id, member_id)
                """))
                conn.execute(text("""
                    CREATE INDEX idx_member_crm_followups_trigger_status ON member_crm_followups(trigger_type, status)
                """))
                conn.commit()
                logger.info("✅ Created 'member_crm_followups' table")

        # ==========================================
        # 기본 권한 생성
        # ==========================================
        create_default_permissions()

        logger.info("✅ Auto-migration completed successfully")
            
    except Exception as e:
        logger.error(f"❌ Error during auto-migration: {e}")
        if raise_on_error:
            raise
        logger.warning("⚠️ Migration failure ignored by configuration")


if __name__ == "__main__":
    # 직접 실행 시 마이그레이션 수행
    run_auto_migration()
