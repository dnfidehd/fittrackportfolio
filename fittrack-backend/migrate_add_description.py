import sqlite3
import os

def migrate():
    # 데이터베이스 파일 경로 (로컬 개발 환경 기준)
    db_path = "fittrack.db"
    
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. description 컬럼 추가
        print("Checking for 'description' column in 'wods' table...")
        cursor.execute("PRAGMA table_info(wods)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'description' not in columns:
            print("Adding 'description' column to 'wods' table...")
            cursor.execute("ALTER TABLE wods ADD COLUMN description TEXT")
            print("Successfully added 'description' column.")
        else:
            print("'description' column already exists.")

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"An error occurred during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
