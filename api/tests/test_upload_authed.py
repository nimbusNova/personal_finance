"""Authenticated tests for upload router - Fixed to match actual API"""
import pytest
import io
from unittest.mock import patch, MagicMock
from datetime import date

from app.database.models import PDF, AccountBalance, Institution, Account


@pytest.mark.integration
class TestUploadRouterAuthenticated:
    """Tests for upload router with authentication"""
    
    def test_upload_pdf_success(self, authenticated_client, test_account):
        """Test successful PDF upload with account_id"""
        pdf_content = b"%PDF-1.4 fake pdf content"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            data={"account_id": test_account.id},
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Upload successful"
        assert "pdf_id" in data
        assert data["status"] == "pending_extraction"
    
    def test_upload_pdf_without_account(self, authenticated_client):
        """Test upload without account_id"""
        pdf_content = b"%PDF-1.4 fake pdf content"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Upload successful"
    
    def test_upload_pdf_wrong_content_type(self, authenticated_client):
        """Test rejection of non-PDF files"""
        txt_content = b"This is not a PDF"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            files={"file": ("document.txt", io.BytesIO(txt_content), "text/plain")}
        )
        
        assert response.status_code == 400
        assert "Only PDF files allowed" in response.json()["detail"]
    
    def test_upload_pdf_invalid_account(self, authenticated_client):
        """Test 404 for non-existent account"""
        pdf_content = b"%PDF-1.4 fake pdf content"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            data={"account_id": 99999},
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        
        assert response.status_code == 404
        assert "Account not found" in response.json()["detail"]
    
    def test_upload_pdf_other_users_account(self, authenticated_client, db_session):
        """Test can't upload to other user's account"""
        from app.database.models import User
        from app.routers.auth import get_password_hash
        
        # Create another user with account
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_inst = Institution(name="Other Bank", type="bank")
        db_session.add(other_inst)
        db_session.flush()
        
        other_account = Account(user_id=other_user.id, institution_id=other_inst.id, name="Other", account_type="checking")
        db_session.add(other_account)
        db_session.commit()
        
        pdf_content = b"%PDF-1.4 fake pdf content"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            data={"account_id": other_account.id},
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        
        assert response.status_code == 404
    
    def test_get_upload(self, authenticated_client, test_account, db_session):
        """Test getting a single PDF upload"""
        # Create a PDF
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="completed",
            extracted_data={"doc_type": "bank_statement"},
            extraction_confidence=0.95
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/uploads/{pdf.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == pdf.id
        assert data["original_filename"] == "test.pdf"
        assert data["extraction_status"] == "completed"
        assert data["extracted_data"]["doc_type"] == "bank_statement"
    
    def test_get_upload_not_found(self, authenticated_client):
        """Test 404 for non-existent upload"""
        response = authenticated_client.get("/api/v1/uploads/99999")
        
        assert response.status_code == 404
    
    def test_get_upload_unauthorized(self, authenticated_client, db_session):
        """Test can't see other user's upload"""
        from app.database.models import User
        from app.routers.auth import get_password_hash
        
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_inst = Institution(name="Other Bank", type="bank")
        db_session.add(other_inst)
        db_session.flush()
        
        other_account = Account(user_id=other_user.id, institution_id=other_inst.id, name="Other", account_type="checking")
        db_session.add(other_account)
        db_session.flush()
        
        other_pdf = PDF(account_id=other_account.id, original_filename="secret.pdf", file_path="/tmp/secret.pdf")
        db_session.add(other_pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/uploads/{other_pdf.id}")
        
        assert response.status_code == 404
    
    @patch("app.services.extraction_service.process_pdf_extraction")
    def test_retry_extraction_success(self, mock_process, authenticated_client, test_account, db_session):
        """Test retry extraction for failed upload"""
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="failed"
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.post(f"/api/v1/uploads/{pdf.id}/retry")
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Extraction retry queued"
        assert data["pdf_id"] == pdf.id
        assert data["status"] == "pending"
    
    def test_list_user_uploads(self, authenticated_client, test_user, test_account, db_session):
        """Test listing user's uploads"""
        # Create multiple PDFs
        for i in range(3):
            pdf = PDF(
                account_id=test_account.id,
                original_filename=f"statement_{i}.pdf",
                file_path=f"/tmp/statement_{i}.pdf",
                file_size=1024 * (i + 1),
                extraction_status="completed" if i % 2 == 0 else "pending"
            )
            db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/uploads")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["uploads"]) == 3
    
    def test_list_user_uploads_with_account_filter(self, authenticated_client, test_user, test_account, db_session):
        """Test listing uploads filtered by account"""
        # Create PDFs for test_account
        pdf1 = PDF(account_id=test_account.id, original_filename="account1.pdf", file_path="/tmp/a1.pdf")
        db_session.add(pdf1)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/uploads?account_id={test_account.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["uploads"]) == 1
        assert data["uploads"][0]["original_filename"] == "account1.pdf"
    
    def test_list_user_uploads_with_status_filter(self, authenticated_client, test_account, db_session):
        """Test listing uploads filtered by status"""
        # Create PDFs with different statuses
        pdf1 = PDF(account_id=test_account.id, original_filename="completed.pdf", file_path="/tmp/c.pdf", extraction_status="completed")
        pdf2 = PDF(account_id=test_account.id, original_filename="pending.pdf", file_path="/tmp/p.pdf", extraction_status="pending")
        db_session.add_all([pdf1, pdf2])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/uploads?status=completed")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["uploads"]) == 1
        assert data["uploads"][0]["original_filename"] == "completed.pdf"
    
    def test_list_user_uploads_isolation(self, authenticated_client, db_session):
        """Test user only sees their own uploads"""
        from app.database.models import User, Institution, Account, PDF
        from app.routers.auth import get_password_hash
        
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_inst = Institution(name="Other Bank", type="bank")
        db_session.add(other_inst)
        db_session.flush()
        
        other_account = Account(user_id=other_user.id, institution_id=other_inst.id, name="Other", account_type="checking")
        db_session.add(other_account)
        db_session.flush()
        
        other_pdf = PDF(account_id=other_account.id, original_filename="secret.pdf", file_path="/tmp/secret.pdf")
        db_session.add(other_pdf)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/uploads")
        
        assert response.status_code == 200
        data = response.json()
        filenames = [u["original_filename"] for u in data["uploads"]]
        assert "secret.pdf" not in filenames
    
    def test_upload_stats(self, authenticated_client):
        """Test getting upload statistics"""
        response = authenticated_client.get("/api/v1/uploads/stats")
        
        assert response.status_code == 200
        # Just verify it returns data without error
        assert isinstance(response.json(), dict)
