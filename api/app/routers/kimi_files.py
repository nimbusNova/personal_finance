"""Kimi (Moonshot AI) file management router — proxy to upstream API."""
import logging
from fastapi import APIRouter, HTTPException

from app.services.kimi_service import get_kimi_service

router = APIRouter()
logger = logging.getLogger("api.kimi_files")


@router.get("/kimi-files")
async def list_kimi_files():
    """List files uploaded to the Moonshot AI platform."""
    logger.info("List Kimi files requested")
    try:
        service = get_kimi_service()
        response = service.client.get("/files")
        response.raise_for_status()
        data = response.json()
        logger.info(f"Listed {len(data.get('data', []))} Kimi files")
        return data
    except Exception as exc:
        logger.error(f"Failed to list Kimi files: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}")


@router.delete("/kimi-files/{file_id}")
async def delete_kimi_file(file_id: str):
    """Delete a file from the Moonshot AI platform."""
    logger.info(f"Delete Kimi file requested: {file_id}")
    try:
        service = get_kimi_service()
        response = service.client.delete(f"/files/{file_id}")
        response.raise_for_status()
        logger.info(f"Deleted Kimi file: {file_id}")
        return {"message": "File deleted", "file_id": file_id}
    except Exception as exc:
        logger.error(f"Failed to delete Kimi file {file_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}")
