import sqlite3

# DB 파일 경로
db_path = "fittrack.db"

def add_column():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 컬럼 추가 쿼리 실행
        # SQLite는 IF NOT EXISTS를 컬럼 추가에 지원하지 않으므로, try-except로 처리
        cursor.execute("ALTER TABLE membership_products ADD COLUMN category VARCHAR DEFAULT 'membership'")
        
        conn.commit()
        print("✅ 'category' column added successfully.")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("ℹ️ 'category' column already exists.")
        else:
            print(f"❌ Error adding column: {e}")
            
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
