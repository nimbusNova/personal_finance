"""Simplified tests for extraction service"""
import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock

from app.services import extraction_service
from app.database.models import PDF, ExtractionJob


@pytest.mark.unit
class TestExtractionServiceValidation:
    """Tests for extraction validation functions"""
    
    def test_validate_brokerage_extraction_success(self):
        """Test successful brokerage extraction validation"""
        data = {
            "doc_type": "brokerage_statement",
            "extraction_confidence": 0.8,
            "institution": {"name": "Fidelity"},
            "account": {"account_number_masked": "****1234"},
            "statement_date": "2024-01-15",
            "holdings": [{"symbol": "AAPL", "quantity": 100, "market_value": 15000.00}],
            "cash_positions": [{"currency": "USD", "amount": 5000.00}]
        }
        
        errors = extraction_service._validate_extraction(data, "brokerage_statement")
        assert errors == []
    
    def test_validate_credit_card_extraction_success(self):
        """Test successful credit card extraction validation"""
        data = {
            "doc_type": "credit_card_statement",
            "extraction_confidence": 0.85,
            "institution": {"name": "Chase"},
            "account": {"account_number_masked": "****5678"},
            "statement_date": "2024-01-15",
            "statement_period": "2024-01-01 to 2024-01-15",
            "transactions": [{"date": "2024-01-10", "merchant": "Starbucks", "amount": 5.50}],
            "statement_balance": 1500.00
        }
        
        errors = extraction_service._validate_extraction(data, "credit_card_statement")
        assert errors == []
    
    def test_validate_bank_extraction_success(self):
        """Test successful bank statement extraction validation"""
        data = {
            "doc_type": "bank_statement",
            "extraction_confidence": 0.9,
            "institution": {"name": "Bank of America"},
            "account": {"account_number_masked": "****9012"},
            "statement_date": "2024-01-15",
            "statement_period": "2024-01-01 to 2024-01-15",
            "account_type": "checking",
            "beginning_balance": 1000.00,
            "ending_balance": 2000.00,
            "transactions": [{"date": "2024-01-10", "description": "Paycheck", "amount": 1500.00, "type": "credit"}]
        }
        
        errors = extraction_service._validate_extraction(data, "bank_statement")
        assert errors == []
    
    def test_validate_extraction_unknown_doc_type(self):
        """Test validation with unknown document type"""
        data = {"doc_type": "unknown_type"}
        errors = extraction_service._validate_extraction(data, "unknown_type")
        assert isinstance(errors, list)


@pytest.mark.unit
class TestExtractionServiceUtils:
    """Tests for extraction service utility functions"""
    
    def test_set_step_updates_pdf(self, db_session):
        """Test _set_step updates PDF processing step"""
        pdf = PDF(
            account_id=None,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="pending"
        )
        db_session.add(pdf)
        db_session.commit()
        
        upload_logger = MagicMock()
        extraction_service._set_step(db_session, pdf, "Processing", upload_logger)
        
        assert pdf.processing_step == "Processing"


@pytest.mark.unit
class TestGetDBFunction:
    """Tests for _get_db function"""
    
    @patch("app.services.extraction_service.get_session_maker")
    def test_get_db_success(self, mock_session_maker):
        """Test _get_db returns session"""
        mock_session = MagicMock()
        mock_session_maker.return_value = MagicMock(return_value=mock_session)
        
        result = extraction_service._get_db()
        assert result == mock_session
