"""Authenticated tests for upload router"""
import pytest
import io
from unittest.mock import patch, MagicMock
from datetime import date

from app.database.models import PDF, AccountBalance, Institution


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
        assert data["status"] == "pending"
        assert data["extraction_status"] == "pending"
    
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
        assert data["account_id"] is None
    
    def test_upload_pdf_wrong_content_type(self, authenticated_client):
        """Test rejection of non-PDF files"""
        txt_content = b"This is not a PDF"
        
        response = authenticated_client.post(
            "/api/v1/upload",
            files={"file": ("document.txt", io.BytesIO(txt_content), "text/plain")}
        )
        
        assert response.status_code == 400
        assert "Only PDF files allowed" in response.json()["detail"]
    
    def test_upload_pdf_duplicate_detection(self, authenticated_client, test_account, db_session):
        """Test duplicate upload detection"""
        pdf_content = b"%PDF-1.4 fake pdf content"
        
        # First upload
        response1 = authenticated_client.post(
            "/api/v1/upload",
            data={"account_id": test_account.id},
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        assert response1.status_code == 200
        pdf_id = response1.json()["pdf_id"]
        
        # Second upload with same filename and account
        response2 = authenticated_client.post(
            "/api/v1/upload",
            data={"account_id": test_account.id},
            files={"file": ("statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        
        assert response2.status_code == 200
        data = response2.json()
        assert data["status"] == "duplicate"
        assert data["pdf_id"] == pdf_id
    
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
    
    def test_get_upload_status_pending(self, authenticated_client, test_account, db_session):
        """Test status endpoint shows pending status"""
        # Create a PDF
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="pending"
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/upload/{pdf.id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["extraction_status"] == "pending"
    
    def test_get_upload_status_processing(self, authenticated_client, test_account, db_session):
        """Test status endpoint shows processing status"""
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="processing",
            processing_step="Stage 1/3: Classifying document"
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/upload/{pdf.id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["processing_step"] == "Stage 1/3: Classifying document"
    
    def test_get_upload_status_completed(self, authenticated_client, test_account, db_session):
        """Test status endpoint shows completed with data"""
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
        
        response = authenticated_client.get(f"/api/v1/upload/{pdf.id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["extraction_status"] == "completed"
        assert data["extraction_confidence"] == 0.95
    
    def test_get_upload_status_failed(self, authenticated_client, test_account, db_session):
        """Test status endpoint shows failed with error"""
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="failed",
            extracted_data={"error": "Processing failed"}
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/upload/{pdf.id}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["extraction_status"] == "failed"
    
    def test_get_upload_status_not_found(self, authenticated_client):
        """Test 404 for non-existent upload"""
        response = authenticated_client.get("/api/v1/upload/99999/status")
        
        assert response.status_code == 404
    
    def test_get_upload_status_unauthorized(self, authenticated_client, db_session):
        """Test can't see other user's upload status"""
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
        
        response = authenticated_client.get(f"/api/v1/upload/{other_pdf.id}/status")
        
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
        
        response = authenticated_client.post(f"/api/v1/upload/{pdf.id}/retry")
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Extraction retry queued"
        assert data["pdf_id"] == pdf.id
    
    def test_retry_extraction_wrong_status(self, authenticated_client, test_account, db_session):
        """Test can only retry failed uploads"""
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            extraction_status="completed"  # Already completed
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.post(f"/api/v1/upload/{pdf.id}/retry")
        
        assert response.status_code == 400
        assert "Can only retry failed uploads" in response.json()["detail"]
    
    def test_get_pdf_details_success(self, authenticated_client, test_account, db_session):
        """Test getting PDF details with extraction data"""
        pdf = PDF(
            account_id=test_account.id,
            original_filename="test.pdf",
            file_path="/tmp/test.pdf",
            file_size=1024,
            extraction_status="completed",
            extracted_data={"doc_type": "bank_statement", "institution": {"name": "Chase"}},
            extraction_confidence=0.95,
            doc_type="bank_statement"
        )
        db_session.add(pdf)
        db_session.commit()
        
        response = authenticated_client.get(f"/api/v1/upload/{pdf.id}/details")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == pdf.id
        assert data["original_filename"] == "test.pdf"
        assert data["extraction_status"] == "completed"
        assert data["doc_type"] == "bank_statement"
        assert data["extracted_data"]["institution"]["name"] == "Chase"
    
    def test_get_pdf_details_not_found(self, authenticated_client):
        """Test 404 for non-existent PDF details"""
        response = authenticated_client.get("/api/v1/upload/99999/details")
        
        assert response.status_code == 404
    
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
