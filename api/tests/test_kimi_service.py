"""Unit tests for Kimi service"""
import json
import pytest
from unittest.mock import Mock, patch, mock_open

from app.services.kimi_service import (
    KimiService,
    get_kimi_service,
    CLASSIFICATION_PROMPT,
    BROKERAGE_EXTRACTION_PROMPT,
    CREDIT_CARD_EXTRACTION_PROMPT,
    BANK_EXTRACTION_PROMPT,
    JSON_REPAIR_PROMPT,
)


@pytest.mark.unit
class TestKimiService:
    """Tests for Kimi service"""

    @patch("app.services.kimi_service.get_settings")
    def test_init(self, mock_settings):
        """Test Kimi service initialization"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        service = KimiService()

        assert service.api_key == "test_key"
        assert service.base_url == "https://test.api"
        assert service.model == "moonshot-v1-128k"
        assert service.client is not None

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_upload_file(self, mock_client_class, mock_settings):
        """Test file upload to Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_client.post.return_value.json.return_value = {
            "url": "https://file.url",
            "id": "file123",
        }
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        with patch("builtins.open", mock_open(read_data=b"pdf content")):
            result = service._upload_file("/path/to/test.pdf")

        assert result["url"] == "https://file.url"
        assert result["id"] == "file123"
        mock_client.post.assert_called_once()

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_get_file_content(self, mock_client_class, mock_settings):
        """Test retrieving file content from Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_client.get.return_value.text = "Extracted PDF text"
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        text = service._get_file_content("file123")
        assert text == "Extracted PDF text"
        mock_client.get.assert_called_once_with("/files/file123/content")

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_delete_file(self, mock_client_class, mock_settings):
        """Test deleting a file from Kimi"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        # Should not raise even if delete fails
        service._delete_file("file123")
        mock_client.delete.assert_called_once_with("/files/file123")

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_call_chat_completion_success(self, mock_client_class, mock_settings):
        """Test successful chat completion call"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": '{"doc_type": "brokerage", "extraction_confidence": 0.95}'
                    }
                }
            ],
            "model": "moonshot-v1-128k",
            "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        payload = {"model": "moonshot-v1-128k", "messages": []}
        result = service._call_chat_completion(payload)

        assert result["success"] is True
        assert result["data"]["doc_type"] == "brokerage"
        assert result["confidence"] == 0.95

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_call_chat_completion_invalid_json(self, mock_client_class, mock_settings):
        """Test handling invalid JSON in chat completion response"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [{"message": {"content": "Invalid JSON {broken"}}]
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        payload = {"model": "moonshot-v1-128k", "messages": []}
        result = service._call_chat_completion(payload)

        assert result["success"] is False
        assert "error" in result
        assert "raw_response" in result

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_call_chat_completion_http_error(self, mock_client_class, mock_settings):
        """Test handling HTTP error from Kimi API"""
        import httpx

        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.json.return_value = {"error": "Unauthorized"}

        mock_client = Mock()
        mock_client.post.return_value = mock_response
        mock_client.post.return_value.raise_for_status.side_effect = (
            httpx.HTTPStatusError(
                "Unauthorized",
                request=Mock(),
                response=mock_response,
            )
        )
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        payload = {"model": "moonshot-v1-128k", "messages": []}
        result = service._call_chat_completion(payload)

        assert result["success"] is False
        assert "401" in result["error"]

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_classify_document(self, mock_client_class, mock_settings):
        """Test document classification"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "doc_type": "brokerage",
                                "institution": "Charles Schwab",
                                "statement_date": "2024-03-31",
                                "confidence": 0.95,
                            }
                        )
                    }
                }
            ],
            "model": "moonshot-v1-128k",
            "usage": {},
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        result = service.classify_document("Some PDF text")

        assert result["success"] is True
        assert result["data"]["doc_type"] == "brokerage"
        assert result["data"]["institution"] == "Charles Schwab"

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_classify_document_invalid_doc_type(self, mock_client_class, mock_settings):
        """Test classification normalizes invalid doc_type to unknown"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {"doc_type": "invoice", "institution": "Unknown"}
                        )
                    }
                }
            ],
            "model": "moonshot-v1-128k",
            "usage": {},
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        result = service.classify_document("Some PDF text")

        assert result["success"] is True
        assert result["data"]["doc_type"] == "unknown"

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_extract_structured_data(self, mock_client_class, mock_settings):
        """Test structured data extraction"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "doc_type": "credit_card",
                                "institution": "Chase",
                                "statement_balance": 3250.0,
                                "extraction_confidence": 0.91,
                            }
                        )
                    }
                }
            ],
            "model": "moonshot-v1-128k",
            "usage": {},
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        result = service.extract_structured_data("PDF text", "credit_card")

        assert result["success"] is True
        assert result["data"]["institution"] == "Chase"

    @patch("app.services.kimi_service.get_settings")
    @patch("app.services.kimi_service.httpx.Client")
    def test_repair_json(self, mock_client_class, mock_settings):
        """Test JSON repair fallback"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_client = Mock()
        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {"doc_type": "bank", "ending_balance": 5000.0}
                        )
                    }
                }
            ],
            "model": "moonshot-v1-128k",
            "usage": {},
        }
        mock_client.post.return_value.json.return_value = mock_response
        mock_client_class.return_value = mock_client

        service = KimiService()
        service.client = mock_client

        result = service.repair_json('{"doc_type": "bank",')

        assert result["success"] is True
        assert result["data"]["ending_balance"] == 5000.0

    @patch("app.services.kimi_service.KimiService._get_pdf_text")
    @patch("app.services.kimi_service.KimiService.classify_document")
    @patch("app.services.kimi_service.KimiService.extract_structured_data")
    @patch("app.services.kimi_service.get_settings")
    def test_extract_from_pdf_success(
        self,
        mock_settings,
        mock_extract,
        mock_classify,
        mock_get_text,
    ):
        """Test full PDF extraction pipeline — success path"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_get_text.return_value = ("some pdf text", "kimi_file_extract")
        mock_classify.return_value = {
            "success": True,
            "data": {
                "doc_type": "brokerage",
                "institution": "Schwab",
                "statement_date": "2024-03-31",
                "confidence": 0.95,
            },
        }
        mock_extract.return_value = {
            "success": True,
            "data": {
                "holdings": [{"symbol": "VTI", "market_value": 10000}],
                "extraction_confidence": 0.92,
            },
        }

        service = KimiService()
        result = service.extract_from_pdf("/path/to/file.pdf")

        assert result["success"] is True
        assert result["data"]["doc_type"] == "brokerage"
        assert result["data"]["institution"] == "Schwab"
        mock_get_text.assert_called_once_with("/path/to/file.pdf", None)
        mock_classify.assert_called_once()
        mock_extract.assert_called_once()

    @patch("app.services.kimi_service.KimiService._get_pdf_text")
    @patch("app.services.kimi_service.KimiService.classify_document")
    @patch("app.services.kimi_service.KimiService.extract_structured_data")
    @patch("app.services.kimi_service.KimiService.repair_json")
    @patch("app.services.kimi_service.get_settings")
    def test_extract_from_pdf_stage2_falls_back_to_stage3(
        self,
        mock_settings,
        mock_repair,
        mock_extract,
        mock_classify,
        mock_get_text,
    ):
        """Test that Stage 3 JSON repair runs when Stage 2 fails"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_get_text.return_value = ("some pdf text", "pypdf2")
        mock_classify.return_value = {
            "success": True,
            "data": {
                "doc_type": "bank",
                "institution": "Chase",
                "statement_date": "2024-01-31",
                "confidence": 0.9,
            },
        }
        mock_extract.return_value = {
            "success": False,
            "error": "JSON parse failed",
            "raw_response": '{"doc_type": "bank",',
        }
        mock_repair.return_value = {
            "success": True,
            "data": {"ending_balance": 5000.0},
        }

        service = KimiService()
        result = service.extract_from_pdf("/path/to/file.pdf", upload_id=42)

        assert result["success"] is True
        assert result["data"]["ending_balance"] == 5000.0
        mock_repair.assert_called_once()

    @patch("app.services.kimi_service.KimiService._get_pdf_text")
    @patch("app.services.kimi_service.KimiService.classify_document")
    @patch("app.services.kimi_service.get_settings")
    def test_extract_from_pdf_classification_fails(
        self, mock_settings, mock_classify, mock_get_text
    ):
        """Test pipeline stops early when classification fails"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_get_text.return_value = ("some pdf text", "kimi_file_extract")
        mock_classify.return_value = {
            "success": False,
            "error": "API rate limited",
        }

        service = KimiService()
        result = service.extract_from_pdf("/path/to/file.pdf")

        assert result["success"] is False
        assert "Classification failed" in result["error"]

    @patch("app.services.kimi_service.KimiService._get_pdf_text")
    @patch("app.services.kimi_service.get_settings")
    def test_extract_from_pdf_no_text(self, mock_settings, mock_get_text):
        """Test extraction fails when no text can be extracted"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_get_text.return_value = ("", "none")

        service = KimiService()
        result = service.extract_from_pdf("/path/to/empty.pdf")

        assert result["success"] is False
        assert "Could not extract text" in result["error"]

    @patch("app.services.kimi_service.KimiService._upload_file")
    @patch("app.services.kimi_service.KimiService._get_file_content")
    @patch("app.services.kimi_service.KimiService._delete_file")
    @patch("app.services.kimi_service.KimiService._extract_pdf_text")
    @patch("app.services.kimi_service.get_settings")
    def test_get_pdf_text_file_upload_strategy(
        self,
        mock_settings,
        mock_pypdf,
        mock_delete,
        mock_get_content,
        mock_upload,
    ):
        """Test _get_pdf_text uses file-upload strategy when it works"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_upload.return_value = {"id": "file123"}
        mock_get_content.return_value = "Long extracted text from Kimi API" * 10

        service = KimiService()
        text, source = service._get_pdf_text("/path/to/file.pdf")

        assert len(text) > 50
        assert source == "kimi_file_extract"
        mock_upload.assert_called_once_with("/path/to/file.pdf")
        mock_get_content.assert_called_once_with("file123")
        mock_delete.assert_called_once_with("file123", None)
        mock_pypdf.assert_not_called()

    @patch("app.services.kimi_service.KimiService._upload_file")
    @patch("app.services.kimi_service.KimiService._get_file_content")
    @patch("app.services.kimi_service.KimiService._delete_file")
    @patch("app.services.kimi_service.KimiService._extract_pdf_text")
    @patch("app.services.kimi_service.get_settings")
    def test_get_pdf_text_pypdf2_fallback(
        self,
        mock_settings,
        mock_pypdf,
        mock_delete,
        mock_get_content,
        mock_upload,
    ):
        """Test _get_pdf_text falls back to PyPDF2 when upload fails"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        mock_upload.side_effect = Exception("Upload failed")
        mock_pypdf.return_value = "Fallback text from PyPDF2"

        service = KimiService()
        text, source = service._get_pdf_text("/path/to/file.pdf")

        assert text == "Fallback text from PyPDF2"
        assert source == "pypdf2"
        mock_pypdf.assert_called_once_with("/path/to/file.pdf")

    @patch("app.services.kimi_service.get_settings")
    def test_select_extraction_prompt(self, mock_settings):
        """Test prompt selection by doc_type"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        service = KimiService()

        assert service._select_extraction_prompt("brokerage") == BROKERAGE_EXTRACTION_PROMPT
        assert service._select_extraction_prompt("credit_card") == CREDIT_CARD_EXTRACTION_PROMPT
        assert service._select_extraction_prompt("bank") == BANK_EXTRACTION_PROMPT
        # Unknown falls back to bank prompt
        assert service._select_extraction_prompt("unknown") == BANK_EXTRACTION_PROMPT

    @patch("app.services.kimi_service.get_settings")
    def test_build_payload_truncates_long_text(self, mock_settings):
        """Test that _build_payload truncates overly long PDF text"""
        mock_settings.return_value.kimi_api_key = "test_key"
        mock_settings.return_value.kimi_base_url = "https://test.api"
        mock_settings.return_value.kimi_model = "moonshot-v1-128k"

        service = KimiService()
        long_text = "x" * 50000
        payload = service._build_payload("system prompt", long_text)

        assert len(payload["messages"][1]["content"]) < 35000
        assert "...[truncated]" in payload["messages"][1]["content"]

    def test_get_kimi_service_singleton(self):
        """Test that get_kimi_service returns a singleton"""
        with patch("app.services.kimi_service.KimiService") as mock_class:
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

    def test_classification_prompt_content(self):
        """Test that classification prompt contains required fields"""
        assert "brokerage" in CLASSIFICATION_PROMPT
        assert "bank" in CLASSIFICATION_PROMPT
        assert "credit_card" in CLASSIFICATION_PROMPT
        assert "institution" in CLASSIFICATION_PROMPT
        assert "statement_date" in CLASSIFICATION_PROMPT
        assert "confidence" in CLASSIFICATION_PROMPT

    def test_brokerage_extraction_prompt_content(self):
        """Test that brokerage prompt contains required fields"""
        assert "brokerage" in BROKERAGE_EXTRACTION_PROMPT
        assert "holdings" in BROKERAGE_EXTRACTION_PROMPT
        assert "symbol" in BROKERAGE_EXTRACTION_PROMPT
        assert "market_value" in BROKERAGE_EXTRACTION_PROMPT
        assert "extraction_confidence" in BROKERAGE_EXTRACTION_PROMPT

    def test_credit_card_extraction_prompt_content(self):
        """Test that credit card prompt contains required fields"""
        assert "credit_card" in CREDIT_CARD_EXTRACTION_PROMPT
        assert "transactions" in CREDIT_CARD_EXTRACTION_PROMPT
        assert "merchant" in CREDIT_CARD_EXTRACTION_PROMPT
        assert "category" in CREDIT_CARD_EXTRACTION_PROMPT
        assert "is_recurring" in CREDIT_CARD_EXTRACTION_PROMPT

    def test_bank_extraction_prompt_content(self):
        """Test that bank prompt contains required fields"""
        assert "bank" in BANK_EXTRACTION_PROMPT
        assert "transactions" in BANK_EXTRACTION_PROMPT
        assert "beginning_balance" in BANK_EXTRACTION_PROMPT
        assert "ending_balance" in BANK_EXTRACTION_PROMPT

    def test_json_repair_prompt_content(self):
        """Test that JSON repair prompt instructs to fix JSON"""
        assert "valid JSON" in JSON_REPAIR_PROMPT
        assert "Broken JSON" in JSON_REPAIR_PROMPT
