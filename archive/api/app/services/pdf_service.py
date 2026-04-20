"""PDF service - local file storage"""
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import get_settings


def get_pdf_storage_path() -> str:
    """Get the base PDF storage path"""
    settings = get_settings()
    return settings.pdf_storage_path


def ensure_data_directories():
    """Ensure all data directories exist"""
    settings = get_settings()
    os.makedirs(settings.data_dir, exist_ok=True)
    os.makedirs(settings.pdf_storage_path, exist_ok=True)
    os.makedirs(settings.exports_path, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename for safe filesystem storage."""
    # Remove path traversal characters
    filename = os.path.basename(filename)
    # Replace unsafe characters with underscore
    filename = re.sub(r'[^\w\s.-]', '_', filename)
    # Collapse multiple underscores/spaces
    filename = re.sub(r'[_\s]+', '_', filename).strip('_')
    # Ensure it ends with .pdf
    if not filename.lower().endswith('.pdf'):
        filename += '.pdf'
    return filename


def generate_pdf_path(original_filename: str) -> tuple[str, str]:
    """
    Generate storage path for a PDF file using the original filename.
    Returns: (file_path, file_id)
    
    Format: data/pdfs/{year}/{month}/{sanitized_filename}
    If a file with the same name exists, appends _{n} before .pdf.
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    
    base_path = get_pdf_storage_path()
    dir_path = os.path.join(base_path, year, month)
    os.makedirs(dir_path, exist_ok=True)
    
    sanitized = sanitize_filename(original_filename)
    name_part = sanitized[:-4]  # Remove .pdf
    
    # Handle collisions
    file_path = os.path.join(dir_path, sanitized)
    counter = 1
    while os.path.exists(file_path):
        collision_name = f"{name_part}_{counter}.pdf"
        file_path = os.path.join(dir_path, collision_name)
        counter += 1
    
    file_id = str(uuid.uuid4())
    return file_path, file_id


def save_pdf_file(file_content: bytes, file_path: str) -> int:
    """
    Save PDF file to local storage
    Returns: file_size in bytes
    """
    ensure_data_directories()
    
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    return len(file_content)


def read_pdf_file(file_path: str) -> bytes:
    """Read PDF file from local storage"""
    with open(file_path, 'rb') as f:
        return f.read()


def delete_pdf_file(file_path: str) -> bool:
    """Delete PDF file from local storage"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
    except Exception:
        pass
    return False


def get_pdf_url(file_path: str) -> str:
    """
    Get a local file URL for the PDF
    For local usage, this returns a file:// URL or relative path
    """
    # Convert to absolute path for Kimi API
    abs_path = os.path.abspath(file_path)
    return f"file://{abs_path}"


def get_storage_stats() -> dict:
    """Get statistics about PDF storage"""
    base_path = get_pdf_storage_path()
    
    total_size = 0
    total_files = 0
    
    if os.path.exists(base_path):
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.endswith('.pdf'):
                    file_path = os.path.join(root, file)
                    total_size += os.path.getsize(file_path)
                    total_files += 1
    
    return {
        "total_files": total_files,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "storage_path": base_path
    }