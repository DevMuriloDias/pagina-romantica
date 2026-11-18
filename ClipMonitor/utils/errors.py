"""Captura de exceções não tratadas (qualquer thread) para log + aviso na UI."""
from __future__ import annotations

import logging
import sys
import threading
from typing import Callable

log = logging.getLogger("clipmonitor.erros")


def install_global_handlers(on_error: Callable[[BaseException], None] | None = None) -> None:
    notify = on_error or (lambda exc: None)

    def _notify(exc: BaseException) -> None:
        try:
            notify(exc)
        except Exception:  # noqa: BLE001 - o aviso não pode gerar outro erro
            pass

    def excepthook(exc_type, exc, tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc, tb)
            return
        log.critical("Erro não tratado", exc_info=(exc_type, exc, tb))
        _notify(exc)

    def thread_hook(args: threading.ExceptHookArgs) -> None:
        if args.exc_type is SystemExit:
            return
        log.error("Erro não tratado na thread %s", args.thread.name if args.thread else "?",
                  exc_info=(args.exc_type, args.exc_value, args.exc_traceback))
        if args.exc_value is not None:
            _notify(args.exc_value)

    sys.excepthook = excepthook
    threading.excepthook = thread_hook


def friendly(exc: BaseException) -> str:
    """Mensagem curta em português para exibir ao usuário."""
    if isinstance(exc, MemoryError):
        return "Memória insuficiente. Feche outros programas ou use um modelo Whisper menor."
    if isinstance(exc, PermissionError):
        return "Sem permissão para acessar um arquivo ou pasta (pode estar aberto em outro programa)."
    if isinstance(exc, FileNotFoundError):
        return f"Arquivo não encontrado: {getattr(exc, 'filename', '') or exc}"
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == 28:
        return "Disco cheio. Libere espaço ou reduza o tempo de retenção das gravações."
    text = str(exc).strip()
    return text if text and len(text) < 200 else exc.__class__.__name__
