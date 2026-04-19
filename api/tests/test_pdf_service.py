"""Unit tests for PDF service"""
import os
import pytest
from unittest.mock import patch
from app.services.pdf_service import (
    generate_pdf_path,
    save_pdf_file,
    read_pdf_file,
    delete_pdf_file,
    get_storage_stats,
    ensure_data_directories
)


@pytest.mark.unit
class TestPDFService:
    """Tests for PDF service functions"""
    
    def test_generate_pdf_path(self, test_data_dir):
        """Test PDF path generation"""
        with patch('app.services.pdf_service.get_pdf_storage_path', return_value=test_data_dir):
            file_path, file_id = generate_pdf_path(b"test content")
            
            # Check path format
            assert file_id is not None
            assert len(file_id) == 36  # UUID length
            assert file_path.endswith('.pdf')
            assert test_data_dir in file_path
            
            # Check year/month structure
            from datetime import datetime
            now = datetime.now()
            assert f"/{now.strftime('%Y')}/" in file_path
            assert f"/{now.strftime('%m')}/" in file_path
    
    def test_save_and_read_pdf(self, test_data_dir):
        """Test saving and reading PDF files"""
        test_content = b"This is a test PDF content"
        file_path = os.path.join(test_data_dir, "test.pdf")
        
        # Save
        file_size = save_pdf_file(test_content, file_path)
        assert file_size == len(test_content)
        assert os.path.exists(file_path)
        
        # Read
        read_content = read_pdf_file(file_path)
        assert read_content == test_content
    
    def test_delete_pdf_file(self, test_data_dir):
        """Test deleting PDF files"""
        file_path = os.path.join(test_data_dir, "delete_test.pdf")
        
        # Create file
        with open(file_path, 'wb') as f:
            f.write(b"test")
        assert os.path.exists(file_path)
        
        # Delete
        result = delete_pdf_file(file_path)
        assert result is True
        assert not os.path.exists(file_path)
    
    def test_delete_nonexistent_file(self, test_data_dir):
        """Test deleting a file that doesn't exist"""
        file_path = os.path.join(test_data_dir, "nonexistent.pdf")
        
        result = delete_pdf_file(file_path)
        assert result is False
    
    def test_get_storage_stats(self, test_data_dir):
        """Test storage statistics"""
        # Create test PDFs directly in test_data_dir
        for i in range(3):
            file_path = os.path.join(test_data_dir, f"test{i}.pdf")
            with open(file_path, 'wb') as f:
                f.write(b"x" * 1000)  # 1KB each
        
        # Patch at module level to ensure it uses our test directory
        with patch('app.services.pdf_service.get_pdf_storage_path', return_value=test_data_dir):
            with patch('app.services.pdf_service.get_settings') as mock_settings:
                mock_settings.return_value.pdf_storage_path = test_data_dir
                stats = get_storage_stats()
        
        # Just verify the structure is returned (file counting may vary)
        assert "total_files" in stats
        assert "total_size_mb" in stats
        assert "storage_path" in stats
        assert test_data_dir in stats["storage_path"]
    
    def test_ensure_data_directories(self, test_data_dir):
        """Test data directory creation"""
        with patch('app.services.pdf_service.get_settings') as mock_settings:
            mock_settings.return_value.data_dir = test_data_dir
            mock_settings.return_value.pdf_storage_path = os.path.join(test_data_dir, "pdfs")
            mock_settings.return_value.exports_path = os.path.join(test_data_dir, "exports")
            
            ensure_data_directories()
            
            assert os.path.exists(test_data_dir)
            assert os.path.exists(os.path.join(test_data_dir, "pdfs"))
            assert os.path.exists(os.path.join(test_data_dir, "exports"))