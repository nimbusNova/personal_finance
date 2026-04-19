"""Unit tests for Kimi service"""
import pytest
from unittest.mock import Mock, patch, mock_open
from app.services.kimi_service import KimiService, get_kimi_service


@pytest.mark.unit
class TestKimiService:
    """Tests for Kimi service"""
    
    @patch('app.services.kimi_service.get_settings')
    def test_init(self, mock_settings):
        """Test Kimi service initialization"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        
        service = KimiService()
        
        assert service.api_key == "test_key"
        assert service.base_url == "https://test.api"
        assert service.client is not None
    
    @patch('app.services.kimi_service.get_settings')
    @patch('app.services.kimi_service.httpx.Client')
    def test_upload_file(self, mock_client_class, mock_settings):
        """Test file upload to Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        
        # Mock client
        mock_client = Mock()
        mock_client.post.return_value.json.return_value = {"url": "https://file.url", "id": "file123"}
        mock_client_class.return_value = mock_client
        
        service = KimiService()
        service.client = mock_client
        
        # Mock file reading
        with patch('builtins.open', mock_open(read_data=b"pdf content")):
            result = service._upload_file(b"pdf content", "/path/to/test.pdf")
        
        assert result["url"] == "https://file.url"
        mock_client.post.assert_called_once()
    
    @patch('app.services.kimi_service.get_settings')
    @patch('app.services.kimi_service.httpx.Client')
    def test_extract_with_kimi_success(self, mock_client_class, mock_settings):
        """Test successful extraction from Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        
        mock_client = Mock()
        mock_response = {
            "choices": [{
                "message": {
                    "content": '{"doc_type": "brokerage", "extraction_confidence": 0.95}'
                }
            }],
            "model": "kimi-latest",
            "usage": {"prompt_tokens": 100, "completion_tokens": 50}
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client
        
        service = KimiService()
        service.client = mock_client
        
        result = service._extract_with_kimi(
            {"url": "https://file.url"},
            "Extract brokerage data"
        )
        
        assert result["success"] is True
        assert result["data"]["doc_type"] == "brokerage"
        assert result["confidence"] == 0.95
    
    @patch('app.services.kimi_service.get_settings')
    @patch('app.services.kimi_service.httpx.Client')
    def test_extract_with_kimi_invalid_json(self, mock_client_class, mock_settings):
        """Test handling invalid JSON response from Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        
        mock_client = Mock()
        mock_response = {
            "choices": [{
                "message": {
                    "content": "Invalid JSON {broken"
                }
            }]
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client
        
        service = KimiService()
        service.client = mock_client
        
        result = service._extract_with_kimi(
            {"url": "https://file.url"},
            "Extract data"
        )
        
        assert result["success"] is False
        assert "error" in result
    
    @patch('app.services.kimi_service.get_settings')
    def test_extract_from_pdf_with_hint(self, mock_settings):
        """Test PDF extraction with document type hint"""
        mock_settings.return_value.kimi_api_key = "test_key"
        
        service = KimiService()
        
        # Mock internal methods
        service._upload_file = Mock(return_value={"url": "https://file.url"})
        service._extract_with_kimi = Mock(return_value={
            "success": True,
            "data": {"doc_type": "brokerage"},
            "confidence": 0.95
        })
        
        with patch('builtins.open', mock_open(read_data=b"pdf")):
            result = service.extract_from_pdf("/path/to/file.pdf", "brokerage")
        
        assert result["success"] is True
        service._upload_file.assert_called_once()
        service._extract_with_kimi.assert_called_once()
    
    @patch('app.services.kimi_service.get_settings')
    def test_detect_doc_type(self, mock_settings):
        """Test document type detection"""
        mock_settings.return_value.kimi_api_key = "test_key"
        
        service = KimiService()
        doc_type = service._detect_doc_type("/any/path.pdf")
        
        # Currently returns "unknown" (placeholder)
        assert doc_type == "unknown"
    
    def test_get_kimi_service_singleton(self):
        """Test that get_kimi_service returns a singleton"""
        with patch('app.services.kimi_service.KimiService') as mock_class:
            mock_instance = Mock()
            mock_class.return_value = mock_instance
            
            # Reset singleton
            import app.services.kimi_service as kms
            kms._kimi_service = None
            
            service1 = get_kimi_service()
            service2 = get_kimi_service()
            
            assert service1 is service2
            mock_class.assert_called_once()


@pytest.mark.unit
class TestKimiPrompts:
    """Tests for Kimi extraction prompts"""
    
    def test_brokerage_prompt_content(self):
        """Test that brokerage prompt contains required fields"""
        from app.services.kimi_service import BROKERAGE_PROMPT
        
        assert "brokerage" in BROKERAGE_PROMPT
        assert "holdings" in BROKERAGE_PROMPT
        assert "symbol" in BROKERAGE_PROMPT
        assert "market_value" in BROKERAGE_PROMPT
        assert "extraction_confidence" in BROKERAGE_PROMPT
    
    def test_credit_card_prompt_content(self):
        """Test that credit card prompt contains required fields"""
        from app.services.kimi_service import CREDIT_CARD_PROMPT
        
        assert "credit_card" in CREDIT_CARD_PROMPT
        assert "transactions" in CREDIT_CARD_PROMPT
        assert "merchant" in CREDIT_CARD_PROMPT
        assert "category" in CREDIT_CARD_PROMPT
        assert "is_recurring" in CREDIT_CARD_PROMPT
    
    def test_bank_prompt_content(self):
        """Test that bank prompt contains required fields"""
        from app.services.kimi_service import BANK_PROMPT
        
        assert "bank" in BANK_PROMPT
        assert "transactions" in BANK_PROMPT
        assert "beginning_balance" in BANK_PROMPT
        assert "ending_balance" in BANK_PROMPT