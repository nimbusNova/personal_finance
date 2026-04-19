"""Database connection and initialization"""
from supabase import create_client, Client
from app.config import get_settings

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key or settings.supabase_key
        )
    return _supabase_client


def get_supabase_admin() -> Client:
    """Get admin client for storage operations"""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def init_db():
    """Initialize database - create tables if they don't exist"""
    # Tables are created via Supabase dashboard or migrations
    # This is a placeholder for future Alembic integration
    pass