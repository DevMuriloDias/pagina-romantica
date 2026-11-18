"""Ponto de entrada do ClipMonitor.

Uso:  python main.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Garante imports absolutos (config, database, ...) ao executar de qualquer pasta.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings as cfg  # noqa: E402
from utils.logging_setup import setup_logging  # noqa: E402


def _enable_dpi_awareness() -> None:
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:  # noqa: BLE001
            pass


def main() -> int:
    cfg.ensure_directories()
    setup_logging(cfg.LOG_DIR)
    log = logging.getLogger("clipmonitor")
    log.info("Iniciando %s %s", cfg.APP_NAME, cfg.APP_VERSION)

    from services.container import build_context

    ctx = build_context()
    cfg.ensure_directories(ctx.settings_repo.load().output_dir)
    _enable_dpi_awareness()

    from ui.app import ClipMonitorApp

    app = ClipMonitorApp(ctx)
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
