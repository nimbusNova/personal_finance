"""Transactions router - SQLite edition"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Transaction, Account
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/transactions")
async def get_transactions(
    account_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category: Optional[str] = None,
    min_amount: Optional[float] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions with filters"""
    query = db.query(Transaction).join(Account).filter(
        Account.user_id == current_user.id
    )
    
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category:
        query = query.filter(Transaction.category == category)
    if min_amount:
        query = query.filter(Transaction.amount >= min_amount)
    
    transactions = query.order_by(Transaction.date.desc()).all()
    
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions above threshold"""
    start_date = datetime.now() - timedelta(days=days)
    
    query = db.query(Transaction).join(Account).filter(
        Account.user_id == current_user.id,
        Transaction.amount >= threshold,
        Transaction.date >= start_date
    ).order_by(Transaction.date.desc())
    
    transactions = query.all()
    
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
        "days": days,
        "count": len(transactions)
    }