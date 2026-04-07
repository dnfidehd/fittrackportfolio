from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
# ▼▼▼ [수정] config에서 settings 가져오기
from config import settings

# ▼▼▼ [수정] 하드코딩된 주소 대신 settings 사용
# ▼▼▼ [수정] SQLAlchemy 호환 URL 사용
DATABASE_URL = settings.sqlalchemy_database_url

# PostgreSQL vs SQLite 접속 인자 분기
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
else:  # PostgreSQL - Render 환경 SSL 설정
    connect_args = {"sslmode": "require"}

engine = create_engine(
    DATABASE_URL, 
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()