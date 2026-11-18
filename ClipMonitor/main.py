"""Ponto de entrada do ClipMonitor.

Uso:
    python main.py              abre normalmente
    python main.py --minimized  abre minimizado (usado pela inicialização com o Windows)
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Garante imports absolutos (config, database, ...) ao executar de qualquer pasta.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings as cfg  # noqa: E402
from utils.errors import friendly, install_global_handlers  # noqa: E402
from utils.logging_setup import setup_logging  # noqa: E402
from utils.single_instance import AlreadyRunning, SingleInstance  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="ClipMonitor", description="Monitor de clipes para lives autorizadas.")
    parser.add_argument("--minimized", action="store_true", help="abrir minimizado na barra de tarefas")
    parser.add_argument("--no-monitor", action="store_true", help="não iniciar o monitoramento automaticamente")
    return parser.parse_args(argv)


def _enable_dpi_awareness() -> None:
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:  # noqa: BLE001
            pass


def _fatal_dialog(title: str, message: str) -> None:
    """Mostra o erro mesmo sem a interface principal (ex.: falha ao abrir o banco)."""
    try:
        import tkinter
        from tkinter import messagebox

        root = tkinter.Tk()
        root.withdraw()
        messagebox.showerror(title, message)
        root.destroy()
    except Exception:  # noqa: BLE001 - sem display: o log já tem os detalhes
        print(f"{title}: {message}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    cfg.ensure_directories()
    log_path = setup_logging(cfg.LOG_DIR)
    log = logging.getLogger("clipmonitor")
    install_global_handlers()
    log.info("Iniciando %s %s (Python %s)", cfg.APP_NAME, cfg.APP_VERSION, sys.version.split()[0])

    try:
        lock = SingleInstance(cfg.DATA_DIR / "clipmonitor.lock").acquire()
    except AlreadyRunning:
        log.info("Outra instância já está aberta; encerrando.")
        _fatal_dialog(cfg.APP_NAME, "O ClipMonitor já está aberto. Procure o ícone na barra de tarefas.")
        return 0

    try:
        from services.container import build_context

        ctx = build_context()
        cfg.ensure_directories(ctx.settings_repo.load().output_dir)
        _enable_dpi_awareness()

        from ui.app import ClipMonitorApp

        app = ClipMonitorApp(ctx, start_minimized=args.minimized, allow_auto_monitor=not args.no_monitor)
        app.mainloop()
        return 0
    except Exception as exc:  # noqa: BLE001
        log.critical("Falha ao iniciar o ClipMonitor", exc_info=True)
        _fatal_dialog(f"{cfg.APP_NAME} — erro", f"{friendly(exc)}\n\nDetalhes no registro:\n{log_path}")
        return 1
    finally:
        lock.release()


if __name__ == "__main__":
    raise SystemExit(main())
