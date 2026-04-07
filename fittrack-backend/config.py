# fittrack-backend/config.py
import os
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # .env 파일에서 읽어올 변수들 (대소문자 상관없음)
    secret_key: str
    database_url: str
    gemini_api_key: str
    kakao_api_key: str = ""

    # ✅ [신규] PostgreSQL URL 자동 보정 (Render/Heroku 호환)
    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url and self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return self.database_url

    # 기본값이 있는 설정들
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS 설정 (쉼표로 구분된 문자열)
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://fittrack-gold.vercel.app"
    
    # 환경 설정
    environment: str = "development"
    auto_migrate_on_startup: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS 오리진을 리스트로 반환"""
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if self.frontend_url not in origins:
            origins.append(self.frontend_url)
        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


# 이 settings 객체를 다른 파일에서 가져다 쓰면 됩니다.
settings = Settings()
