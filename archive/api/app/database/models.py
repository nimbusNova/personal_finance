"""SQLAlchemy models matching the ERD"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, 
    ForeignKey, JSON, Numeric, create_engine, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50))  # brokerage, bank, credit_card
    logo_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    accounts = relationship("Account", back_populates="institution")


class Account(Base):
    __tablename__ = "accounts"
    
    __table_args__ = (
        UniqueConstraint('institution_id', 'name', name='uix_account_institution_name'),
    )
    
    id = Column(Integer, primary_key=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    name = Column(String(100), nullable=False)
    account_type = Column(String(50))  # 401k, IRA, taxable, checking, etc
    account_number_masked = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    institution = relationship("Institution", back_populates="accounts")
    pdfs = relationship("PDF", back_populates="account")
    snapshots = relationship("PortfolioSnapshot", back_populates="account")
    balances = relationship("AccountBalance", back_populates="account", order_by="AccountBalance.created_at.desc()")


class LifeStageProfile(Base):
    __tablename__ = "life_stage_profiles"
    
    id = Column(Integer, primary_key=True)
    age = Column(Integer)
    annual_income = Column(Numeric(12, 2))
    risk_tolerance = Column(Integer)  # 1-10 scale
    time_horizon_years = Column(Integer)
    goals_json = Column(JSON)  # ["retirement", "house", "education"]
    target_allocation_json = Column(JSON)  # {"us_equity": 60, "intl_equity": 20, ...}
    manifesto_text = Column(Text)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    suggestions = relationship("AISuggestion", back_populates="life_stage_profile")


class PDF(Base):
    __tablename__ = "pdfs"
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # Can be null initially
    original_filename = Column(String(500), nullable=True)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    page_count = Column(Integer)
    doc_type = Column(String(20))  # brokerage, credit_card, bank
    
    # Extraction status
    extraction_status = Column(String(20), default="pending")  # pending, processing, completed, failed, manual_review
    processing_step = Column(String(100))  # Current step description for UI
    extraction_confidence = Column(Float)
    extracted_data = Column(JSON)  # Raw Kimi output
    error_message = Column(Text)
    
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="pdfs")
    portfolio_snapshot = relationship("PortfolioSnapshot", back_populates="pdf", uselist=False)
    transactions = relationship("Transaction", back_populates="pdf")
    manual_corrections = relationship("ManualCorrection", back_populates="pdf")
    extraction_jobs = relationship("ExtractionJob", back_populates="pdf")


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"
    
    id = Column(Integer, primary_key=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    job_type = Column(String(20), nullable=False)  # extraction, reprocessing
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    attempts = Column(Integer, default=0)
    error_details = Column(JSON)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    pdf = relationship("PDF", back_populates="extraction_jobs")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"
    
    id = Column(Integer, primary_key=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    field_name = Column(String(100), nullable=False)  # e.g., "holdings.VTI.quantity"
    original_value = Column(Text)
    corrected_value = Column(Text)
    corrected_by = Column(String(50), default="user")
    correction_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    pdf = relationship("PDF", back_populates="manual_corrections")


class AccountBalance(Base):
    __tablename__ = "account_balances"
    
    __table_args__ = (
        UniqueConstraint('account_id', 'statement_date', name='uix_balance_account_date'),
    )
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"))
    statement_date = Column(DateTime)
    balance = Column(Numeric(15, 2))
    currency = Column(String(3), default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="balances")
    pdf = relationship("PDF")


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    
    __table_args__ = (
        UniqueConstraint('account_id', 'statement_date', name='uix_snapshot_account_date'),
    )
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), unique=True)
    statement_date = Column(DateTime, nullable=False)
    total_value = Column(Numeric(15, 2))
    cash_balance = Column(Numeric(15, 2))
    invested_value = Column(Numeric(15, 2))
    diversity_score = Column(Float)  # 0-100
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="snapshots")
    pdf = relationship("PDF", back_populates="portfolio_snapshot")
    holdings = relationship("Holding", back_populates="snapshot", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"
    
    __table_args__ = (
        UniqueConstraint('snapshot_id', 'symbol', name='uix_holding_snapshot_symbol'),
    )
    
    id = Column(Integer, primary_key=True)
    snapshot_id = Column(Integer, ForeignKey("portfolio_snapshots.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    name = Column(String(200))
    asset_class = Column(String(50))  # equity, bond, commodity, etc
    sector = Column(String(50))
    geography = Column(String(50))  # US, international, emerging, etc
    quantity = Column(Numeric(15, 6))
    price = Column(Numeric(12, 4))
    market_value = Column(Numeric(15, 2))
    cost_basis = Column(Numeric(15, 2))
    unrealized_pnl = Column(Numeric(15, 2))
    weight_pct = Column(Float)
    is_manual_correction = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    snapshot = relationship("PortfolioSnapshot", back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"))
    date = Column(DateTime, nullable=False)
    merchant = Column(String(200))
    category = Column(String(50))
    amount = Column(Numeric(12, 2), nullable=False)
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String(20))  # monthly, yearly, etc
    statement_date = Column(DateTime)
    is_manual_correction = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    pdf = relationship("PDF", back_populates="transactions")


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"
    
    id = Column(Integer, primary_key=True)
    life_stage_profile_id = Column(Integer, ForeignKey("life_stage_profiles.id"))
    suggestion_type = Column(String(50))  # rebalance, buy, sell, diversify, spending
    action_json = Column(JSON)  # { "action": "Sell VTI", "amount": 5000 }
    reasoning_text = Column(Text)
    reasoning_json = Column(JSON)  # Structured reasoning
    confidence_score = Column(Float)  # 0-1
    priority = Column(String(20))  # high, medium, low
    portfolio_context = Column(JSON)  # Holdings snapshot when suggestion made
    user_feedback = Column(String(20))  # accept, reject, snooze, done, null
    user_note = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    life_stage_profile = relationship("LifeStageProfile", back_populates="suggestions")


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"
    
    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    generated_at = Column(DateTime)
    summary_text = Column(Text)
    metrics_json = Column(JSON)  # { "net_worth_change": 5000, "allocation_drift": {...} }
    suggestions_count = Column(Integer)
    status = Column(String(20), default="pending")  # pending, generating, completed, failed
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)