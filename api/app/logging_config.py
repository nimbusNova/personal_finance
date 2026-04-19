"""Structured logging configuration for the FastAPI backend."""
import logging
import sys
from pathlib import Path
from datetime import datetime

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class UploadLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that prepends [upload_id=X] to every message for traceability."""

    def process(self, msg, kwargs):
        upload_id = self.extra.get("upload_id")
        if upload_id is not None:
            msg = f"[upload_id={upload_id}] {msg}"
        return msg, kwargs


def get_upload_logger(base_logger: logging.Logger, upload_id: int | None) -> logging.LoggerAdapter:
    """Wrap a logger with upload_id context for debugging."""
    return UploadLoggerAdapter(base_logger, {"upload_id": upload_id})


def setup_logging(log_dir: str | None = None, log_to_file: bool = True):
    """Configure root logger with console and optional file handlers."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Remove existing handlers to avoid duplicates on reload
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.DEBUG)
    console.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(console)

    # File handler
    if log_to_file and log_dir:
        path = Path(log_dir)
        path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = path / f"api_{timestamp}.log"
        file_handler = logging.FileHandler(log_file, mode="a")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))
        root.addHandler(file_handler)
        logging.info(f"API logging to file: {log_file}")

    # Reduce noise from third-party libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
