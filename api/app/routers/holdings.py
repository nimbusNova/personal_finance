"""Holdings router - SQLite edition"""
from fastapi import APIRouter, Depends
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Holding, PortfolioSnapshot, Account
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/holdings")
async def get_holdings(
    snapshot_id: Optional[int] = None,
    account_id: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get holdings - filtered by snapshot or account"""
    query = db.query(Holding).join(PortfolioSnapshot).join(Account).filter(
        Account.user_id == current_user.id
    )
    
    if snapshot_id:
        query = query.filter(Holding.snapshot_id == snapshot_id)
    if account_id:
        query = query.filter(PortfolioSnapshot.account_id == account_id)
    
    holdings = query.all()
    
    return {
        "holdings": [
            {
                "id": h.id,
                "snapshot_id": h.snapshot_id,
                "symbol": h.symbol,
                "name": h.name,
                "asset_class": h.asset_class,
                "sector": h.sector,
                "geography": h.geography,
                "quantity": h.quantity,
                "price": h.price,
                "market_value": h.market_value,
                "cost_basis": h.cost_basis,
                "unrealized_pnl": h.unrealized_pnl,
                "weight_pct": h.weight_pct,
                "is_manual_correction": h.is_manual_correction
            }
            for h in holdings
        ]
    }


@router.get("/holdings/latest")
async def get_latest_holdings(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get most recent holdings across all accounts"""
    # Get latest snapshot per account
    latest_snapshots = db.query(
        PortfolioSnapshot.account_id,
        func.max(PortfolioSnapshot.statement_date).label('latest_date')
    ).join(Account).filter(
        Account.user_id == current_user.id
    ).group_by(PortfolioSnapshot.account_id).subquery()
    
    snapshots = db.query(PortfolioSnapshot).join(
        latest_snapshots,
        (PortfolioSnapshot.account_id == latest_snapshots.c.account_id) &
        (PortfolioSnapshot.statement_date == latest_snapshots.c.latest_date)
    ).all()
    
    # Get holdings for these snapshots
    result = []
    for snapshot in snapshots:
        holdings = db.query(Holding).filter(Holding.snapshot_id == snapshot.id).all()
        for h in holdings:
            result.append({
                "id": h.id,
                "account_id": snapshot.account_id,
                "statement_date": snapshot.statement_date,
                "symbol": h.symbol,
                "name": h.name,
                "quantity": h.quantity,
                "market_value": h.market_value
            })
    
    return {"holdings": result}


@router.get("/portfolio/summary")
async def get_portfolio_summary(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get portfolio summary (total AUM, allocation, etc)"""
    # Get latest snapshots per account
    latest_snapshots = db.query(
        PortfolioSnapshot.account_id,
        func.max(PortfolioSnapshot.statement_date).label('latest_date')
    ).join(Account).filter(
        Account.user_id == current_user.id
    ).group_by(PortfolioSnapshot.account_id).subquery()
    
    snapshots = db.query(PortfolioSnapshot).join(
        latest_snapshots,
        (PortfolioSnapshot.account_id == latest_snapshots.c.account_id) &
        (PortfolioSnapshot.statement_date == latest_snapshots.c.latest_date)
    ).all()
    
    # Calculate totals
    total_value = sum(s.total_value for s in snapshots)
    cash_balance = sum(s.cash_balance for s in snapshots)
    invested_value = sum(s.invested_value for s in snapshots)
    
    # Get holdings for allocation
    snapshot_ids = [s.id for s in snapshots]
    holdings = db.query(Holding).filter(Holding.snapshot_id.in_(snapshot_ids)).all()
    
    # Calculate allocation by asset class
    allocation = {}
    for h in holdings:
        asset_class = h.asset_class or "unknown"
        if asset_class not in allocation:
            allocation[asset_class] = 0
        allocation[asset_class] += h.market_value
    
    # Convert to percentages
    if invested_value > 0:
        allocation_pct = {
            k: round(v / invested_value * 100, 2) 
            for k, v in allocation.items()
        }
    else:
        allocation_pct = {}
    
    return {
        "total_value": total_value,
        "cash_balance": cash_balance,
        "invested_value": invested_value,
        "account_count": len(snapshots),
        "allocation": allocation_pct,
        "latest_date": max(s.statement_date for s in snapshots) if snapshots else None
    }