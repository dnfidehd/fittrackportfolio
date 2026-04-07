import sqlite3
import os

DB_PATH = "fittrack.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database file '{DB_PATH}' not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🚀 Starting migration to remove unique constraint on phone...")

    try:
        # 1. SQL 텍스트 복사 (idx_members_phone 이 unique index 일 수 있으므로 확인 후 재생성)
        # SQLite에서 unique constraint를 제거하는 가장 안전한 방법은 인덱스를 제거하는 것입니다.
        # members 테이블 자체가 unique를 가질 수도 있고, create index 시 unique 로 생성되었을 수도 있습니다.
        
        # 기본적으로 SQLAlchemy는 Column(unique=True, index=True)를 할 때 CREATE UNIQUE INDEX 를 만듭니다.
        # 인덱스 목록 확인
        cursor.execute("PRAGMA index_list('members');")
        indexes = cursor.fetchall()
        
        phone_index_name = None
        for idx in indexes:
            # idx: (seq, name, unique, origin, partial)
            # e.g. (0, 'ix_members_phone', 1, 'c', 0)
            idx_name = idx[1]
            if 'phone' in idx_name:
                phone_index_name = idx_name
                break
                
        if phone_index_name:
            print(f"Dropping index {phone_index_name}...")
            cursor.execute(f"DROP INDEX IF EXISTS {phone_index_name};")
            
            # 일반 인덱스로 다시 생성 (unique 없이)
            print("Creating non-unique index for phone...")
            cursor.execute("CREATE INDEX ix_members_phone ON members (phone);")
            print("✅ Successfully removed unique constraint from phone column!")
        else:
            print("ℹ️ Phone index not found.")

        conn.commit()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
