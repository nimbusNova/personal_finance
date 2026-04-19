"""File upload router - local storage with SQLite"""
import logging
import os
import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.database.models import PDF, Account, PortfolioSnapshot, Holding, Transaction, AccountBalance, ExtractionJob, ManualCorrection
from app.routers.auth import get_current_user
from app.services.pdf_service import (
    generate_pdf_path,
    save_pdf_file,
    get_storage_stats
)
from app.services.extraction_service import process_pdf_extraction
from app.logging_config import get_upload_logger

router = APIRouter()
logger = logging.getLogger("api.upload")


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    account_id: int = None,
    background_tasks: BackgroundTasks = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a PDF statement to local storage and trigger background extraction"""
    logger.info(f"Upload started: filename={file.filename}, account_id={account_id}, user={current_user.email}")
    if not file.content_type or "pdf" not in file.content_type:
        logger.warning(f"Upload rejected: invalid content_type={file.content_type}")
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    if account_id:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == current_user.id
        ).first()
        if not account:
            logger.warning(f"Upload rejected: account not found: {account_id}")
            raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        # Soft duplicate check: same filename for same account already processed or processing
        if account_id and file.filename:
            existing_pdf = db.query(PDF).filter(
                PDF.account_id == account_id,
                PDF.original_filename == file.filename,
                PDF.extraction_status.in_(["completed", "processing"])
            ).first()
            if existing_pdf:
                logger.info(f"Duplicate upload detected: existing_pdf_id={existing_pdf.id}, filename={file.filename}")
                return {
                    "message": "This file has already been uploaded for this account.",
                    "pdf_id": existing_pdf.id,
                    "original_filename": existing_pdf.original_filename,
                    "status": "duplicate",
                    "extraction_status": existing_pdf.extraction_status,
                }
        
        file_content = await file.read()
        file_size = len(file_content)
        logger.debug(f"File read: size={file_size} bytes")
        
        file_path, file_id = generate_pdf_path(file.filename or "document.pdf")
        logger.debug(f"Generated path: {file_path}")
        
        save_pdf_file(file_content, file_path)
        logger.debug(f"File saved to disk: {file_path}")
        
        pdf = PDF(
            account_id=account_id,
            original_filename=file.filename,
            file_path=file_path,
            file_size=file_size,
            extraction_status="pending"
        )
        db.add(pdf)
        db.commit()
        db.refresh(pdf)

        upload_id = pdf.id
        upload_logger = get_upload_logger(logger, upload_id)
        upload_logger.info(f"Upload complete: path={file_path}, user={current_user.email}")
        
        # Trigger background extraction
        if background_tasks is not None:
            background_tasks.add_task(process_pdf_extraction, pdf.id, file_path, current_user.id)
            upload_logger.info("Background extraction queued")
        
        return {
            "message": "Upload successful",
            "upload_id": upload_id,
            "pdf_id": pdf.id,
            "original_filename": pdf.original_filename,
            "file_path": file_path,
            "file_size": file_size,
            "status": "pending_extraction"
        }
        
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
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
    logger.debug(f"List uploads: user={current_user.email}, account_id={account_id}, status={status}")
    query = db.query(PDF).outerjoin(Account).filter(
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    )
    
    if account_id:
        query = query.filter(PDF.account_id == account_id)
    if status:
        query = query.filter(PDF.extraction_status == status)
    
    pdfs = query.order_by(PDF.created_at.desc()).all()
    logger.info(f"List uploads returned: {len(pdfs)} records for user={current_user.email}")
    
    return {
        "uploads": [
            {
                "id": pdf.id,
                "account_id": pdf.account_id,
                "original_filename": pdf.original_filename,
                "file_path": pdf.file_path,
                "file_size": pdf.file_size,
                "doc_type": pdf.doc_type,
                "extraction_status": pdf.extraction_status,
                "processing_step": pdf.processing_step,
                "extraction_confidence": pdf.extraction_confidence,
                "created_at": pdf.created_at
            }
            for pdf in pdfs
        ]
    }


@router.get("/uploads/{pdf_id}")
async def get_upload(
    pdf_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single PDF with extraction details"""
    pdf = db.query(PDF).outerjoin(Account).filter(
        PDF.id == pdf_id,
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    return {
        "id": pdf.id,
        "account_id": pdf.account_id,
        "original_filename": pdf.original_filename,
        "file_path": pdf.file_path,
        "file_size": pdf.file_size,
        "doc_type": pdf.doc_type,
        "extraction_status": pdf.extraction_status,
        "extraction_confidence": pdf.extraction_confidence,
        "extracted_data": pdf.extracted_data,
        "error_message": pdf.error_message,
        "created_at": pdf.created_at
    }


@router.post("/uploads/{pdf_id}/retry")
async def retry_extraction(
    pdf_id: int,
    background_tasks: BackgroundTasks = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retry extraction for a PDF"""
    upload_logger = get_upload_logger(logger, pdf_id)
    upload_logger.info(f"Retry extraction requested: user={current_user.email}")
    pdf = db.query(PDF).outerjoin(Account).filter(
        PDF.id == pdf_id,
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    if not os.path.exists(pdf.file_path):
        upload_logger.error(f"Retry failed: file not found on disk: {pdf.file_path}")
        raise HTTPException(status_code=400, detail="PDF file no longer exists on disk")
    
    pdf.extraction_status = "pending"
    pdf.processing_step = "Pending extraction"
    pdf.error_message = None
    pdf.extracted_data = None
    pdf.extraction_confidence = None
    db.commit()
    
    if background_tasks is not None:
        background_tasks.add_task(process_pdf_extraction, pdf.id, pdf.file_path, current_user.id)
        upload_logger.info("Background retry queued")
    
    return {
        "message": "Extraction retry queued",
        "pdf_id": pdf.id,
        "status": "pending"
    }


class ExtractedDataUpdate(BaseModel):
    extracted_data: dict


@router.get("/uploads/{pdf_id}/file")
async def get_pdf_file(
    pdf_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download/serve the original PDF file"""
    pdf = db.query(PDF).outerjoin(Account).filter(
        PDF.id == pdf_id,
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    ).first()

    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    if not os.path.exists(pdf.file_path):
        raise HTTPException(status_code=404, detail="PDF file no longer exists on disk")

    return FileResponse(
        pdf.file_path,
        media_type="application/pdf",
        filename=pdf.original_filename or os.path.basename(pdf.file_path)
    )


@router.patch("/uploads/{pdf_id}/extracted-data")
async def update_extracted_data(
    pdf_id: int,
    update: ExtractedDataUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update extracted_data JSON for a PDF (manual correction)"""
    upload_logger = get_upload_logger(logger, pdf_id)
    upload_logger.info(f"Update extracted data: user={current_user.email}")
    pdf = db.query(PDF).outerjoin(Account).filter(
        PDF.id == pdf_id,
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    ).first()

    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf.extracted_data = update.extracted_data
    db.commit()
    db.refresh(pdf)
    upload_logger.info("Extracted data updated")

    return {
        "id": pdf.id,
        "extraction_status": pdf.extraction_status,
        "extracted_data": pdf.extracted_data,
        "message": "Extracted data updated"
    }


@router.delete("/uploads/{pdf_id}")
async def delete_upload(
    pdf_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a PDF upload, its file on disk, and all derived data."""
    upload_logger = get_upload_logger(logger, pdf_id)
    upload_logger.info(f"Delete upload requested: user={current_user.email}")
    pdf = db.query(PDF).outerjoin(Account).filter(
        PDF.id == pdf_id,
        or_(Account.user_id == current_user.id, PDF.account_id.is_(None))
    ).first()

    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    # Delete derived data in order (respecting FK constraints)
    # 1. Holdings via PortfolioSnapshot cascade, but delete snapshots explicitly first
    snapshots = db.query(PortfolioSnapshot).filter(PortfolioSnapshot.pdf_id == pdf_id).all()
    for snap in snapshots:
        db.delete(snap)
    if snapshots:
        logger.info(f"Deleted {len(snapshots)} portfolio snapshots for PDF {pdf_id}")

    # 2. Transactions
    txn_count = db.query(Transaction).filter(Transaction.pdf_id == pdf_id).delete(synchronize_session=False)
    if txn_count:
        upload_logger.info(f"Deleted {txn_count} transactions")

    # 3. AccountBalances
    bal_count = db.query(AccountBalance).filter(AccountBalance.pdf_id == pdf_id).delete(synchronize_session=False)
    if bal_count:
        upload_logger.info(f"Deleted {bal_count} account balances")

    # 4. ExtractionJobs
    job_count = db.query(ExtractionJob).filter(ExtractionJob.pdf_id == pdf_id).delete(synchronize_session=False)
    if job_count:
        upload_logger.info(f"Deleted {job_count} extraction jobs")

    # 5. ManualCorrections
    mc_count = db.query(ManualCorrection).filter(ManualCorrection.pdf_id == pdf_id).delete(synchronize_session=False)
    if mc_count:
        upload_logger.info(f"Deleted {mc_count} manual corrections")

    # 6. Delete file from disk
    if pdf.file_path and os.path.exists(pdf.file_path):
        try:
            os.remove(pdf.file_path)
            upload_logger.info(f"Deleted file from disk: {pdf.file_path}")
        except Exception as e:
            upload_logger.warning(f"Failed to delete file from disk: {pdf.file_path}: {e}")

    # 7. Delete PDF record
    db.delete(pdf)
    db.commit()
    upload_logger.info("Deleted PDF record")

    return {"message": "Upload deleted", "pdf_id": pdf_id}


@router.get("/uploads/stats")
async def upload_stats(current_user = Depends(get_current_user)):
    """Get storage statistics"""
    return get_storage_stats()