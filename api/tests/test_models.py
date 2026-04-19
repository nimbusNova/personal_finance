"""Unit tests for database models"""
import pytest
from datetime import datetime
from app.database.models import (
    User, Institution, Account, LifeStageProfile,
    PDF, PortfolioSnapshot, Holding, Transaction,
    AISuggestion, MonthlyReport
)


@pytest.mark.unit
class TestUserModel:
    """Tests for User model"""
    
    def test_create_user(self, db_session):
        """Test creating a user"""
        user = User(
            email="test@example.com",
            password_hash="hashed_password"
        )
        db_session.add(user)
        db_session.commit()
        
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.created_at is not None
    
    def test_user_unique_email(self, db_session):
        """Test that email must be unique"""
        user1 = User(email="unique@example.com", password_hash="hash1")
        db_session.add(user1)
        db_session.commit()
        
        # Creating duplicate should raise error
        user2 = User(email="unique@example.com", password_hash="hash2")
        db_session.add(user2)
        with pytest.raises(Exception):
            db_session.commit()


@pytest.mark.unit
class TestInstitutionModel:
    """Tests for Institution model"""
    
    def test_create_institution(self, db_session):
        """Test creating an institution"""
        inst = Institution(
            name="Charles Schwab",
            type="brokerage"
        )
        db_session.add(inst)
        db_session.commit()
        
        assert inst.id is not None
        assert inst.name == "Charles Schwab"
        assert inst.type == "brokerage"


@pytest.mark.unit
class TestAccountModel:
    """Tests for Account model"""
    
    def test_create_account(self, db_session):
        """Test creating an account with relationships"""
        # Create dependencies
        user = User(email="user@test.com", password_hash="hash")
        inst = Institution(name="Fidelity", type="brokerage")
        db_session.add_all([user, inst])
        db_session.commit()
        
        # Create account
        account = Account(
            user_id=user.id,
            institution_id=inst.id,
            name="Individual Taxable",
            account_type="taxable",
            account_number_masked="****1234"
        )
        db_session.add(account)
        db_session.commit()
        
        assert account.id is not None
        assert account.user_id == user.id
        assert account.institution_id == inst.id
        assert account.is_active is True


@pytest.mark.unit
class TestPDFModel:
    """Tests for PDF model"""
    
    def test_create_pdf(self, db_session):
        """Test creating a PDF record"""
        pdf = PDF(
            account_id=None,  # Unassigned initially
            file_path="data/pdfs/2024/03/test.pdf",
            file_size=1024000,
            page_count=5,
            doc_type="brokerage",
            extraction_status="pending"
        )
        db_session.add(pdf)
        db_session.commit()
        
        assert pdf.id is not None
        assert pdf.extraction_status == "pending"
        assert pdf.created_at is not None
    
    def test_pdf_extraction_status_transitions(self, db_session):
        """Test PDF status field"""
        pdf = PDF(
            file_path="test.pdf",
            extraction_status="pending"
        )
        db_session.add(pdf)
        db_session.commit()
        
        # Test status transition
        pdf.extraction_status = "completed"
        pdf.extraction_confidence = 0.95
        db_session.commit()
        
        assert pdf.extraction_status == "completed"
        assert pdf.extraction_confidence == 0.95


@pytest.mark.unit
class TestPortfolioSnapshotModel:
    """Tests for PortfolioSnapshot model"""
    
    def test_create_snapshot(self, db_session):
        """Test creating a portfolio snapshot"""
        snapshot = PortfolioSnapshot(
            account_id=1,
            statement_date=datetime(2024, 3, 31),
            total_value=100000.00,
            cash_balance=5000.00,
            invested_value=95000.00,
            diversity_score=75.5
        )
        db_session.add(snapshot)
        db_session.commit()
        
        assert snapshot.id is not None
        assert snapshot.total_value == 100000.00


@pytest.mark.unit
class TestHoldingModel:
    """Tests for Holding model"""
    
    def test_create_holding(self, db_session):
        """Test creating a holding"""
        holding = Holding(
            snapshot_id=1,
            symbol="VTI",
            name="Vanguard Total Stock Market ETF",
            asset_class="equity",
            sector="total_market",
            geography="us",
            quantity=100.0,
            price=250.00,
            market_value=25000.00,
            cost_basis=20000.00,
            unrealized_pnl=5000.00,
            weight_pct=25.0
        )
        db_session.add(holding)
        db_session.commit()
        
        assert holding.id is not None
        assert holding.symbol == "VTI"
        assert holding.market_value == 25000.00


@pytest.mark.unit
class TestTransactionModel:
    """Tests for Transaction model"""
    
    def test_create_transaction(self, db_session):
        """Test creating a transaction"""
        transaction = Transaction(
            account_id=1,
            date=datetime(2024, 3, 15),
            merchant="Whole Foods",
            category="Groceries",
            amount=142.35,
            is_recurring=False
        )
        db_session.add(transaction)
        db_session.commit()
        
        assert transaction.id is not None
        assert transaction.amount == 142.35
        assert transaction.is_recurring is False
    
    def test_recurring_transaction(self, db_session):
        """Test marking a transaction as recurring"""
        transaction = Transaction(
            account_id=1,
            date=datetime(2024, 3, 1),
            merchant="Netflix",
            category="Entertainment",
            amount=15.99,
            is_recurring=True,
            recurring_frequency="monthly"
        )
        db_session.add(transaction)
        db_session.commit()
        
        assert transaction.is_recurring is True
        assert transaction.recurring_frequency == "monthly"


@pytest.mark.unit
class TestAISuggestionModel:
    """Tests for AISuggestion model"""
    
    def test_create_suggestion(self, db_session):
        """Test creating an AI suggestion"""
        suggestion = AISuggestion(
            suggestion_type="rebalance",
            action_json='{"action": "Sell VTI", "amount": 5000}',
            reasoning_text="US equity allocation too high",
            reasoning_json='{"context": "Current 75%, target 60%"}',
            confidence_score=0.85,
            priority="high",
            is_active=True
        )
        db_session.add(suggestion)
        db_session.commit()
        
        assert suggestion.id is not None
        assert suggestion.suggestion_type == "rebalance"
        assert suggestion.confidence_score == 0.85
    
    def test_suggestion_feedback(self, db_session):
        """Test updating suggestion with user feedback"""
        suggestion = AISuggestion(
            suggestion_type="diversify",
            reasoning_text="Add international exposure",
            confidence_score=0.75,
            priority="medium"
        )
        db_session.add(suggestion)
        db_session.commit()
        
        # User accepts the suggestion
        suggestion.user_feedback = "accept"
        suggestion.user_note = "Good suggestion, will implement"
        suggestion.is_active = False
        db_session.commit()
        
        assert suggestion.user_feedback == "accept"
        assert suggestion.is_active is False


@pytest.mark.unit
class TestLifeStageProfileModel:
    """Tests for LifeStageProfile model"""
    
    def test_create_profile(self, db_session):
        """Test creating a life stage profile"""
        user = User(email="profile@test.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        profile = LifeStageProfile(
            user_id=user.id,
            age=35,
            annual_income=150000.00,
            risk_tolerance=7,
            time_horizon_years=30,
            goals_json='["retirement", "house", "education"]',
            target_allocation_json='{"us_equity": 60, "intl_equity": 20, "bonds": 20}',
            is_active=True
        )
        db_session.add(profile)
        db_session.commit()
        
        assert profile.id is not None
        assert profile.age == 35
        assert profile.risk_tolerance == 7
        assert profile.version == 1


@pytest.mark.unit
class TestMonthlyReportModel:
    """Tests for MonthlyReport model"""
    
    def test_create_monthly_report(self, db_session):
        """Test creating a monthly report"""
        report = MonthlyReport(
            year=2024,
            month=3,
            generated_at=datetime(2024, 4, 1, 9, 0, 0),
            summary_text="Portfolio increased 5% this month",
            metrics_json='{"net_worth_change": 5000, "allocation_drift": {"us_equity": 2}}',
            suggestions_count=3,
            status="completed"
        )
        db_session.add(report)
        db_session.commit()
        
        assert report.id is not None
        assert report.year == 2024
        assert report.month == 3
        assert report.status == "completed"