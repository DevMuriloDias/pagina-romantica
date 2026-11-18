"""Execução de tarefas em segundo plano com retorno seguro para a UI.

O Tkinter não é thread-safe: workers nunca tocam em widgets. Resultados são
enfileirados e drenados no thread principal por ``UiDispatcher.pump`` (chamado
periodicamente via ``widget.after``).
"""
from __future__ import annotations

import logging
import queue
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any, Callable

log = logging.getLogger(__name__)


class UiDispatcher:
    def __init__(self) -> None:
        self._queue: "queue.SimpleQueue[Callable[[], None]]" = queue.SimpleQueue()

    def post(self, fn: Callable[..., None], *args: Any) -> None:
        """Agenda ``fn(*args)`` para rodar no thread da UI. Seguro de qualquer thread."""
        self._queue.put(lambda: fn(*args))

    def pump(self, max_items: int = 100) -> int:
        """Executa callbacks pendentes. Deve ser chamado no thread da UI."""
        count = 0
        while count < max_items:
            try:
                fn = self._queue.get_nowait()
            except queue.Empty:
                break
            try:
                fn()
            except Exception:  # noqa: BLE001
                log.exception("Erro em callback da UI")
            count += 1
        return count


class TaskRunner:
    """Pool pequeno (CPU i3 de 4 núcleos): tarefas de rede/IO da Fase 1."""

    def __init__(self, dispatcher: UiDispatcher, max_workers: int = 2):
        self.dispatcher = dispatcher
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="clipmonitor")

    def submit(
        self,
        fn: Callable[[], Any],
        on_success: Callable[[Any], None] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
    ) -> Future:
        future = self._pool.submit(fn)

        def _done(f: Future) -> None:
            exc = f.exception()
            if exc is not None:
                if not isinstance(exc, ValueError):
                    log.error("Tarefa falhou", exc_info=exc)
                if on_error:
                    self.dispatcher.post(on_error, exc)
            elif on_success:
                self.dispatcher.post(on_success, f.result())

        future.add_done_callback(_done)
        return future

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)
