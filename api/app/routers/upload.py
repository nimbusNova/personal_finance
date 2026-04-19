"""File upload router"""
import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List

from app.database.connection import get_supabase_client, get_supabase_admin
from app.config import get_settings
from app.routers.auth import get_current_user

router = APIRouter()


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    account_id: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Upload a PDF statement"""
    settings = get_settings()
    
    # Validate file type
    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_path = f"{current_user['id']}/{account_id or 'unassigned'}/{file_id}.pdf"
    
    # Upload to Supabase Storage
    try:
        admin_client = get_supabase_admin()
        file_content = await file.read()
        
        result = admin_client.storage.from_(settings.storage_bucket).upload(
            file_path,
            file_content,
            file_options={"content-type": "application/pdf"}
        )
        
        # Save metadata to database
        db_client = get_supabase_client()
        pdf_record = {
            "account_id": account_id,
            "file_path": file_path,
            "file_size": len(file_content),
            "extraction_status": "pending"
        }
        db_result = db_client.table("pdfs").insert(pdf_record).execute()
        
        return {
            "message": "Upload successful",
            "pdf_id": db_result.data[0]["id"],
            "file_path": file_path,
            "status": "pending_extraction"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload/batch")
async def upload_batch(
    files: List[UploadFile] = File(...),
    account_id: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Upload multiple PDFs at once"""
    results = []
    for file in files:
        try:
            result = await upload_pdf(file, account_id, current_user)
            results.append({"filename": file.filename, "status": "success", "data": result})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "error": str(e)})
    
    return {"results": results}


@router.get("/uploads")
async def list_uploads(
    account_id: int = None,
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List uploaded PDFs"""
    client = get_supabase_client()
    
    # Join with accounts to get user's uploads
    query = client.table("pdfs").select("*, accounts!inner(user_id)").eq("accounts.user_id", current_user["id"])
    
    if account_id:
        query = query.eq("account_id", account_id)
    if status:
        query = query.eq("extraction_status", status)
    
    result = query.order("created_at", desc=True).execute()
    
    return {"uploads": result.data}