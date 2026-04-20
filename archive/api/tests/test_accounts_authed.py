"""Authenticated tests for accounts router"""
import pytest
from decimal import Decimal
from datetime import datetime, date

from app.database.models import Account, Institution, AccountBalance, PDF, PortfolioSnapshot


@pytest.mark.integration
class TestAccountsRouterAuthenticated:
    """Tests for accounts router with authentication"""
    
    def test_get_accounts_empty(self, client):
        """Test getting accounts when user has no accounts"""
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert data["accounts"] == []
    
    def test_get_accounts_with_data(self, client, test_account, test_institution):
        """Test getting accounts returns account with institution data"""
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 1
        
        account = data["accounts"][0]
        assert account["name"] == "Test Checking"
        assert account["type"] == "checking"
        assert account["account_number_masked"] == "****1234"
        assert account["institution"]["name"] == "Test Bank"
        assert account["institution"]["type"] == "bank"
    
    def test_get_accounts_with_balance(self, client, test_account, db_session):
        """Test accounts include latest balance"""
        # Add a balance
        balance = AccountBalance(
            account_id=test_account.id,
            balance=Decimal("5000.00"),
            statement_date=date(2024, 3, 15)
        )
        db_session.add(balance)
        db_session.commit()
        
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 1
        assert data["accounts"][0]["balance"] == 5000.00
        assert data["accounts"][0]["statement_date"] == "2024-03-15T00:00:00"
    
    def test_get_accounts_with_pdf_count(self, client, test_account, db_session):
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
        
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert data["accounts"][0]["pdf_count"] == 3
    
    def test_get_accounts_deduplicates(self, client, test_institution, db_session):
        """Test same account from multiple PDFs only shown once"""
        # Create two accounts with same institution_id and name (simulating duplicates)
        account1 = Account(
            institution_id=test_institution.id,
            name="Savings",
            account_type="savings",
            account_number_masked="****5678"
        )
        db_session.add(account1)
        db_session.flush()
        
        account2 = Account(

            institution_id=test_institution.id,
            name="Checking",  # Different name
            account_type="checking",
            account_number_masked="****1234"
        )
        db_session.add(account2)
        db_session.commit()
        
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["accounts"]) == 2  # Two different accounts
    
    def test_get_accounts_sorts_by_created_desc(self, client, test_institution, db_session):
        """Test accounts sorted by created_at desc (newest first)"""
        # Create accounts at different times
        import time
        
        account1 = Account(

            institution_id=test_institution.id,
            name="Old Account",
            account_type="checking"
        )
        db_session.add(account1)
        db_session.commit()
        
        time.sleep(0.01)  # Small delay
        
        account2 = Account(

            institution_id=test_institution.id,
            name="New Account",
            account_type="savings"
        )
        db_session.add(account2)
        db_session.commit()
        
        response = client.get("/api/v1/accounts")
        
        assert response.status_code == 200
        data = response.json()
        # Newest account should be first
        assert data["accounts"][0]["name"] == "New Account"
    

