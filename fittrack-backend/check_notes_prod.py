
import sqlalchemy
from sqlalchemy import create_engine, text
import sys

# 운영 서버 DB 주소 (분석을 위해 .env에서 추출한 정보)
DB_URL = "postgresql://fittrack_db_xkzx_user:qllhkkmsgvy4q5BcctHx291a1rvjYl9K@dpg-d65v6p3nv86c73e0g89g-a.oregon-postgres.render.com/fittrack_db_xkzx"

def check_remote_notes():
    """운영 데이터베이스에서 작성된 메모를 조회하는 스크립트"""
    try:
        engine = create_engine(DB_URL)
        with engine.connect() as connection:
            # 메모가 있는 기록만 조회
            query = text("SELECT member_name, note FROM competition_scores WHERE note IS NOT NULL AND note != ''")
            result = connection.execute(query)
            
            rows = result.fetchall()
            if not rows:
                print("운영 데이터베이스에 저장된 메모가 없습니다.")
                return

            print(f"운영 서버에서 {len(rows)}개의 메모를 찾았습니다:")
            print("-" * 30)
            for row in rows:
                print(f"[{row[0]}]: {row[1]}")
            print("-" * 30)
    except Exception as e:
        print(f"운영 DB 연결 중 오류 발생: {e}")

if __name__ == "__main__":
    check_remote_notes()
