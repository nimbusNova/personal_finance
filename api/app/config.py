"""Configuration for Phase 1 local SQLite deployment.

Phase 1 defaults to a local SQLite database and local file storage.
Cloud deployment (PostgreSQL, S3, etc.) is planned for Phase 2.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False
    
    # Paths (local storage) - use absolute paths for CI/CD
    data_dir: str = os.path.join(os.getcwd(), "data")
    db_path: str = os.path.join(os.getcwd(), "data", "personal_finance.db")
    pdf_storage_path: str = os.path.join(os.getcwd(), "data", "pdfs")
    exports_path: str = os.path.join(os.getcwd(), "data", "exports")
    
    # Kimi (Moonshot AI)
    kimi_api_key: str = ""
    kimi_base_url: str = "https://api.moonshot.cn/v1"
    kimi_model: str = "kimi-k2.5"
    
    # Auth
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # Allow extra fields for forward compatibility
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
