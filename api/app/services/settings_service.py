"""Read/write app settings from JSON file."""
import json
import os
from app.config import get_settings

SETTINGS_FILE = os.path.join(get_settings().data_dir, "settings.json")


def _ensure_dir():
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)


def read_settings() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        return {"user_name": "", "kimi_api_key": ""}
    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)


def write_settings(data: dict) -> dict:
    _ensure_dir()
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return data


def get_user_name() -> str:
    return read_settings().get("user_name", "")


def get_kimi_api_key() -> str:
    """Return Kimi API key. Priority: settings.json > .env fallback."""
    from_settings = read_settings().get("kimi_api_key", "")
    if from_settings:
        return from_settings
    return get_settings().kimi_api_key
