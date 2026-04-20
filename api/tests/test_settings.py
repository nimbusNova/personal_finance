"""Tests for settings router and service"""
import os
import json
import pytest
import tempfile
from unittest.mock import patch

from app.services.settings_service import (
    read_settings,
    write_settings,
    get_user_name,
    get_kimi_api_key,
    SETTINGS_FILE,
)


@pytest.mark.unit
class TestSettingsService:
    """Tests for settings_service.py"""

    def test_read_settings_default(self, monkeypatch):
        """Test reading settings when file doesn't exist"""
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setattr(
                "app.services.settings_service.SETTINGS_FILE",
                os.path.join(tmpdir, "settings.json"),
            )
            data = read_settings()
            assert data == {"user_name": "", "kimi_api_key": ""}

    def test_write_and_read_settings(self, monkeypatch):
        """Test writing and reading settings"""
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setattr(
                "app.services.settings_service.SETTINGS_FILE",
                os.path.join(tmpdir, "settings.json"),
            )
            write_settings({"user_name": "Alice", "kimi_api_key": "sk-abc123"})
            data = read_settings()
            assert data["user_name"] == "Alice"
            assert data["kimi_api_key"] == "sk-abc123"

    def test_get_user_name(self, monkeypatch):
        """Test get_user_name helper"""
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setattr(
                "app.services.settings_service.SETTINGS_FILE",
                os.path.join(tmpdir, "settings.json"),
            )
            write_settings({"user_name": "Bob", "kimi_api_key": ""})
            assert get_user_name() == "Bob"

    def test_get_kimi_api_key_from_settings(self, monkeypatch):
        """Test API key priority: settings.json over .env"""
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setattr(
                "app.services.settings_service.SETTINGS_FILE",
                os.path.join(tmpdir, "settings.json"),
            )
            write_settings({"user_name": "", "kimi_api_key": "sk-from-settings"})
            assert get_kimi_api_key() == "sk-from-settings"

    @patch("app.services.settings_service.get_settings")
    def test_get_kimi_api_key_fallback_to_env(self, mock_get_settings, monkeypatch):
        """Test API key falls back to .env when settings.json is empty"""
        mock_get_settings.return_value.kimi_api_key = "fallback-key"
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setattr(
                "app.services.settings_service.SETTINGS_FILE",
                os.path.join(tmpdir, "settings.json"),
            )
            write_settings({"user_name": "", "kimi_api_key": ""})
            # Should fall back to env key
            assert get_kimi_api_key() == "fallback-key"


@pytest.mark.integration
class TestSettingsRouter:
    """Tests for settings router endpoints"""

    def test_get_settings_default(self, client):
        """Test GET /settings returns defaults"""
        response = client.get("/api/v1/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["user_name"] == ""
        assert data["kimi_api_key"] == ""
        assert data["has_api_key"] is False

    def test_post_settings(self, client):
        """Test POST /settings updates settings"""
        response = client.post(
            "/api/v1/settings",
            json={"user_name": "Test User", "kimi_api_key": "sk-test123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_name"] == "Test User"
        assert data["kimi_api_key"] == "sk-test123"
        assert data["has_api_key"] is True

    def test_post_settings_empty_key(self, client):
        """Test POST /settings with empty key sets has_api_key false"""
        response = client.post(
            "/api/v1/settings",
            json={"user_name": "Test", "kimi_api_key": ""},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_api_key"] is False

    def test_post_settings_persistence(self, client):
        """Test settings persist across requests"""
        client.post(
            "/api/v1/settings",
            json={"user_name": "Persistent", "kimi_api_key": "sk-persist"},
        )
        response = client.get("/api/v1/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["user_name"] == "Persistent"
        assert data["kimi_api_key"] == "sk-persist"
