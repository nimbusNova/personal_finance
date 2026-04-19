"""FastAPI main application"""
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, upload, health, holdings, transactions, suggestions, accounts, kimi_files
from app.database.connection import init_db
from app.logging_config import setup_logging
from app.middleware import LoggingMiddleware

# Configure logging before creating the app
LOG_DIR = os.environ.get("PF_LOG_DIR", "logs")
setup_logging(log_dir=LOG_DIR, log_to_file=True)

logger = logging.getLogger("api.main")

app = FastAPI(
    title="Personal Finance Portfolio Intelligence API",
    version="0.1.0",
    description="PDF-first portfolio tracking with AI suggestions"
)

# Request/response logging
app.add_middleware(LoggingMiddleware)

# CORS - allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(holdings.router, prefix="/api/v1", tags=["holdings"])
app.include_router(transactions.router, prefix="/api/v1", tags=["transactions"])
app.include_router(suggestions.router, prefix="/api/v1", tags=["suggestions"])
app.include_router(accounts.router, prefix="/api/v1", tags=["accounts"])
app.include_router(kimi_files.router, prefix="/api/v1", tags=["kimi-files"])

@app.on_event("startup")
async def startup_event():
    logger.info("API starting up...")
    init_db()
    logger.info("Database initialized.")

@app.get("/")
async def root():
    logger.debug("Root endpoint called")
    return {"message": "Personal Finance API", "version": "0.1.0"}
