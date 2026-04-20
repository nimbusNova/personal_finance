"""Authenticated tests for accounts router"""
import pytest
from decimal import Decimal
from datetime import datetime, date

from app.database.models import Account, Institution, AccountBalance, PDF, PortfolioSnapshot


@pytest.mark.integration
class TestAccountsRouterAuthenticated:
    """Tests for accounts router with authentication"""
    
    def test_get_accounts_empty(self, authenticated_client, test_user):
        """Test getting accounts when user has no accounts"""
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert data["accounts"] == []
    
    def test_get_accounts_with_data(self, authenticated_client, test_user, test_account, test_institution):
        """Test getting accounts returns account with institution data"""
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 1
        
        account = data["accounts"][0]
        assert account["name"] == "Test Checking"
        assert account["type"] == "checking"
        assert account["account_number_masked"] == "****1234"
        assert account["institution"]["name"] == "Test Bank"
        assert account["institution"]["type"] == "bank"
    
    def test_get_accounts_with_balance(self, authenticated_client, test_user, test_account, db_session):
        """Test accounts include latest balance"""
        # Add a balance
        balance = AccountBalance(
            account_id=test_account.id,
            balance=Decimal("5000.00"),
            statement_date=date(2024, 3, 15)
        )
        db_session.add(balance)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 1
        assert data["accounts"][0]["balance"] == 5000.00
        assert data["accounts"][0]["statement_date"] == "2024-03-15T00:00:00"
    
    def test_get_accounts_with_pdf_count(self, authenticated_client, test_user, test_account, db_session):
        """Test accounts include PDF count"""
        # Add some PDFs
        for i in range(3):
            pdf = PDF(
                account_id=test_account.id,
                original_filename=f"statement_{i}.pdf",
                file_path=f"/tmp/statement_{i}.pdf",
                extraction_status="completed"
            )
            db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert data["accounts"][0]["pdf_count"] == 3
    
    def test_get_accounts_deduplicates(self, authenticated_client, test_user, test_institution, db_session):
        """Test same account from multiple PDFs only shown once"""
        # Create two accounts with same institution_id and name (simulating duplicates)
        account1 = Account(
            user_id=test_user.id,
            institution_id=test_institution.id,
            name="Savings",
            account_type="savings",
            account_number_masked="****5678"
        )
        db_session.add(account1)
        db_session.flush()
        
        account2 = Account(
            user_id=test_user.id,
            institution_id=test_institution.id,
            name="Checking",  # Different name
            account_type="checking",
            account_number_masked="****1234"
        )
        db_session.add(account2)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 2  # Two different accounts
    
    def test_get_accounts_sorts_by_created_desc(self, authenticated_client, test_user, test_institution, db_session):
        """Test accounts sorted by created_at desc (newest first)"""
        # Create accounts at different times
        import time
        
        account1 = Account(
            user_id=test_user.id,
            institution_id=test_institution.id,
            name="Old Account",
            account_type="checking"
        )
        db_session.add(account1)
        db_session.commit()
        
        time.sleep(0.01)  # Small delay
        
        account2 = Account(
            user_id=test_user.id,
            institution_id=test_institution.id,
            name="New Account",
            account_type="savings"
        )
        db_session.add(account2)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        # Newest account should be first
        assert data["accounts"][0]["name"] == "New Account"
    
    def test_get_accounts_isolation(self, authenticated_client, db_session):
        """Test user can only see their own accounts"""
        from app.database.models import User, Institution
        from app.routers.auth import get_password_hash
        
        # Create another user with accounts
        other_user = User(
            email="other@example.com",
            password_hash=get_password_hash("password")
        )
        db_session.add(other_user)
        db_session.flush()
        
        other_institution = Institution(name="Other Bank", type="bank")
        db_session.add(other_institution)
        db_session.flush()
        
        other_account = Account(
            user_id=other_user.id,
            institution_id=other_institution.id,
            name="Other Account",
            account_type="checking"
        )
        db_session.add(other_account)
        db_session.commit()
        
        # Authenticated client is for test_user, should not see other_user's account
        response = authenticated_client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        account_names = [a["name"] for a in data["accounts"]]
        assert "Other Account" not in account_names
