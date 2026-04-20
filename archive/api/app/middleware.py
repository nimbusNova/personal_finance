"""Request/response logging middleware."""
import logging
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("api.middleware")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        client = request.client.host if request.client else "unknown"
        logger.debug(
            f"--> {request.method} {request.url.path} | client={client}"
        )

        try:
            response: Response = await call_next(request)
            duration = (time.time() - start) * 1000
            logger.debug(
                f"<-- {request.method} {request.url.path} | status={response.status_code} | {duration:.1f}ms"
            )
            return response
        except Exception as exc:
            duration = (time.time() - start) * 1000
            logger.error(
                f"<-- {request.method} {request.url.path} | ERROR={type(exc).__name__} | {duration:.1f}ms",
                exc_info=True,
            )
            raise
