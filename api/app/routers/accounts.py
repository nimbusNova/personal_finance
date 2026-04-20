"""Accounts router — list all accounts with latest balances."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.database.models import Account, Institution, AccountBalance, PDF

router = APIRouter()
logger = logging.getLogger("api.accounts")


@router.get("/accounts")
async def get_accounts(db: Session = Depends(get_db)):
    """Get all accounts with latest balances."""
    logger.debug("Get accounts")

    accounts = (
        db.query(Account, Institution)
        .join(Institution, Account.institution_id == Institution.id)
        .order_by(Account.created_at.desc())
        .all()
    )

    # Deduplicate: keep the newest account per (institution_id, name)
    seen: dict[tuple[int, str], dict] = {}
    for account, institution in accounts:
        key = (account.institution_id, account.name)
        if key not in seen:
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

            seen[key] = {
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
            }

    result = list(seen.values())
    logger.info(f"Get accounts returned: {len(result)} records")
    return {"accounts": result}
