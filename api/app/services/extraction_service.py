"""PDF extraction pipeline — orchestrates Kimi extraction, validation, and data persistence."""
import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, Optional

from app.database.connection import get_session_maker
from app.database.models import (
    PDF, ExtractionJob, Institution, Account,
    PortfolioSnapshot, Holding, Transaction, User, AccountBalance
)
from app.services.kimi_service import get_kimi_service
from app.logging_config import get_upload_logger

logger = logging.getLogger("api.extraction")

# Validation thresholds
MIN_CONFIDENCE = 0.5
HOLDINGS_VALUE_TOLERANCE = 0.01  # 1%


def _get_db():
    """Get a standalone DB session for background tasks."""
    SessionLocal = get_session_maker()
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def _set_step(db, pdf: PDF, step: str, upload_logger):
    """Update the processing step on the PDF record."""
    pdf.processing_step = step
    db.commit()
    upload_logger.info(f"Step: {step}")


def process_pdf_extraction(pdf_id: int, file_path: str, user_id: int):
    """
    Background task: run full extraction pipeline for a single PDF.
    Creates its own DB session and handles all status transitions.
    """
    db = _get_db()
    job = None
    upload_logger = get_upload_logger(logger, pdf_id)
    try:
        # Fetch PDF and create ExtractionJob
        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
        if not pdf:
            upload_logger.error("Extraction aborted: PDF not found")
            return

        pdf.extraction_status = "processing"
        pdf.processed_at = datetime.utcnow()
        _set_step(db, pdf, "Uploading file to Kimi", upload_logger)

        job = ExtractionJob(
            pdf_id=pdf_id,
            job_type="extraction",
            status="running",
            started_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()

        upload_logger.info(f"Starting 3-stage extraction pipeline: file={file_path}")

        # Call Kimi (3-stage pipeline internally)
        try:
            _set_step(db, pdf, "Stage 1/3: Classifying document", upload_logger)
            service = get_kimi_service()
            result = service.extract_from_pdf(file_path, upload_id=pdf_id)
        except Exception as exc:
            upload_logger.error(f"Kimi extraction failed: {exc}", exc_info=True)
            _mark_failed(db, pdf, job, f"Kimi extraction error: {exc}", upload_logger)
            return

        if not result.get("success"):
            error_msg = result.get("error", "Unknown extraction error")
            upload_logger.error(f"Kimi returned failure: {error_msg}")
            _mark_failed(db, pdf, job, error_msg, upload_logger)
            return

        extracted = result.get("data", {})
        confidence = result.get("confidence", extracted.get("extraction_confidence", 0.5))

        # Store raw extraction on PDF
        pdf.extracted_data = extracted
        pdf.extraction_confidence = confidence
        pdf.doc_type = extracted.get("doc_type") or pdf.doc_type
        db.commit()

        upload_logger.info(f"Extraction raw data received: doc_type={pdf.doc_type}, confidence={confidence}")

        # Validate
        _set_step(db, pdf, "Validating extracted data", upload_logger)
        validation_errors = _validate_extraction(extracted, pdf.doc_type)
        if validation_errors:
            upload_logger.warning(f"Validation failed: {validation_errors}")
            _mark_failed(db, pdf, job, f"Validation failed: {'; '.join(validation_errors)}", upload_logger)
            return

        # Normalize and persist
        _set_step(db, pdf, "Saving to database", upload_logger)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            upload_logger.error(f"User {user_id} not found during extraction")
            _mark_failed(db, pdf, job, "User not found", upload_logger)
            return

        try:
            _persist_extraction(db, pdf, extracted, user_id, upload_logger)
        except Exception as exc:
            upload_logger.error(f"Data persistence failed: {exc}", exc_info=True)
            _mark_failed(db, pdf, job, f"Persistence error: {exc}", upload_logger)
            return

        # Success
        pdf.extraction_status = "completed"
        pdf.processing_step = "Completed"
        db.commit()

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()

        upload_logger.info("Extraction completed successfully")

    except Exception as exc:
        upload_logger.error(f"Unexpected error during extraction: {exc}", exc_info=True)
        try:
            if pdf:
                pdf.extraction_status = "failed"
                pdf.processing_step = f"Failed: {str(exc)[:100]}"
                pdf.error_message = str(exc)[:500]
                db.commit()
            if job:
                job.status = "failed"
                job.error_details = {"error": str(exc)}
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _mark_failed(db, pdf, job, message: str, upload_logger):
    """Mark PDF and job as failed."""
    pdf.extraction_status = "failed"
    pdf.processing_step = f"Failed: {message[:200]}"
    pdf.error_message = message[:500]
    db.commit()
    if job:
        job.status = "failed"
        job.error_details = {"error": message}
        job.completed_at = datetime.utcnow()
        db.commit()
    upload_logger.info(f"Marked as failed: {message[:200]}")


def _validate_extraction(data: Dict[str, Any], doc_type: Optional[str]) -> list:
    """Validate extracted data. Returns list of error strings (empty if valid)."""
    errors = []

    if not data:
        errors.append("No data extracted")
        return errors

    if doc_type == "brokerage":
        holdings = data.get("holdings", [])
        total_value = data.get("total_value")
        cash = data.get("cash", {})
        settled_cash = cash.get("settled_cash", 0) if isinstance(cash, dict) else 0

        if not holdings:
            errors.append("No holdings found")
        if total_value is None:
            errors.append("Missing total_value")

        # Sum holdings and compare to total
        if holdings and total_value:
            holdings_sum = sum(h.get("market_value", 0) or 0 for h in holdings)
            expected_total = holdings_sum + settled_cash
            if total_value > 0 and abs(expected_total - total_value) / total_value > HOLDINGS_VALUE_TOLERANCE:
                errors.append(
                    f"Holdings sum ({expected_total}) != total_value ({total_value})"
                )

        # Check for negative quantities
        for h in holdings:
            qty = h.get("quantity")
            if qty is not None and qty < 0:
                errors.append(f"Negative quantity for {h.get('symbol', '?')}")

    elif doc_type in ("credit_card", "bank"):
        transactions = data.get("transactions", [])
        # For bank statements, allow empty transactions if there are balances
        # (some accounts are sweep accounts with no direct transactions)
        if doc_type == "credit_card" and not transactions:
            errors.append("No transactions found")
        elif doc_type == "bank":
            balances = data.get("balances", {})
            beginning = data.get("beginning_balance")
            ending = data.get("ending_balance")
            has_balance = (
                beginning is not None or ending is not None
                or (isinstance(balances, dict) and (balances.get("beginning_balance") or balances.get("ending_balance")))
            )
            if not transactions and not has_balance:
                errors.append("No transactions or balances found")

    return errors


def _persist_extraction(db, pdf: PDF, data: Dict[str, Any], user_id: int, upload_logger):
    """Persist validated extraction data into relational tables."""
    doc_type = data.get("doc_type", pdf.doc_type)
    institution_name = data.get("institution", "Unknown")
    account_type = data.get("account_type") or data.get("account_name") or (data.get("account_number", "")[-4:] if data.get("account_number") else None) or (doc_type.title() + " Account" if doc_type else "Unknown Account")

    # Find or create Institution
    institution = db.query(Institution).filter(Institution.name == institution_name).first()
    if not institution:
        institution = Institution(
            name=institution_name,
            type=doc_type or "unknown"
        )
        db.add(institution)
        db.commit()
        db.refresh(institution)
        upload_logger.info(f"Created institution: {institution_name} (id={institution.id})")

    # Find or create Account
    # First try exact name match
    account = db.query(Account).filter(
        Account.user_id == user_id,
        Account.institution_id == institution.id,
        Account.name == account_type
    ).first()

    # If no match and we have an account number, try matching by masked number
    if not account and data.get("account_number"):
        masked = data["account_number"][-4:] if len(data["account_number"]) >= 4 else data["account_number"]
        account = db.query(Account).filter(
            Account.user_id == user_id,
            Account.institution_id == institution.id,
            Account.account_number_masked == masked
        ).first()
        if account:
            upload_logger.info(f"Matched existing account by account number: {account.name} (id={account.id})")

    if not account:
        account = Account(
            user_id=user_id,
            institution_id=institution.id,
            name=account_type,
            account_type=doc_type or "unknown",
            account_number_masked=(data.get("account_number", "")[-4:] if data.get("account_number") else None),
            is_active=True
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        upload_logger.info(f"Created account: {account_type} (id={account.id})")

    # Link PDF to account if not already linked
    if pdf.account_id is None:
        pdf.account_id = account.id
        db.commit()

    # Upsert: delete old data for same account + statement_date before inserting new
    statement_date = _parse_date(data.get("statement_date"))
    if statement_date:
        _clear_existing_data(db, account, doc_type, statement_date, pdf.id, upload_logger)

    if doc_type == "brokerage":
        _persist_brokerage(db, pdf, account, data, upload_logger)
    elif doc_type == "credit_card":
        _persist_credit_card(db, pdf, account, data, upload_logger)
    elif doc_type == "bank":
        _persist_bank(db, pdf, account, data, upload_logger)
    else:
        upload_logger.warning(f"Unknown doc_type '{doc_type}', skipping persistence")


def _clear_existing_data(db, account: Account, doc_type: str, statement_date: datetime, current_pdf_id: int, upload_logger):
    """Delete previously extracted data for the same account + statement_date.
    
    This ensures that re-uploading or retrying a statement replaces rather than duplicates data.
    PDF records are preserved for audit; only the derived relational data is replaced.
    """
    upload_logger.info(f"Clearing existing data for account={account.id}, date={statement_date}, type={doc_type}")

    if doc_type == "brokerage":
        # Find and delete old snapshots (cascade deletes holdings)
        old_snapshots = db.query(PortfolioSnapshot).filter(
            PortfolioSnapshot.account_id == account.id,
            PortfolioSnapshot.statement_date == statement_date
        ).all()
        for old in old_snapshots:
            db.delete(old)
        if old_snapshots:
            upload_logger.info(f"Deleted {len(old_snapshots)} old portfolio snapshots")

    elif doc_type in ("credit_card", "bank"):
        # Delete PDF-derived transactions for this account + statement_date
        # (Preserve manually entered transactions where pdf_id is None)
        deleted_txn_count = db.query(Transaction).filter(
            Transaction.account_id == account.id,
            Transaction.statement_date == statement_date,
            Transaction.pdf_id.isnot(None)
        ).delete(synchronize_session=False)
        upload_logger.info(f"Deleted {deleted_txn_count} old transactions")

    # Delete old account balance for this account + statement_date
    deleted_balance_count = db.query(AccountBalance).filter(
        AccountBalance.account_id == account.id,
        AccountBalance.statement_date == statement_date
    ).delete(synchronize_session=False)
    if deleted_balance_count:
        upload_logger.info(f"Deleted {deleted_balance_count} old account balances")

    db.commit()


def _persist_brokerage(db, pdf: PDF, account: Account, data: Dict[str, Any], upload_logger):
    """Create PortfolioSnapshot and Holdings from brokerage extraction."""
    statement_date_str = data.get("statement_date")
    statement_date = _parse_date(statement_date_str) or datetime.utcnow()

    cash_data = data.get("cash", {})
    if not isinstance(cash_data, dict):
        cash_data = {}
    cash_balance = Decimal(str(cash_data.get("settled_cash", 0) or 0))

    total_value = Decimal(str(data.get("total_value", 0) or 0))
    holdings_list = data.get("holdings", [])
    holdings_value = sum(
        Decimal(str(h.get("market_value", 0) or 0)) for h in holdings_list
    )
    invested_value = holdings_value

    # Create snapshot
    snapshot = PortfolioSnapshot(
        account_id=account.id,
        pdf_id=pdf.id,
        statement_date=statement_date,
        total_value=total_value,
        cash_balance=cash_balance,
        invested_value=invested_value,
        diversity_score=None  # Can be computed later
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    upload_logger.info(f"Created portfolio snapshot: id={snapshot.id}, total={total_value}")

    # Create holdings
    total_mv = sum(
        Decimal(str(h.get("market_value", 0) or 0)) for h in holdings_list
    ) or Decimal("1")

    for h in holdings_list:
        mv = Decimal(str(h.get("market_value", 0) or 0))
        weight = float(mv / total_mv) if total_mv > 0 else 0.0
        holding = Holding(
            snapshot_id=snapshot.id,
            symbol=h.get("symbol", "UNKNOWN"),
            name=h.get("name", ""),
            asset_class=h.get("asset_class", "unknown"),
            sector=h.get("sector"),
            geography=h.get("geography"),
            quantity=Decimal(str(h.get("quantity", 0) or 0)),
            price=Decimal(str(h.get("price", 0) or 0)),
            market_value=mv,
            cost_basis=Decimal(str(h.get("cost_basis", 0) or 0)) if h.get("cost_basis") else None,
            unrealized_pnl=None,
            weight_pct=weight,
            is_manual_correction=False
        )
        db.add(holding)

    db.commit()
    upload_logger.info(f"Created {len(holdings_list)} holdings for snapshot {snapshot.id}")

    # Record account balance
    ab = AccountBalance(
        account_id=account.id,
        pdf_id=pdf.id,
        statement_date=statement_date,
        balance=total_value,
    )
    db.add(ab)
    db.commit()


def _persist_credit_card(db, pdf: PDF, account: Account, data: Dict[str, Any], upload_logger):
    """Create Transactions from credit card extraction."""
    statement_date_str = data.get("statement_date")
    statement_date = _parse_date(statement_date_str)
    transactions = data.get("transactions", [])

    for t in transactions:
        txn = Transaction(
            account_id=account.id,
            pdf_id=pdf.id,
            date=_parse_date(t.get("date")) or statement_date or datetime.utcnow(),
            merchant=t.get("merchant", t.get("description", "Unknown")),
            category=t.get("category", "Other"),
            amount=Decimal(str(t.get("amount", 0) or 0)),
            is_recurring=bool(t.get("is_recurring", False)),
            recurring_frequency=t.get("recurring_frequency"),
            statement_date=statement_date,
            is_manual_correction=False
        )
        db.add(txn)

    db.commit()
    upload_logger.info(f"Created {len(transactions)} credit card transactions")

    # Record account balance (statement balance as liability)
    statement_balance = Decimal(str(data.get("statement_balance", 0) or 0))
    if statement_balance > 0:
        ab = AccountBalance(
            account_id=account.id,
            pdf_id=pdf.id,
            statement_date=statement_date,
            balance=statement_balance,
        )
        db.add(ab)
        db.commit()


def _persist_bank(db, pdf: PDF, account: Account, data: Dict[str, Any], upload_logger):
    """Create Transactions from bank statement extraction."""
    statement_date_str = data.get("statement_date")
    statement_date = _parse_date(statement_date_str)
    transactions = data.get("transactions", [])

    for t in transactions:
        txn = Transaction(
            account_id=account.id,
            pdf_id=pdf.id,
            date=_parse_date(t.get("date")) or statement_date or datetime.utcnow(),
            merchant=t.get("description", t.get("merchant", "Unknown")),
            category=t.get("category", "Other"),
            amount=Decimal(str(t.get("amount", 0) or 0)),
            is_recurring=bool(t.get("is_recurring", False)),
            recurring_frequency=t.get("recurring_frequency"),
            statement_date=statement_date,
            is_manual_correction=False
        )
        db.add(txn)

    db.commit()
    upload_logger.info(f"Created {len(transactions)} bank transactions")

    # Record account balance from ending balance
    balances = data.get("balances", {})
    if not isinstance(balances, dict):
        balances = {}
    ending_balance = Decimal(str(balances.get("ending_balance", 0) or 0))
    if ending_balance > 0 or (balances.get("ending_balance") is not None):
        ab = AccountBalance(
            account_id=account.id,
            pdf_id=pdf.id,
            statement_date=statement_date,
            balance=ending_balance,
        )
        db.add(ab)
        db.commit()


def _parse_date(date_str) -> Optional[datetime]:
    """Parse a date string into datetime. Supports YYYY-MM-DD."""
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str
    try:
        return datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
    except ValueError:
        return None
