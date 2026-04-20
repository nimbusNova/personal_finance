"""Authenticated tests for transactions router"""
import pytest
from decimal import Decimal
from datetime import datetime, date

from app.database.models import Account, Institution, Transaction, AccountBalance


@pytest.mark.integration
class TestTransactionsRouterAuthenticated:
    """Tests for transactions router with authentication"""
    
    def test_get_transactions_empty(self, authenticated_client, test_user):
        """Test getting transactions when user has none"""
        response = authenticated_client.get("/api/v1/transactions")
        
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert data["transactions"] == []
    
    def test_get_transactions_basic(self, authenticated_client, test_user, test_account, db_session):
        """Test getting transactions returns list"""
        # Create transactions
        txn1 = Transaction(
            account_id=test_account.id,
            date=date(2024, 3, 15),
            merchant="Starbucks",
            category="food",
            amount=Decimal("5.50")
        )
        txn2 = Transaction(
            account_id=test_account.id,
            date=date(2024, 3, 16),
            merchant="Whole Foods",
            category="groceries",
            amount=Decimal("45.00")
        )
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 2
    
    def test_get_transactions_by_account_id(self, authenticated_client, test_user, test_institution, db_session):
        """Test filtering transactions by account_id"""
        # Create two accounts
        account1 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Checking", account_type="checking")
        account2 = Account(user_id=test_user.id, institution_id=test_institution.id, name="Savings", account_type="savings")
        db_session.add_all([account1, account2])
        db_session.flush()
        
        # Add transactions to each
        txn1 = Transaction(account_id=account1.id, date=date(2024, 3, 15), merchant="Store A", amount=Decimal("10.00"))
        txn2 = Transaction(account_id=account2.id, date=date(2024, 3, 16), merchant="Store B", amount=Decimal("20.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/transactions?account_id={account1.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Store A"
    
    def test_get_transactions_date_range(self, authenticated_client, test_user, test_account, db_session):
        """Test filtering transactions by date range"""
        # Create transactions on different dates
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 3, 1), merchant="Early", amount=Decimal("10.00"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 15), merchant="Middle", amount=Decimal("20.00"))
        txn3 = Transaction(account_id=test_account.id, date=date(2024, 3, 30), merchant="Late", amount=Decimal("30.00"))
        db_session.add_all([txn1, txn2, txn3])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions?start_date=2024-03-10&end_date=2024-03-20")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Middle"
    
    def test_get_transactions_by_category(self, authenticated_client, test_user, test_account, db_session):
        """Test filtering transactions by category"""
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 3, 15), merchant="Starbucks", category="food", amount=Decimal("5.50"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 16), merchant="Shell", category="transportation", amount=Decimal("45.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions?category=food")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Starbucks"
    
    def test_get_transactions_min_amount(self, authenticated_client, test_user, test_account, db_session):
        """Test filtering transactions by minimum amount"""
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 3, 15), merchant="Small", amount=Decimal("10.00"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 16), merchant="Large", amount=Decimal("100.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions?min_amount=50")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Large"
    
    def test_get_transactions_combined_filters(self, authenticated_client, test_user, test_account, db_session):
        """Test multiple filters work together"""
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 3, 15), merchant="A", category="food", amount=Decimal("100.00"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 16), merchant="B", category="food", amount=Decimal("50.00"))
        txn3 = Transaction(account_id=test_account.id, date=date(2024, 3, 17), merchant="C", category="transportation", amount=Decimal("100.00"))
        db_session.add_all([txn1, txn2, txn3])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions?category=food&min_amount=75")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "A"
    
    def test_get_transactions_summary_monthly(self, authenticated_client, test_user, test_account, db_session):
        """Test monthly spending summary by category"""
        # Create transactions in March 2024
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 3, 15), category="food", amount=Decimal("50.00"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 16), category="food", amount=Decimal("30.00"))
        txn3 = Transaction(account_id=test_account.id, date=date(2024, 3, 17), category="transportation", amount=Decimal("45.00"))
        db_session.add_all([txn1, txn2, txn3])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions/summary?year=2024&month=3")
        
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2024
        assert data["month"] == 3
        
        # Should have summary for food and transportation
        categories = {s["category"]: s for s in data["summary"]}
        assert "food" in categories
        assert categories["food"]["total"] == 80.00
        assert categories["food"]["count"] == 2
    
    def test_get_transactions_summary_no_data(self, authenticated_client, test_user):
        """Test summary for month with no transactions"""
        response = authenticated_client.get("/api/v1/transactions/summary?year=2024&month=1")
        
        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == []
    
    def test_get_expensive_transactions_default(self, authenticated_client, test_user, test_account, db_session):
        """Test expensive transactions with default threshold (200)"""
        from datetime import datetime, timedelta
        # Use recent dates (within last 30 days)
        today = datetime.now().date()
        txn1 = Transaction(account_id=test_account.id, date=today, merchant="Small", amount=Decimal("50.00"))
        txn2 = Transaction(account_id=test_account.id, date=today, merchant="Large", amount=Decimal("250.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions/expensive")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Large"
        assert data["threshold"] == 200.0
    
    def test_get_expensive_transactions_custom_threshold(self, authenticated_client, test_user, test_account, db_session):
        """Test expensive transactions with custom threshold"""
        from datetime import datetime, timedelta
        today = datetime.now().date()
        txn1 = Transaction(account_id=test_account.id, date=today, merchant="A", amount=Decimal("50.00"))
        txn2 = Transaction(account_id=test_account.id, date=today, merchant="B", amount=Decimal("100.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions/expensive?threshold=75")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["threshold"] == 75.0
    
    def test_get_expensive_transactions_by_month(self, authenticated_client, test_user, test_account, db_session):
        """Test expensive transactions filtered by year/month"""
        txn1 = Transaction(account_id=test_account.id, date=date(2024, 2, 15), merchant="Feb", amount=Decimal("300.00"))
        txn2 = Transaction(account_id=test_account.id, date=date(2024, 3, 16), merchant="Mar", amount=Decimal("300.00"))
        db_session.add_all([txn1, txn2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/transactions/expensive?year=2024&month=3")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["merchant"] == "Mar"
    
    def test_update_transaction_category(self, authenticated_client, test_user, test_account, db_session):
        """Test PATCH endpoint updates transaction category"""
        txn = Transaction(
            account_id=test_account.id,
            date=date(2024, 3, 15),
            merchant="Store",
            category="old_category",
            amount=Decimal("50.00")
        )
        db_session.add(txn)
        db_session.commit()
        
        response = authenticated_client.patch(
            f"/api/v1/transactions/{txn.id}",
            json={"category": "new_category"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "new_category"
        assert data["message"] == "Category updated"
    
    def test_update_transaction_not_found(self, authenticated_client):
        """Test 404 for non-existent transaction"""
        response = authenticated_client.patch(
            "/api/v1/transactions/99999",
            json={"category": "new_category"}
        )
        
        assert response.status_code == 404
    
    def test_update_transaction_unauthorized(self, authenticated_client, db_session):
        """Test can't update other user's transaction"""
        from app.database.models import User
        from app.routers.auth import get_password_hash
        
        # Create another user with account and transaction
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_inst = Institution(name="Other Bank", type="bank")
        db_session.add(other_inst)
        db_session.flush()
        
        other_account = Account(user_id=other_user.id, institution_id=other_inst.id, name="Other", account_type="checking")
        db_session.add(other_account)
        db_session.flush()
        
        other_txn = Transaction(account_id=other_account.id, date=date(2024, 3, 15), merchant="Other", amount=Decimal("50.00"))
        db_session.add(other_txn)
        db_session.commit()
        
        response = authenticated_client.patch(
            f"/api/v1/transactions/{other_txn.id}",
            json={"category": "hacked"}
        )
        
        assert response.status_code == 404  # Should not reveal existence
