"""Health check router"""
from fastapi import APIRouter
from app.database.connection import get_supabase_client

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}


@router.get("/health/db")
async def db_health_check():
    try:
        client = get_supabase_client()
        # Simple query to test connection
        result = client.table("users").select("count", count="exact").limit(1).execute()
        return {"status": "healthy", "db": "connected", "count": result.count}
    except Exception as e:
        return {"status": "unhealthy", "db": "disconnected", "error": str(e)}