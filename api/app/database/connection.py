"""SQLite database connection and initialization (Phase 1).

Phase 1 uses a local SQLite file. Future phases may support cloud databases.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

Base = declarative_base()
_engine = None
_session_maker = None


def get_engine():
    """Get or create SQLite engine"""
    global _engine
    if _engine is None:
        settings = get_settings()
        # Ensure data directory exists
        os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
        # Create SQLite engine
        _engine = create_engine(
            f"sqlite:///{settings.db_path}",
            connect_args={"check_same_thread": False},
            echo=False
        )
    return _engine


def get_session_maker():
    """Get or create session maker"""
    global _session_maker
    if _session_maker is None:
        _session_maker = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _session_maker


def get_db():
    """Get database session (for dependency injection)"""
    SessionLocal = get_session_maker()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables from SQLAlchemy models"""
    from app.database.models import Base
    Base.metadata.create_all(bind=get_engine())
    print(f"✅ Database initialized at: {get_settings().db_path}")


def get_db_path():
    """Get the database file path"""
    return get_settings().db_path