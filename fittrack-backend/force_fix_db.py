import sqlite3
import os

DB_FILE = "fittrack.db"
LOG_FILE = "db_fix_log.txt"

def log(msg):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def fix_db():
    if not os.path.exists(DB_FILE):
        log(f"❌ {DB_FILE} not found in {os.getcwd()}")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        log("🔍 Checking columns...")
        cursor.execute("PRAGMA table_info(gyms)")
        cols = [info[1] for info in cursor.fetchall()]
        log(f"   Current columns: {cols}")

        required = {
            "latitude": "FLOAT",
            "longitude": "FLOAT",
            "drop_in_price": "INTEGER DEFAULT 20000",
            "description": "TEXT",
            "drop_in_enabled": "BOOLEAN DEFAULT 1"
        }

        for col, dtype in required.items():
            if col not in cols:
                try:
                    log(f"✨ Adding {col}...")
                    cursor.execute(f"ALTER TABLE gyms ADD COLUMN {col} {dtype}")
                except Exception as e:
                    log(f"   ⚠️ Failed to add {col}: {e}")
            else:
                log(f"   ✅ {col} exists.")
        
        conn.commit()
        log("🎉 Done.")

    except Exception as e:
        log(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_db()
