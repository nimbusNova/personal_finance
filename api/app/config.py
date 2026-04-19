"""Configuration management"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False
    
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    
    # Kimi (Moonshot AI)
    kimi_api_key: str = ""
    kimi_base_url: str = "https://api.moonshot.cn/v1"
    
    # Auth
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # Storage
    storage_bucket: str = "pdfs"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()