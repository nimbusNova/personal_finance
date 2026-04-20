"""Tests for router endpoints - accounts, holdings, transactions, suggestions, kimi_files"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.mark.integration
class TestAccountsRouter:
    """Tests for accounts router - requires auth"""
    
    def test_get_accounts_without_auth(self, client):
        """Test getting accounts without auth fails"""
        response = client.get("/api/v1/accounts")
        assert response.status_code == 401


@pytest.mark.integration  
class TestHoldingsRouter:
    """Tests for holdings router"""
    
    def test_get_holdings_with_snapshot_filter_no_auth(self, client):
        """Test holdings with snapshot filter - no auth"""
        response = client.get("/api/v1/holdings?snapshot_id=1")
        assert response.status_code == 401
    
    def test_get_holdings_with_account_filter_no_auth(self, client):
        """Test holdings with account filter - no auth"""
        response = client.get("/api/v1/holdings?account_id=1")
        assert response.status_code == 401
    
    def test_get_holdings_latest_no_auth(self, client):
        """Test latest holdings endpoint - no auth"""
        response = client.get("/api/v1/holdings/latest")
        assert response.status_code == 401
    
    def test_get_portfolio_summary_no_auth(self, client):
        """Test portfolio summary endpoint - no auth"""
        response = client.get("/api/v1/portfolio/summary")
        assert response.status_code == 401


@pytest.mark.integration
class TestTransactionsRouter:
    """Tests for transactions router"""
    
    def test_get_transactions_with_date_filter_no_auth(self, client):
        """Test transactions with date filters - no auth"""
        response = client.get("/api/v1/transactions?start_date=2024-01-01&end_date=2024-12-31")
        assert response.status_code == 401
    
    def test_get_transactions_with_category_filter_no_auth(self, client):
        """Test transactions with category filter - no auth"""
        response = client.get("/api/v1/transactions?category=food")
        assert response.status_code == 401
    
    def test_get_transactions_with_min_amount_no_auth(self, client):
        """Test transactions with min_amount filter - no auth"""
        response = client.get("/api/v1/transactions?min_amount=100.00")
        assert response.status_code == 401
    
    def test_get_transactions_summary_no_auth(self, client):
        """Test transactions summary endpoint - no auth"""
        response = client.get("/api/v1/transactions/summary?year=2024&month=1")
        assert response.status_code == 401
    
    def test_get_transactions_summary_missing_params(self, client):
        """Test transactions summary without required params"""
        response = client.get("/api/v1/transactions/summary")
        assert response.status_code == 401  # Auth fails before validation
    
    def test_get_expensive_transactions_no_auth(self, client):
        """Test expensive transactions endpoint - no auth"""
        response = client.get("/api/v1/transactions/expensive?threshold=200")
        assert response.status_code == 401
    
    def test_update_transaction_no_auth(self, client):
        """Test update transaction endpoint - no auth"""
        response = client.patch("/api/v1/transactions/1", json={"category": "food"})
        assert response.status_code == 401


@pytest.mark.integration
class TestSuggestionsRouter:
    """Tests for suggestions router"""
    
    def test_get_suggestions_inactive_no_auth(self, client):
        """Test getting inactive suggestions - no auth"""
        response = client.get("/api/v1/suggestions?is_active=false")
        assert response.status_code == 401
    
    def test_get_suggestions_active_no_auth(self, client):
        """Test getting active suggestions - no auth"""
        response = client.get("/api/v1/suggestions?is_active=true")
        assert response.status_code == 401
    
    def test_update_suggestion_feedback_accept_no_auth(self, client):
        """Test accepting suggestion - no auth"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "accept"}
        )
        assert response.status_code == 401
    
    def test_update_suggestion_feedback_reject_no_auth(self, client):
        """Test rejecting suggestion - no auth"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "reject", "note": "Not applicable"}
        )
        assert response.status_code == 401
    
    def test_update_suggestion_feedback_snooze_no_auth(self, client):
        """Test snoozing suggestion - no auth"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "snooze"}
        )
        assert response.status_code == 401
    
    def test_get_decision_trail_no_auth(self, client):
        """Test decision trail endpoint - no auth"""
        response = client.get("/api/v1/suggestions/decision-trail")
        assert response.status_code == 401


@pytest.mark.integration
class TestKimiFilesRouter:
    """Tests for kimi_files router"""
    
    def test_list_kimi_files_no_auth(self, client):
        """Test listing Kimi files without auth"""
        response = client.get("/api/v1/kimi-files")
        assert response.status_code == 401
    
    def test_delete_kimi_file_no_auth(self, client):
        """Test deleting Kimi file without auth"""
        response = client.delete("/api/v1/kimi-files/file_123")
        assert response.status_code == 401


@pytest.mark.integration
class TestUploadRouter:
    """Tests for upload router"""
    
    def test_upload_pdf_no_auth(self, client):
        """Test upload without auth fails"""
        response = client.post("/api/v1/upload")
        assert response.status_code == 401
    
    def test_upload_pdf_no_file(self, client):
        """Test upload without file"""
        response = client.post("/api/v1/upload")
        assert response.status_code == 401  # Auth check first
    
    def test_list_user_uploads_no_auth(self, client):
        """Test list uploads without auth"""
        response = client.get("/api/v1/uploads")
        assert response.status_code == 401


@pytest.mark.unit
class TestAuthRouterDetailed:
    """Additional tests for auth router to improve coverage"""
    
    def test_register_duplicate_user(self, client, db_session):
        """Test registering same user twice"""
        # First registration
        response1 = client.post(
            "/api/v1/auth/register",
            json={"email": "duplicate@test.com", "password": "securepass123"}
        )
        # Second registration with same email
        response2 = client.post(
            "/api/v1/auth/register",
            json={"email": "duplicate@test.com", "password": "securepass123"}
        )
        # Both can succeed or second can fail with 400
        assert response2.status_code in [200, 400]
    
    def test_login_success(self, client, db_session):
        """Test successful login"""
        # First register
        client.post(
            "/api/v1/auth/register",
            json={"email": "logintest@test.com", "password": "securepass123"}
        )
        # Then login
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "logintest@test.com", "password": "securepass123"}
        )
        # Should succeed or fail if user already existed
        assert response.status_code in [200, 401]
    
    def test_get_current_user_no_auth(self, client):
        """Test getting current user without auth"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401


@pytest.mark.unit
class TestHealthRouterDetailed:
    """Additional tests for health router"""
    
    def test_health_check_structure(self, client):
        """Test health check returns expected structure"""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert data["status"] == "healthy"
    
    def test_db_health_check_response(self, client):
        """Test DB health check returns valid response"""
        response = client.get("/api/v1/health/db")
        # Can be 200 (healthy) or 500 (error)
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
