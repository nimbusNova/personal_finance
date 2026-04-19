"""Transactions router"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime

from app.database.connection import get_supabase_client
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/transactions")
async def get_transactions(
    account_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    min_amount: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get transactions with filters"""
    client = get_supabase_client()
    
    query = client.table("transactions").select(
        "*, accounts!inner(user_id)"
    ).eq("accounts.user_id", current_user["id"])
    
    if account_id:
        query = query.eq("account_id", account_id)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    if category:
        query = query.eq("category", category)
    if min_amount:
        query = query.gte("amount", min_amount)
    
    result = query.order("date", desc=True).execute()
    return {"transactions": result.data}


@router.get("/transactions/summary")
async def get_transactions_summary(
    year: int = Query(...),
    month: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly spending summary by category"""
    client = get_supabase_client()
    
    result = client.rpc("get_spending_by_category", {
        "p_user_id": current_user["id"],
        "p_year": year,
        "p_month": month
    }).execute()
    
    return {"summary": result.data}


@router.get("/transactions/expensive")
async def get_expensive_transactions(
    threshold: float = 200.0,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get transactions above threshold"""
    client = get_supabase_client()
    
    result = client.rpc("get_expensive_items", {
        "p_user_id": current_user["id"],
        "p_threshold": threshold,
        "p_days": days
    }).execute()
    
    return {"transactions": result.data}