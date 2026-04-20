"""Health check router"""
from fastapi import APIRouter
from sqlalchemy import text
from app.database import get_db

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0", "edition": "sqlite"}


@router.get("/health/db")
async def db_health_check():
    """Check database connectivity"""
    try:
        from app.database import get_engine
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            row = result.fetchone()
            if row and row[0] == 1:
                return {"status": "healthy", "db": "connected", "edition": "sqlite"}
            else:
                return {"status": "unhealthy", "db": "error", "error": "Unexpected result"}
    except Exception as e:
        return {"status": "unhealthy", "db": "disconnected", "error": str(e)}