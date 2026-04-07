import sqlite3

def migrate():
    try:
        conn = sqlite3.connect("fittrack.db")
        cursor = conn.cursor()
        
        # competitions 테이블에 creator_id 컬럼 추가
        try:
            cursor.execute("ALTER TABLE competitions ADD COLUMN creator_id INTEGER REFERENCES members(id)")
            print("Successfully added creator_id column to competitions table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("Column creator_id already exists.")
            else:
                raise e
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
