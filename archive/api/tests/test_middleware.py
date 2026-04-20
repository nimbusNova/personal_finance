"""Tests for middleware"""
import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import Request, Response

from app.middleware import LoggingMiddleware


@pytest.mark.unit
class TestLoggingMiddleware:
    """Tests for LoggingMiddleware"""
    
    def test_middleware_logs_request_response(self):
        """Test middleware logs requests and responses"""
        middleware = LoggingMiddleware(app=MagicMock())
        
        # Mock request
        request = MagicMock(spec=Request)
        request.method = "GET"
        request.url.path = "/api/v1/health"
        request.client.host = "127.0.0.1"
        
        # Mock response
        mock_response = MagicMock(spec=Response)
        mock_response.status_code = 200
        
        # Mock call_next as async function
        async def mock_call_next(request):
            return mock_response
        
        with patch("app.middleware.logger") as mock_logger:
            # Run async function
            response = asyncio.run(middleware.dispatch(request, mock_call_next))
            
            assert response == mock_response
            # Should log both request and response
            assert mock_logger.debug.call_count >= 1
    
    def test_middleware_logs_exception(self):
        """Test middleware logs exceptions"""
        middleware = LoggingMiddleware(app=MagicMock())
        
        # Mock request
        request = MagicMock(spec=Request)
        request.method = "GET"
        request.url.path = "/api/v1/error"
        request.client.host = "127.0.0.1"
        
        # Mock call_next that raises exception
        async def mock_call_next(request):
            raise ValueError("Test error")
        
        with patch("app.middleware.logger") as mock_logger:
            with pytest.raises(ValueError, match="Test error"):
                asyncio.run(middleware.dispatch(request, mock_call_next))
            
            # Should log error
            assert mock_logger.error.call_count >= 1
    
    def test_middleware_handles_unknown_client(self):
        """Test middleware handles request without client info"""
        middleware = LoggingMiddleware(app=MagicMock())
        
        # Mock request with no client
        request = MagicMock(spec=Request)
        request.method = "POST"
        request.url.path = "/api/v1/upload"
        request.client = None
        
        mock_response = MagicMock(spec=Response)
        mock_response.status_code = 201
        
        async def mock_call_next(request):
            return mock_response
        
        with patch("app.middleware.logger") as mock_logger:
            response = asyncio.run(middleware.dispatch(request, mock_call_next))
            assert response == mock_response