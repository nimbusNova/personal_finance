"""Database initialization script
Run this to create the SQLite database and tables
"""
from app.database import init_db

if __name__ == "__main__":
    print("🚀 Initializing Personal Finance database...")
    init_db()
    print("✅ Database ready!")
