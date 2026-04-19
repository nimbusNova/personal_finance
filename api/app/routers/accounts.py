"""Accounts router — list all user accounts with latest balances."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Account, Institution, AccountBalance, PDF
from app.routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("api.accounts")


@router.get("/accounts")
async def get_accounts(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all accounts for the current user with latest balances."""
    logger.debug(f"Get accounts: user={current_user.email}")

    accounts = (
        db.query(Account, Institution)
        .join(Institution, Account.institution_id == Institution.id)
        .filter(Account.user_id == current_user.id)
        .all()
    )

    result = []
    for account, institution in accounts:
        # Latest balance (by statement date, not upload time)
        latest_balance = (
            db.query(AccountBalance)
            .filter(AccountBalance.account_id == account.id)
            .order_by(AccountBalance.statement_date.desc())
            .first()
        )

        # PDF count for this account
        pdf_count = (
            db.query(func.count(PDF.id))
            .filter(PDF.account_id == account.id)
            .scalar()
        )

        result.append({
            "id": account.id,
            "name": account.name,
            "type": account.account_type,
            "account_number_masked": account.account_number_masked,
            "is_active": account.is_active,
            "institution": {
                "id": institution.id,
                "name": institution.name,
                "type": institution.type,
            },
            "balance": float(latest_balance.balance) if latest_balance and latest_balance.balance is not None else None,
            "statement_date": latest_balance.statement_date.isoformat() if latest_balance and latest_balance.statement_date else None,
            "pdf_count": pdf_count,
            "created_at": account.created_at.isoformat() if account.created_at else None,
        })

    logger.info(f"Get accounts returned: {len(result)} records for user={current_user.email}")
    return {"accounts": result}
