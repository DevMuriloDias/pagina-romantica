"""Configuração de logs em arquivo rotativo + console."""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(log_dir: Path, level: int = logging.INFO) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    root = logging.getLogger()
    root.setLevel(level)
    if any(getattr(h, "_clipmonitor", False) for h in root.handlers):
        return
    file_handler = RotatingFileHandler(
        log_dir / "clipmonitor.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(fmt)
    file_handler._clipmonitor = True  # type: ignore[attr-defined]
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    console._clipmonitor = True  # type: ignore[attr-defined]
    root.addHandler(file_handler)
    root.addHandler(console)
    # Evita vazar URLs com tokens em nível DEBUG.
    logging.getLogger("urllib3").setLevel(logging.WARNING)
