"""Holdings router - SQLite edition"""
import logging
from fastapi import APIRouter, Depends
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Holding, PortfolioSnapshot, Account, AccountBalance, Institution
from app.routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("api.holdings")


@router.get("/holdings")
async def get_holdings(
    snapshot_id: Optional[int] = None,
    account_id: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get holdings - filtered by snapshot or account"""
    logger.debug(f"Get holdings: user={current_user.email}, snapshot_id={snapshot_id}, account_id={account_id}")
    query = db.query(Holding).join(PortfolioSnapshot).join(Account).filter(
        Account.user_id == current_user.id
    )
    
    if snapshot_id:
        query = query.filter(Holding.snapshot_id == snapshot_id)
    if account_id:
        query = query.filter(PortfolioSnapshot.account_id == account_id)
    
    holdings = query.all()
    logger.info(f"Get holdings returned: {len(holdings)} records for user={current_user.email}")
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
    """Get portfolio summary (total AUM, allocation, etc) including bank and credit card balances."""
    logger.debug(f"Get portfolio summary: user={current_user.email}")
    # Get latest snapshots per account (brokerage only)
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
    
    # Calculate brokerage totals
    brokerage_total = sum(float(s.total_value or 0) for s in snapshots)
    cash_balance = sum(float(s.cash_balance or 0) for s in snapshots)
    invested_value = sum(float(s.invested_value or 0) for s in snapshots)
    
    # Get holdings for allocation
    snapshot_ids = [s.id for s in snapshots]
    holdings = db.query(Holding).filter(Holding.snapshot_id.in_(snapshot_ids)).all()
    
    # Calculate allocation by asset class (holdings + cash)
    allocation = {}
    for h in holdings:
        asset_class = h.asset_class or "unknown"
        if asset_class not in allocation:
            allocation[asset_class] = 0
        allocation[asset_class] += float(h.market_value or 0)
    
    # Add cash as a separate allocation category
    if cash_balance > 0:
        allocation["cash"] = cash_balance
    
    # Convert to percentages using total_value (invested + cash) as denominator
    if brokerage_total > 0:
        allocation_pct = {
            k: round(v / brokerage_total * 100, 2) 
            for k, v in allocation.items()
        }
    else:
        allocation_pct = {}
    
    # Get all user accounts with latest balances
    accounts = (
        db.query(Account, Institution)
        .join(Institution, Account.institution_id == Institution.id)
        .filter(Account.user_id == current_user.id)
        .all()
    )
    
    bank_total = 0.0
    cc_debt = 0.0
    account_summaries = []
    
    for account, institution in accounts:
        latest_balance = (
            db.query(AccountBalance)
            .filter(AccountBalance.account_id == account.id)
            .order_by(AccountBalance.statement_date.desc())
            .first()
        )
        bal = float(latest_balance.balance) if latest_balance and latest_balance.balance is not None else None
        
        if bal is not None:
            if account.account_type == "bank":
                bank_total += bal
            elif account.account_type == "credit_card":
                cc_debt += bal
        
        account_summaries.append({
            "id": account.id,
            "name": account.name,
            "type": account.account_type,
            "institution": institution.name,
            "balance": bal,
            "statement_date": latest_balance.statement_date.isoformat() if latest_balance and latest_balance.statement_date else None,
        })
    
    total_value = brokerage_total + bank_total - cc_debt
    cash_balance = cash_balance + bank_total
    account_count = len(accounts)
    
    latest_dates = [s.statement_date for s in snapshots]
    for ab in db.query(AccountBalance).join(Account).filter(Account.user_id == current_user.id).all():
        if ab.statement_date:
            latest_dates.append(ab.statement_date)
    
    result = {
        "total_value": total_value,
        "cash_balance": cash_balance,
        "invested_value": invested_value,
        "credit_card_debt": cc_debt,
        "brokerage_total": brokerage_total,
        "bank_total": bank_total,
        "account_count": account_count,
        "allocation": allocation_pct,
        "latest_date": max(latest_dates) if latest_dates else None,
        "accounts": account_summaries,
    }
    logger.info(
        f"Portfolio summary for {current_user.email}: "
        f"total={total_value}, brokerage={brokerage_total}, bank={bank_total}, cc_debt={cc_debt}, accounts={account_count}"
    )
    return result