"""Tests for router endpoints - accounts, holdings, transactions, suggestions, kimi_files"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.mark.integration
class TestAccountsRouter:
    """Tests for accounts router"""
    
    def test_get_accounts_empty(self, client):
        """Test getting accounts when none exist"""
        response = client.get("/api/v1/accounts")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert data["accounts"] == []


@pytest.mark.integration  
class TestHoldingsRouter:
    """Tests for holdings router"""
    
    def test_get_holdings_with_snapshot_filter(self, client):
        """Test holdings with snapshot filter - empty"""
        response = client.get("/api/v1/holdings?snapshot_id=1")
        assert response.status_code == 200
        data = response.json()
        assert data["holdings"] == []
    
    def test_get_holdings_with_account_filter(self, client):
        """Test holdings with account filter - empty"""
        response = client.get("/api/v1/holdings?account_id=1")
        assert response.status_code == 200
        data = response.json()
        assert data["holdings"] == []
    
    def test_get_holdings_latest_empty(self, client):
        """Test latest holdings endpoint - empty"""
        response = client.get("/api/v1/holdings/latest")
        assert response.status_code == 200
        data = response.json()
        assert data["holdings"] == []
    
    def test_get_portfolio_summary_empty(self, client):
        """Test portfolio summary endpoint - empty"""
        response = client.get("/api/v1/portfolio/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["total_value"] == 0.0


@pytest.mark.integration
class TestTransactionsRouter:
    """Tests for transactions router"""
    
    def test_get_transactions_with_date_filter(self, client):
        """Test transactions with date filters - empty"""
        response = client.get("/api/v1/transactions?start_date=2024-01-01&end_date=2024-12-31")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []
    
    def test_get_transactions_with_category_filter(self, client):
        """Test transactions with category filter - empty"""
        response = client.get("/api/v1/transactions?category=food")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []
    
    def test_get_transactions_with_min_amount(self, client):
        """Test transactions with min_amount filter - empty"""
        response = client.get("/api/v1/transactions?min_amount=100.00")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []
    
    def test_get_transactions_summary(self, client):
        """Test transactions summary endpoint"""
        response = client.get("/api/v1/transactions/summary?year=2024&month=1")
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2024
        assert data["month"] == 1
    
    def test_get_transactions_summary_missing_params(self, client):
        """Test transactions summary without required params"""
        response = client.get("/api/v1/transactions/summary")
        assert response.status_code == 422
    
    def test_get_expensive_transactions_empty(self, client):
        """Test expensive transactions endpoint - empty"""
        response = client.get("/api/v1/transactions/expensive?threshold=200")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []
    
    def test_update_transaction_not_found(self, client):
        """Test update transaction endpoint - not found"""
        response = client.patch("/api/v1/transactions/1", json={"category": "food"})
        assert response.status_code == 404


@pytest.mark.integration
class TestSuggestionsRouter:
    """Tests for suggestions router"""
    
    def test_get_suggestions_inactive_empty(self, client):
        """Test getting inactive suggestions - empty"""
        response = client.get("/api/v1/suggestions?is_active=false")
        assert response.status_code == 200
        data = response.json()
        assert data["suggestions"] == []
    
    def test_get_suggestions_active_empty(self, client):
        """Test getting active suggestions - empty"""
        response = client.get("/api/v1/suggestions?is_active=true")
        assert response.status_code == 200
        data = response.json()
        assert data["suggestions"] == []
    
    def test_update_suggestion_feedback_not_found(self, client):
        """Test accepting suggestion - not found"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "accept"}
        )
        assert response.status_code == 404
    
    def test_update_suggestion_feedback_reject_not_found(self, client):
        """Test rejecting suggestion - not found"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "reject", "note": "Not applicable"}
        )
        assert response.status_code == 404
    
    def test_update_suggestion_feedback_snooze_not_found(self, client):
        """Test snoozing suggestion - not found"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "snooze"}
        )
        assert response.status_code == 404
    
    def test_get_decision_trail_empty(self, client):
        """Test decision trail endpoint - empty"""
        response = client.get("/api/v1/suggestions/decision-trail")
        assert response.status_code == 200
        data = response.json()
        assert data["trail"] == []


@pytest.mark.integration
class TestKimiFilesRouter:
    """Tests for kimi_files router"""
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_list_kimi_files_empty(self, mock_get_service, client):
        """Test listing Kimi files - mock empty"""
        mock_service = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status = MagicMock()
        mock_service.client.get.return_value = mock_response
        mock_get_service.return_value = mock_service
        
        response = client.get("/api/v1/kimi-files")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_delete_kimi_file_upstream_error(self, mock_get_service, client):
        """Test deleting Kimi file - upstream error"""
        mock_service = MagicMock()
        mock_service.client.delete.side_effect = Exception("Connection error")
        mock_get_service.return_value = mock_service
        
        response = client.delete("/api/v1/kimi-files/file_123")
        assert response.status_code == 502
        assert "Upstream error" in response.json()["detail"]


@pytest.mark.integration
class TestUploadRouter:
    """Tests for upload router"""
    
    def test_upload_pdf_no_file(self, client):
        """Test upload without file"""
        response = client.post("/api/v1/upload")
        assert response.status_code == 422
    
    def test_list_uploads_empty(self, client):
        """Test list uploads - empty"""
        response = client.get("/api/v1/uploads")
        assert response.status_code == 200
        data = response.json()
        assert data["uploads"] == []


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
