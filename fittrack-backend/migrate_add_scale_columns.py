"""
DB 마이그레이션 스크립트: scale_rank, is_time_cap 컬럼 추가
wod_records 및 competition_scores 테이블에 새 컬럼 추가
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "fittrack.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. wod_records 테이블에 컬럼 추가
    try:
        cursor.execute("ALTER TABLE wod_records ADD COLUMN scale_rank TEXT")
        print("✅ wod_records.scale_rank 컬럼 추가됨")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("ℹ️ wod_records.scale_rank 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ wod_records.scale_rank 오류: {e}")
    
    try:
        cursor.execute("ALTER TABLE wod_records ADD COLUMN is_time_cap INTEGER DEFAULT 0")
        print("✅ wod_records.is_time_cap 컬럼 추가됨")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("ℹ️ wod_records.is_time_cap 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ wod_records.is_time_cap 오류: {e}")

    # 2. competition_scores 테이블에 컬럼 추가
    try:
        cursor.execute("ALTER TABLE competition_scores ADD COLUMN scale_rank TEXT")
        print("✅ competition_scores.scale_rank 컬럼 추가됨")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("ℹ️ competition_scores.scale_rank 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ competition_scores.scale_rank 오류: {e}")
    
    try:
        cursor.execute("ALTER TABLE competition_scores ADD COLUMN is_time_cap INTEGER DEFAULT 0")
        print("✅ competition_scores.is_time_cap 컬럼 추가됨")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("ℹ️ competition_scores.is_time_cap 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ competition_scores.is_time_cap 오류: {e}")
    
    conn.commit()
    conn.close()
    print("\n🎉 마이그레이션 완료!")

if __name__ == "__main__":
    migrate()
