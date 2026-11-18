"""Barramento de eventos em memória (publicação/assinatura, thread-safe).

Os assinantes são chamados no thread de quem publica (o worker de
monitoramento); assinantes de UI devem repassar ao ``UiDispatcher``.
Uma exceção em um assinante nunca afeta os demais nem o monitor.
"""
from __future__ import annotations

import logging
import threading
from collections import defaultdict
from typing import Callable

from models.events import StreamEvent, StreamEventType

log = logging.getLogger(__name__)

Handler = Callable[[StreamEvent], None]


class EventBus:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._handlers: dict[StreamEventType | None, list[Handler]] = defaultdict(list)

    def subscribe(self, handler: Handler, *types: StreamEventType) -> Callable[[], None]:
        """Assina eventos dos tipos dados (nenhum = todos). Retorna função para cancelar."""
        keys = list(types) or [None]
        with self._lock:
            for k in keys:
                self._handlers[k].append(handler)

        def unsubscribe() -> None:
            with self._lock:
                for k in keys:
                    if handler in self._handlers[k]:
                        self._handlers[k].remove(handler)

        return unsubscribe

    def publish(self, event: StreamEvent) -> None:
        with self._lock:
            handlers = list(self._handlers[event.type]) + list(self._handlers[None])
        for h in handlers:
            try:
                h(event)
            except Exception:  # noqa: BLE001
                log.exception("Falha em assinante do evento %s", event.type.value)
