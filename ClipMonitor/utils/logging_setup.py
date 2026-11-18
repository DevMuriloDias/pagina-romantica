"""Logs em arquivo rotativo + console, com remoção de segredos.

Nenhum segredo deve chegar ao disco: o ``RedactingFilter`` substitui por
``***`` tanto os valores registrados em tempo de execução (Client Secret,
token) quanto padrões comuns (``Authorization: Bearer …``, ``access_token=…``).
"""
from __future__ import annotations

import logging
import re
import threading
from collections import deque
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_FILE = "clipmonitor.log"
_PATTERNS = [
    re.compile(r"(?i)(authorization['\"]?\s*[:=]\s*['\"]?(?:bearer|oauth)\s+)[^\s'\",}]+"),
    re.compile(r"(?i)((?:access_token|client_secret|refresh_token)['\"]?\s*[:=]\s*['\"]?)[^\s'\"&,}]+"),
]


class RedactingFilter(logging.Filter):
    _secrets: set[str] = set()
    _lock = threading.Lock()

    @classmethod
    def register(cls, *values: str | None) -> None:
        with cls._lock:
            cls._secrets.update(v for v in values if v and len(v) >= 6)

    @classmethod
    def redact(cls, text: str) -> str:
        with cls._lock:
            secrets = sorted(cls._secrets, key=len, reverse=True)
        for value in secrets:
            text = text.replace(value, "***")
        for pattern in _PATTERNS:
            text = pattern.sub(r"\1***", text)
        return text

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if record.exc_info and not record.exc_text:
            record.exc_text = logging.Formatter().formatException(record.exc_info)
        record.msg, record.args = self.redact(message), None
        if record.exc_text:
            record.exc_text = self.redact(record.exc_text)
        return True


def register_secret(*values: str | None) -> None:
    RedactingFilter.register(*values)


def setup_logging(log_dir: Path, level: int = logging.INFO) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / LOG_FILE
    root = logging.getLogger()
    root.setLevel(level)
    if any(getattr(h, "_clipmonitor", False) for h in root.handlers):
        return path
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(threadName)s %(name)s: %(message)s")
    redact = RedactingFilter()
    file_handler = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
    console = logging.StreamHandler()
    for h in (file_handler, console):
        h.setFormatter(fmt)
        h.addFilter(redact)
        h._clipmonitor = True  # type: ignore[attr-defined]
        root.addHandler(h)
    # Bibliotecas de rede em DEBUG imprimem URLs/cabeçalhos: mantê-las em WARNING.
    for noisy in ("urllib3", "requests", "httpx", "faster_whisper", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    return path


def tail(path: Path, lines: int = 400) -> list[str]:
    try:
        with path.open(encoding="utf-8", errors="replace") as fh:
            return list(deque(fh, maxlen=lines))
    except OSError:
        return []
