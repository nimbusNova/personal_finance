"""File upload router - local storage with SQLite"""
import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.database.models import PDF, Account
from app.routers.auth import get_current_user
from app.services.pdf_service import (
    generate_pdf_path,
    save_pdf_file,
    get_storage_stats
)

router = APIRouter()


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    account_id: int = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a PDF statement to local storage"""
    # Validate file type
    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    # Verify account ownership if account_id provided
    if account_id:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == current_user.id
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Generate local file path
        file_path, file_id = generate_pdf_path(file_content)
        
        # Save to local storage
        save_pdf_file(file_content, file_path)
        
        # Save metadata to database
        pdf = PDF(
            account_id=account_id,
            file_path=file_path,
            file_size=file_size,
            extraction_status="pending"
        )
        db.add(pdf)
        db.commit()
        db.refresh(pdf)
        
        return {
            "message": "Upload successful",
            "pdf_id": pdf.id,
            "file_path": file_path,
            "file_size": file_size,
            "status": "pending_extraction"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload/batch")
async def upload_batch(
    files: List[UploadFile] = File(...),
    account_id: int = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple PDFs at once"""
    results = []
    for file in files:
        try:
            result = await upload_pdf(file, account_id, current_user, db)
            results.append({"filename": file.filename, "status": "success", "data": result})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "error": str(e)})
    
    return {"results": results}


@router.get("/uploads")
async def list_uploads(
    account_id: int = None,
    status: str = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List uploaded PDFs for current user"""
    # Query PDFs joined with accounts to verify ownership
    query = db.query(PDF).join(Account).filter(Account.user_id == current_user.id)
    
    if account_id:
        query = query.filter(PDF.account_id == account_id)
    if status:
        query = query.filter(PDF.extraction_status == status)
    
    pdfs = query.order_by(PDF.created_at.desc()).all()
    
    return {
        "uploads": [
            {
                "id": pdf.id,
                "account_id": pdf.account_id,
                "file_path": pdf.file_path,
                "file_size": pdf.file_size,
                "doc_type": pdf.doc_type,
                "extraction_status": pdf.extraction_status,
                "extraction_confidence": pdf.extraction_confidence,
                "created_at": pdf.created_at
            }
            for pdf in pdfs
        ]
    }


@router.get("/uploads/stats")
async def upload_stats(current_user = Depends(get_current_user)):
    """Get storage statistics"""
    return get_storage_stats()