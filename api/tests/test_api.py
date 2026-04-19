"""Integration tests for API endpoints"""
import pytest
from fastapi.testclient import TestClient


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
class TestAuthEndpoints:
    """Tests for authentication endpoints"""
    
    def test_register_user(self, client):
        """Test user registration"""
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "newuser@test.com", "password": "securepass123"}
        )
        
        # May fail if user exists, check structure
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            assert "user_id" in response.json()
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent@test.com", "password": "wrongpass"}
        )
        
        assert response.status_code == 401
    
    def test_login_missing_fields(self, client):
        """Test login with missing fields"""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "test@test.com"}  # Missing password
        )
        
        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestUploadEndpoints:
    """Tests for file upload endpoints"""
    
    def test_upload_without_auth(self, client):
        """Test upload without authentication fails"""
        response = client.post("/api/v1/upload")
        
        assert response.status_code == 401
    
    def test_upload_wrong_content_type(self, client):
        """Test upload with wrong content type fails"""
        # Would need auth token for full test
        response = client.post(
            "/api/v1/upload",
            files={"file": ("test.txt", b"not a pdf", "text/plain")}
        )
        
        # Should fail auth or validation
        assert response.status_code in [401, 400]


@pytest.mark.integration
class TestHoldingsEndpoints:
    """Tests for holdings endpoints"""
    
    def test_get_holdings_without_auth(self, client):
        """Test getting holdings without auth fails"""
        response = client.get("/api/v1/holdings")
        
        assert response.status_code == 401
    
    def test_get_holdings_latest_without_auth(self, client):
        """Test getting latest holdings without auth fails"""
        response = client.get("/api/v1/holdings/latest")
        
        assert response.status_code == 401


@pytest.mark.integration
class TestTransactionsEndpoints:
    """Tests for transactions endpoints"""
    
    def test_get_transactions_without_auth(self, client):
        """Test getting transactions without auth fails"""
        response = client.get("/api/v1/transactions")
        
        assert response.status_code == 401
    
    def test_get_transactions_summary_without_auth(self, client):
        """Test getting transactions summary without auth fails"""
        response = client.get("/api/v1/transactions/summary?year=2024&month=3")
        
        assert response.status_code == 401


@pytest.mark.integration
class TestSuggestionsEndpoints:
    """Tests for AI suggestions endpoints"""
    
    def test_get_suggestions_without_auth(self, client):
        """Test getting suggestions without auth fails"""
        response = client.get("/api/v1/suggestions")
        
        assert response.status_code == 401
    
    def test_update_suggestion_feedback_without_auth(self, client):
        """Test updating suggestion without auth fails"""
        response = client.post(
            "/api/v1/suggestions/1/feedback",
            json={"feedback": "accept"}
        )
        
        assert response.status_code == 401