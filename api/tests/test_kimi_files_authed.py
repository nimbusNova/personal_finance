"""Authenticated tests for kimi_files router"""
import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.integration
class TestKimiFilesRouterAuthenticated:
    """Tests for kimi_files router with authentication"""
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_list_kimi_files_success(self, mock_get_service, authenticated_client):
        """Test listing Kimi files returns file list"""
        # Mock Kimi service
        mock_service = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"id": "file_1", "filename": "test1.pdf", "bytes": 1000},
                {"id": "file_2", "filename": "test2.pdf", "bytes": 2000}
            ]
        }
        mock_response.raise_for_status = MagicMock()
        mock_service.client.get.return_value = mock_response
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.get("/api/v1/kimi-files")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["data"][0]["filename"] == "test1.pdf"
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_list_kimi_files_empty(self, mock_get_service, authenticated_client):
        """Test listing when no files exist"""
        mock_service = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}
        mock_response.raise_for_status = MagicMock()
        mock_service.client.get.return_value = mock_response
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.get("/api/v1/kimi-files")
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_list_kimi_files_upstream_error(self, mock_get_service, authenticated_client):
        """Test 502 when Kimi API fails"""
        mock_service = MagicMock()
        mock_service.client.get.side_effect = Exception("Kimi API error")
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.get("/api/v1/kimi-files")
        
        assert response.status_code == 502
        assert "Upstream error" in response.json()["detail"]
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_delete_kimi_file_success(self, mock_get_service, authenticated_client):
        """Test deleting a Kimi file"""
        mock_service = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_service.client.delete.return_value = mock_response
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.delete("/api/v1/kimi-files/file_123")
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "File deleted"
        assert data["file_id"] == "file_123"
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_delete_kimi_file_not_found(self, mock_get_service, authenticated_client):
        """Test 502 when file doesn't exist on Kimi"""
        mock_service = MagicMock()
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("File not found")
        mock_service.client.delete.return_value = mock_response
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.delete("/api/v1/kimi-files/nonexistent")
        
        assert response.status_code == 502
    
    @patch("app.routers.kimi_files.get_kimi_service")
    def test_delete_kimi_file_upstream_error(self, mock_get_service, authenticated_client):
        """Test 502 on Kimi API error"""
        mock_service = MagicMock()
        mock_service.client.delete.side_effect = Exception("Connection error")
        mock_get_service.return_value = mock_service
        
        response = authenticated_client.delete("/api/v1/kimi-files/file_123")
        
        assert response.status_code == 502
        assert "Upstream error" in response.json()["detail"]
