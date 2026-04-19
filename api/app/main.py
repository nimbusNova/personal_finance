"""FastAPI main application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, upload, health, holdings, transactions, suggestions
from app.database.connection import init_db

app = FastAPI(
    title="Personal Finance Portfolio Intelligence API",
    version="0.1.0",
    description="PDF-first portfolio tracking with AI suggestions"
)

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
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(holdings.router, prefix="/api/v1", tags=["holdings"])
app.include_router(transactions.router, prefix="/api/v1", tags=["transactions"])
app.include_router(suggestions.router, prefix="/api/v1", tags=["suggestions"])

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/")
async def root():
    return {"message": "Personal Finance API", "version": "0.1.0"}