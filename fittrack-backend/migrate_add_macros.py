from sqlalchemy import create_engine, text
from config import settings

# 데이터베이스 연결 설정
SQLALCHEMY_DATABASE_URL = settings.database_url
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def add_macro_columns():
    try:
        with engine.connect() as connection:
            # 1. carbs (탄수화물) 컬럼 추가
            try:
                connection.execute(text("ALTER TABLE diet_logs ADD COLUMN carbs INTEGER DEFAULT NULL"))
                print("✅ 'carbs' column added successfully.")
            except Exception as e:
                print(f"⚠️ 'carbs' column might already exist: {e}")

            # 2. protein (단백질) 컬럼 추가
            try:
                connection.execute(text("ALTER TABLE diet_logs ADD COLUMN protein INTEGER DEFAULT NULL"))
                print("✅ 'protein' column added s                                                                                                                                                                                          uccessfully.")
            except Exception as e:
                print(f"⚠️ 'protein' column might already exist: {e}")

            # 3. fat (지방) 컬럼 추가
            try:
                connection.execute(text("ALTER TABLE diet_logs ADD COLUMN fat INTEGER DEFAULT NULL"))
                print("✅ 'fat' column added successfully.")
            except Exception as e:
                print(f"⚠️ 'fat' column might already exist: {e}")

            connection.commit()
            print("\n🎉 Migration completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    add_macro_columns()
