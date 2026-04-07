
# fittrack-backend/migrate_add_team_wod.py
from database import engine, SessionLocal
from sqlalchemy import text

def migrate():
    print("🚀 [Migration] Adding 'is_team' and 'team_size' to 'wods' table...")
    
    with engine.connect() as conn:
        try:
            # 1. is_team 컬럼 추가 (Boolean, default False -> SQLite에서는 INTEGER 0)
            conn.execute(text("ALTER TABLE wods ADD COLUMN is_team BOOLEAN DEFAULT 0"))
            print("✅ Added 'is_team' column.")
        except Exception as e:
            print(f"⚠️ 'is_team' column might already exist: {e}")

        try:
            # 2. team_size 컬럼 추가 (Integer, nullable)
            conn.execute(text("ALTER TABLE wods ADD COLUMN team_size INTEGER DEFAULT NULL"))
            print("✅ Added 'team_size' column.")
        except Exception as e:
            print(f"⚠️ 'team_size' column might already exist: {e}")
            
        conn.commit()
    
    print("✨ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
