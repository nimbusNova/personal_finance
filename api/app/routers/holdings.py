"""Holdings router"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime

from app.database.connection import get_supabase_client
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/holdings")
async def get_holdings(
    snapshot_id: Optional[int] = None,
    account_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get holdings - filtered by snapshot or account"""
    client = get_supabase_client()
    
    query = client.table("holdings").select(
        "*, portfolio_snapshots!inner(account_id, accounts!inner(user_id))"
    ).eq("portfolio_snapshots.accounts.user_id", current_user["id"])
    
    if snapshot_id:
        query = query.eq("snapshot_id", snapshot_id)
    if account_id:
        query = query.eq("portfolio_snapshots.account_id", account_id)
    
    result = query.execute()
    return {"holdings": result.data}


@router.get("/holdings/latest")
async def get_latest_holdings(
    current_user: dict = Depends(get_current_user)
):
    """Get most recent holdings across all accounts"""
    client = get_supabase_client()
    
    # Get latest snapshot per account
    result = client.rpc("get_latest_holdings", {"p_user_id": current_user["id"]}).execute()
    
    return {"holdings": result.data}


@router.get("/portfolio/summary")
async def get_portfolio_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get portfolio summary (total AUM, allocation, etc)"""
    client = get_supabase_client()
    
    # Get latest snapshots per account
    result = client.rpc("get_portfolio_summary", {"p_user_id": current_user["id"]}).execute()
    
    return result.data