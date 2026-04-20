"""Settings router — read/write local JSON settings."""
import logging
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.settings_service import read_settings, write_settings

router = APIRouter()
logger = logging.getLogger("api.settings")


class SettingsPayload(BaseModel):
    user_name: str
    kimi_api_key: str


class SettingsResponse(BaseModel):
    user_name: str
    kimi_api_key: str
    has_api_key: bool


@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Get current app settings."""
    data = read_settings()
    has_key = bool(data.get("kimi_api_key", "").strip())
    return {
        "user_name": data.get("user_name", ""),
        "kimi_api_key": data.get("kimi_api_key", ""),
        "has_api_key": has_key,
    }


@router.post("/settings", response_model=SettingsResponse)
async def update_settings(payload: SettingsPayload):
    """Update app settings."""
    logger.info(f"Settings updated: user_name={payload.user_name}")
    data = write_settings(
        {"user_name": payload.user_name, "kimi_api_key": payload.kimi_api_key}
    )
    has_key = bool(data.get("kimi_api_key", "").strip())
    return {
        "user_name": data["user_name"],
        "kimi_api_key": data["kimi_api_key"],
        "has_api_key": has_key,
    }


@router.post("/settings/test-key")
async def test_api_key():
    """Test the configured Kimi API key by listing available models."""
    from app.services.kimi_service import get_kimi_service

    try:
        service = get_kimi_service()
        resp = service.client.get("/models")
        resp.raise_for_status()
        return {"valid": True}
    except Exception as exc:
        logger.warning(f"API key test failed: {exc}")
        return {"valid": False, "error": str(exc)}
