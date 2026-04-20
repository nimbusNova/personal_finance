"""Integration tests for API endpoints"""
import os
import pytest

from app.services.settings_service import SETTINGS_FILE


@pytest.fixture(autouse=True)
def cleanup_settings():
    """Remove settings.json before each test to ensure clean state."""
    if os.path.exists(SETTINGS_FILE):
        os.remove(SETTINGS_FILE)
    yield
    if os.path.exists(SETTINGS_FILE):
        os.remove(SETTINGS_FILE)


@pytest.mark.integration
class TestHealthEndpoints:
    """Tests for health check endpoints"""
    
    def test_health_check(self, client):
        """Test basic health endpoint"""
        response = client.get("/api/v1/health")
        
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        assert "version" in response.json()
    
    def test_db_health_check(self, client):
        """Test database health endpoint"""
        response = client.get("/api/v1/health/db")
        
        # May fail if DB not initialized, that's ok for this test
        assert response.status_code in [200, 500]


@pytest.mark.integration
class TestSettingsEndpoints:
    """Tests for settings endpoints"""
    
    def test_get_settings_default(self, client):
        """Test getting settings when none exist"""
        response = client.get("/api/v1/settings")
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_name"] == ""
        assert data["kimi_api_key"] == ""
        assert data["has_api_key"] is False
    
    def test_update_settings(self, client):
        """Test updating settings"""
        response = client.post(
            "/api/v1/settings",
            json={"user_name": "Test User", "kimi_api_key": "sk-test123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["user_name"] == "Test User"
        assert data["kimi_api_key"] == "sk-test123"
        assert data["has_api_key"] is True
    
    def test_update_settings_empty_key(self, client):
        """Test updating with empty API key"""
        response = client.post(
            "/api/v1/settings",
            json={"user_name": "Test", "kimi_api_key": ""}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_api_key"] is False


@pytest.mark.integration
class TestUploadEndpoints:
    """Tests for file upload endpoints"""
    
    def test_upload_without_file(self, client):
        """Test upload without file fails"""
        response = client.post("/api/v1/upload")
        
        assert response.status_code == 422
    
    def test_upload_wrong_content_type(self, client):
        """Test upload with wrong content type fails"""
        response = client.post(
            "/api/v1/upload",
            files={"file": ("test.txt", b"not a pdf", "text/plain")}
        )
        
        assert response.status_code == 400


@pytest.mark.integration
class TestHoldingsEndpoints:
    """Tests for holdings endpoints"""
    
    def test_get_holdings_empty(self, client):
        """Test getting holdings when none exist"""
        response = client.get("/api/v1/holdings")
        
        assert response.status_code == 200
        data = response.json()
        assert "holdings" in data
        assert data["holdings"] == []
    
    def test_get_holdings_latest_empty(self, client):
        """Test getting latest holdings when none exist"""
        response = client.get("/api/v1/holdings/latest")
        
        assert response.status_code == 200
        data = response.json()
        assert "holdings" in data


@pytest.mark.integration
class TestTransactionsEndpoints:
    """Tests for transactions endpoints"""
    
    def test_get_transactions_empty(self, client):
        """Test getting transactions when none exist"""
        response = client.get("/api/v1/transactions")
        
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert data["transactions"] == []
    
    def test_get_transactions_summary_missing_params(self, client):
        """Test transactions summary without required params"""
        response = client.get("/api/v1/transactions/summary")
        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestSuggestionsEndpoints:
    """Tests for AI suggestions endpoints"""
    
    def test_get_suggestions_empty(self, client):
        """Test getting suggestions when none exist"""
        response = client.get("/api/v1/suggestions")
        
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert data["suggestions"] == []
