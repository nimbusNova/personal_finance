"""Transactions router - SQLite edition"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Transaction, Account
from app.routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("api.transactions")


def _parse_date_str(date_str: Optional[str]) -> Optional[datetime]:
    """Parse YYYY-MM-DD or ISO datetime string to datetime."""
    if not date_str:
        return None
    try:
        if 'T' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None


@router.get("/transactions")
async def get_transactions(
    account_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    min_amount: Optional[float] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions with filters"""
    logger.debug(f"Get transactions: user={current_user.email}, account_id={account_id}, category={category}")
    query = db.query(Transaction).join(Account).filter(
        Account.user_id == current_user.id
    )
    
    parsed_start = _parse_date_str(start_date)
    parsed_end = _parse_date_str(end_date)
    
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if parsed_start:
        query = query.filter(Transaction.date >= parsed_start)
    if parsed_end:
        query = query.filter(Transaction.date <= parsed_end)
    if category:
        query = query.filter(Transaction.category == category)
    if min_amount:
        query = query.filter(Transaction.amount >= min_amount)
    
    transactions = query.order_by(Transaction.date.desc()).all()
    logger.info(f"Get transactions returned: {len(transactions)} records for user={current_user.email}")
    return {
        "transactions": [
            {
                "id": t.id,
                "account_id": t.account_id,
                "date": t.date,
                "merchant": t.merchant,
                "category": t.category,
                "amount": t.amount,
                "is_recurring": t.is_recurring,
                "recurring_frequency": t.recurring_frequency
            }
            for t in transactions
        ]
    }


@router.get("/transactions/summary")
async def get_transactions_summary(
    year: int = Query(...),
    month: int = Query(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get monthly spending summary by category"""
    logger.debug(f"Get transaction summary: user={current_user.email}, year={year}, month={month}")
    # Calculate date range for the month
    from calendar import monthrange
    start_date = datetime(year, month, 1)
    end_day = monthrange(year, month)[1]
    end_date = datetime(year, month, end_day, 23, 59, 59)
    
    # Query transactions in date range
    query = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).join(Account).filter(
        Account.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(Transaction.category)
    
    results = query.all()
    logger.info(f"Transaction summary for {current_user.email}: {len(results)} categories")
    return {
        "summary": [
            {
                "category": r.category,
                "total": r.total,
                "count": r.count
            }
            for r in results
        ],
        "year": year,
        "month": month
    }


@router.get("/transactions/expensive")
async def get_expensive_transactions(
    threshold: float = 200.0,
    days: int = 30,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions above threshold. If year+month provided, filter to that month."""
    logger.debug(f"Get expensive transactions: user={current_user.email}, threshold={threshold}, year={year}, month={month}")
    
    query = db.query(Transaction).join(Account).filter(
        Account.user_id == current_user.id,
        Transaction.amount >= threshold,
    )
    
    if year and month:
        from calendar import monthrange
        start_date = datetime(year, month, 1)
        end_day = monthrange(year, month)[1]
        end_date = datetime(year, month, end_day, 23, 59, 59)
        query = query.filter(Transaction.date >= start_date, Transaction.date <= end_date)
    else:
        start_date = datetime.now() - timedelta(days=days)
        query = query.filter(Transaction.date >= start_date)
    
    transactions = query.order_by(Transaction.date.desc()).all()
    logger.info(f"Expensive transactions for {current_user.email}: {len(transactions)} items")
    return {
        "transactions": [
            {
                "id": t.id,
                "date": t.date,
                "merchant": t.merchant,
                "category": t.category,
                "amount": t.amount
            }
            for t in transactions
        ],
        "threshold": threshold,
        "count": len(transactions)
    }


class TransactionUpdate(BaseModel):
    category: str


@router.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a transaction's category."""
    logger.info(f"Update transaction {transaction_id}: category={update.category} by {current_user.email}")
    
    transaction = db.query(Transaction).join(Account).filter(
        Transaction.id == transaction_id,
        Account.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction.category = update.category
    db.commit()
    db.refresh(transaction)
    
    logger.info(f"Updated transaction {transaction_id} to category={update.category}")
    return {
        "id": transaction.id,
        "category": transaction.category,
        "message": "Category updated"
    }