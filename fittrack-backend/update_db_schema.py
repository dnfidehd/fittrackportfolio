import sqlite3
import os

DB_PATH = "fittrack.db"

def add_column_if_not_exists(cursor, table_name, column_name, column_type, default_value):
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} DEFAULT {default_value}")
        print(f"✅ Added column '{column_name}' to '{table_name}'")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"ℹ️ Column '{column_name}' already exists in '{table_name}'")
        else:
            print(f"❌ Failed to add column '{column_name}': {e}")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database file '{DB_PATH}' not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🚀 Starting database migration...")

    # Competitions table updates
    add_column_if_not_exists(cursor, "competitions", "is_private", "BOOLEAN", 0)
    add_column_if_not_exists(cursor, "competitions", "show_leaderboard_to_all", "BOOLEAN", 1)
    add_column_if_not_exists(cursor, "competitions", "show_wod_to_all", "BOOLEAN", 1)
    add_column_if_not_exists(cursor, "competitions", "anonymize_for_all", "BOOLEAN", 0)

    # Check/Create competition_gyms table (just to be safe, though create_all might have handled it if table was missing)
    # SQLAlchemy's create_all handles table creation, so we might not need this if the server restarted.
    # But let's implicitly rely on create_all for new tables, and focus this script on ALTER.

    conn.commit()
    conn.close()
    print("✨ Migration finished.")

if __name__ == "__main__":
    migrate()
