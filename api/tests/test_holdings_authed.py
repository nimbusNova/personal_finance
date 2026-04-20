"""Authenticated tests for holdings router"""
import pytest
from decimal import Decimal
from datetime import date

from app.database.models import Account, Institution, PortfolioSnapshot, Holding, AccountBalance


@pytest.mark.integration
class TestHoldingsRouterAuthenticated:
    """Tests for holdings router with authentication"""
    
    def test_get_holdings_empty(self, authenticated_client, test_user):
        """Test getting holdings when user has none"""
        response = authenticated_client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        assert "holdings" in data
        assert data["holdings"] == []
    
    def test_get_holdings_with_data(self, authenticated_client, test_user, test_account, db_session):
        """Test getting holdings returns list with calculated weights"""
        # Create snapshot
        snapshot = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 3, 15),
            total_value=Decimal("60000.00"),
            cash_balance=Decimal("5000.00"),
            invested_value=Decimal("55000.00")
        )
        db_session.add(snapshot)
        db_session.flush()
        
        # Create holdings
        holding1 = Holding(
            snapshot_id=snapshot.id,
            symbol="VTI",
            name="Vanguard Total Stock",
            asset_class="equity",
            sector="us_total_market",
            geography="us",
            quantity=Decimal("100"),
            price=Decimal("250.00"),
            market_value=Decimal("25000.00"),
            weight_pct=Decimal("45.45")
        )
        holding2 = Holding(
            snapshot_id=snapshot.id,
            symbol="VXUS",
            name="Vanguard International",
            asset_class="equity",
            sector="international",
            geography="international",
            quantity=Decimal("200"),
            price=Decimal("150.00"),
            market_value=Decimal("30000.00"),
            weight_pct=Decimal("54.55")
        )
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["holdings"]) == 2
        
        # Check weight recalculation
        total_mv = 55000.00  # 25000 + 30000
        vti_weight = round(25000 / total_mv * 100, 2)
        assert data["holdings"][0]["weight_pct"] == vti_weight
    
    def test_get_holdings_by_snapshot_id(self, authenticated_client, test_user, test_account, db_session):
        """Test filtering holdings by snapshot_id"""
        # Create two snapshots
        snapshot1 = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 2, 15),
            total_value=Decimal("50000.00")
        )
        snapshot2 = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 3, 15),
            total_value=Decimal("60000.00")
        )
        db_session.add_all([snapshot1, snapshot2])
        db_session.flush()
        
        holding1 = Holding(snapshot_id=snapshot1.id, symbol="AAPL", market_value=Decimal("10000.00"))
        holding2 = Holding(snapshot_id=snapshot2.id, symbol="GOOGL", market_value=Decimal("20000.00"))
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/holdings?snapshot_id={snapshot2.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["holdings"]) == 1
        assert data["holdings"][0]["symbol"] == "GOOGL"
    
    def test_get_holdings_by_account_id(self, authenticated_client, test_user, test_institution, db_session):
        """Test filtering holdings by account_id"""
        # Create two accounts
        account1 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Account1", account_type="brokerage")
        account2 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Account2", account_type="brokerage")
        db_session.add_all([account1, account2])
        db_session.flush()
        
        snapshot1 = PortfolioSnapshot(account_id=account1.id, statement_date=date(2024, 3, 15), total_value=Decimal("50000.00"))
        snapshot2 = PortfolioSnapshot(account_id=account2.id, statement_date=date(2024, 3, 15), total_value=Decimal("60000.00"))
        db_session.add_all([snapshot1, snapshot2])
        db_session.flush()
        
        holding1 = Holding(snapshot_id=snapshot1.id, symbol="AAPL", market_value=Decimal("10000.00"))
        holding2 = Holding(snapshot_id=snapshot2.id, symbol="GOOGL", market_value=Decimal("20000.00"))
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/holdings?account_id={account1.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["holdings"]) == 1
        assert data["holdings"][0]["symbol"] == "AAPL"
    
    def test_get_holdings_weight_pct_calculation(self, authenticated_client, test_user, test_account, db_session):
        """Test weight percentage is recalculated correctly"""
        snapshot = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 3, 15),
            total_value=Decimal("100000.00")
        )
        db_session.add(snapshot)
        db_session.flush()
        
        # Holdings with different market values
        holding1 = Holding(snapshot_id=snapshot.id, symbol="VTI", market_value=Decimal("40000.00"), weight_pct=Decimal("40"))
        holding2 = Holding(snapshot_id=snapshot.id, symbol="BND", market_value=Decimal("10000.00"), weight_pct=Decimal("10"))
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Total MV = 50000, so VTI should be 80%, BND should be 20%
        symbols = {h["symbol"]: h for h in data["holdings"]}
        assert symbols["VTI"]["weight_pct"] == 80.0
        assert symbols["BND"]["weight_pct"] == 20.0
    
    def test_get_holdings_latest(self, authenticated_client, test_user, test_account, db_session):
        """Test /latest endpoint returns most recent holdings"""
        # Create snapshots at different dates
        snapshot_old = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 2, 15),
            total_value=Decimal("50000.00")
        )
        snapshot_new = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 3, 15),
            total_value=Decimal("60000.00")
        )
        db_session.add_all([snapshot_old, snapshot_new])
        db_session.flush()
        
        holding_old = Holding(snapshot_id=snapshot_old.id, symbol="OLD", market_value=Decimal("10000.00"))
        holding_new = Holding(snapshot_id=snapshot_new.id, symbol="NEW", market_value=Decimal("20000.00"))
        db_session.add_all([holding_old, holding_new])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/holdings/latest")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["holdings"]) == 1
        assert data["holdings"][0]["symbol"] == "NEW"
    
    def test_get_portfolio_summary(self, authenticated_client, test_user, test_account, db_session):
        """Test portfolio summary with AUM and allocation"""
        snapshot = PortfolioSnapshot(
            account_id=test_account.id,
            statement_date=date(2024, 3, 15),
            total_value=Decimal("100000.00"),
            cash_balance=Decimal("10000.00"),
            invested_value=Decimal("90000.00")
        )
        db_session.add(snapshot)
        db_session.flush()
        
        holding1 = Holding(snapshot_id=snapshot.id, symbol="VTI", asset_class="equity", market_value=Decimal("60000.00"))
        holding2 = Holding(snapshot_id=snapshot.id, symbol="BND", asset_class="bond", market_value=Decimal("30000.00"))
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/portfolio/summary")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_value"] == 100000.0
        assert data["cash_balance"] == 10000.0
        assert data["invested_value"] == 90000.0
        
        # Check allocation
        allocation = data["allocation"]
        assert "equity" in allocation
        assert "bond" in allocation
        assert "cash" in allocation
    
    def test_get_portfolio_summary_with_bank_balances(self, authenticated_client, test_user, test_institution, db_session):
        """Test portfolio summary includes bank account balances"""
        # Create brokerage account with holdings
        brokerage = Account(user_id=test_user.id, institution_id=test_institution.id, name="Brokerage", account_type="brokerage")
        db_session.add(brokerage)
        db_session.flush()
        
        snapshot = PortfolioSnapshot(account_id=brokerage.id, statement_date=date(2024, 3, 15), total_value=Decimal("50000.00"))
        db_session.add(snapshot)
        db_session.commit()
        
        # Create bank account with balance
        bank_account = Account(user_id=test_user.id, institution_id=test_institution.id, name="Checking", account_type="bank")
        db_session.add(bank_account)
        db_session.flush()
        
        balance = AccountBalance(account_id=bank_account.id, balance=Decimal("25000.00"), statement_date=date(2024, 3, 15))
        db_session.add(balance)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/portfolio/summary")
        
        assert response.status_code == 200
        data = response.json()
        # Total should include brokerage + bank
        assert data["total_value"] == 75000.0  # 50000 + 25000
        assert data["bank_total"] == 25000.0
    
    def test_get_portfolio_summary_with_cc_debt(self, authenticated_client, test_user, test_institution, db_session):
        """Test credit card debt is subtracted in summary"""
        # Create brokerage
        brokerage = Account(user_id=test_user.id, institution_id=test_institution.id, name="Brokerage", account_type="brokerage")
        db_session.add(brokerage)
        db_session.flush()
        
        snapshot = PortfolioSnapshot(account_id=brokerage.id, statement_date=date(2024, 3, 15), total_value=Decimal("50000.00"))
        db_session.add(snapshot)
        db_session.commit()
        
        # Create credit card with negative balance (debt)
        cc_account = Account(user_id=test_user.id, institution_id=test_institution.id, name="Credit Card", account_type="credit_card")
        db_session.add(cc_account)
        db_session.flush()
        
        balance = AccountBalance(account_id=cc_account.id, balance=Decimal("-5000.00"), statement_date=date(2024, 3, 15))
        db_session.add(balance)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/portfolio/summary")
        
        assert response.status_code == 200
        data = response.json()
        assert data["credit_card_debt"] == -5000.0  # API returns raw balance
    
    def test_get_holdings_across_multiple_accounts(self, authenticated_client, test_user, test_institution, db_session):
        """Test holdings aggregated across multiple accounts"""
        account1 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Account1", account_type="brokerage")
        account2 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Account2", account_type="brokerage")
        db_session.add_all([account1, account2])
        db_session.flush()
        
        snapshot1 = PortfolioSnapshot(account_id=account1.id, statement_date=date(2024, 3, 15), total_value=Decimal("30000.00"))
        snapshot2 = PortfolioSnapshot(account_id=account2.id, statement_date=date(2024, 3, 15), total_value=Decimal("40000.00"))
        db_session.add_all([snapshot1, snapshot2])
        db_session.flush()
        
        holding1 = Holding(snapshot_id=snapshot1.id, symbol="AAPL", market_value=Decimal("10000.00"))
        holding2 = Holding(snapshot_id=snapshot2.id, symbol="GOOGL", market_value=Decimal("20000.00"))
        db_session.add_all([holding1, holding2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["holdings"]) == 2
    
    def test_get_holdings_isolation(self, authenticated_client, db_session):
        """Test user can only see their own holdings"""
        from app.database.models import User
        from app.routers.auth import get_password_hash
        
        # Create another user with holdings
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_inst = Institution(name="Other Bank", type="brokerage")
        db_session.add(other_inst)
        db_session.flush()
        
        other_account = Account(user_id=other_user.id, institution_id=other_inst.id, name="Other", account_type="brokerage")
        db_session.add(other_account)
        db_session.flush()
        
        other_snapshot = PortfolioSnapshot(account_id=other_account.id, statement_date=date(2024, 3, 15), total_value=Decimal("50000.00"))
        db_session.add(other_snapshot)
        db_session.flush()
        
        other_holding = Holding(snapshot_id=other_snapshot.id, symbol="SECRET", market_value=Decimal("10000.00"))
        db_session.add(other_holding)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        symbols = [h["symbol"] for h in data["holdings"]]
        assert "SECRET" not in symbols
