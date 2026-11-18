"""Monitor em segundo plano: verifica o status ao vivo periodicamente.

Roda em uma thread daemon própria e se comunica com a UI apenas por
callbacks (a UI é responsável por reagendar no thread do Tk).
Implementa backoff exponencial em falhas e respeita o rate limit da Twitch.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable

from models.live_status import LiveCheckResult
from monitoring.live_checker import LiveStatusChecker
from twitch.errors import TwitchAuthError, TwitchError, TwitchRateLimitError

log = logging.getLogger(__name__)

MAX_BACKOFF = 15 * 60


class MonitorService:
    def __init__(
        self,
        checker: LiveStatusChecker,
        helix_provider: Callable[[], object],
        interval_provider: Callable[[], int],
        on_result: Callable[[LiveCheckResult], None] | None = None,
        on_state: Callable[[bool], None] | None = None,
    ):
        self.checker = checker
        self.helix_provider = helix_provider
        self.interval_provider = interval_provider
        self.on_result = on_result or (lambda r: None)
        self.on_state = on_state or (lambda running: None)
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._check_lock = threading.Lock()
        self._failures = 0

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        if self.running:
            return
        self._stop.clear()
        self._failures = 0
        self._thread = threading.Thread(target=self._loop, name="LiveMonitor", daemon=True)
        self._thread.start()
        self.on_state(True)
        log.info("Monitoramento iniciado")

    def stop(self, timeout: float = 5.0) -> None:
        if not self.running:
            return
        self._stop.set()
        self._wake.set()
        if self._thread is not threading.current_thread():
            self._thread.join(timeout)
        self._thread = None
        self.on_state(False)
        log.info("Monitoramento parado")

    def trigger_now(self) -> None:
        """Antecipa a próxima verificação (se o monitor estiver rodando)."""
        self._wake.set()

    def check_once(self) -> LiveCheckResult:
        """Executa uma verificação síncrona (usada pelo botão 'Verificar agora')."""
        with self._check_lock:
            helix = self.helix_provider()
            if helix is None:
                raise TwitchAuthError("Configure as credenciais da Twitch nas Configurações.")
            return self.checker.check(helix)

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.clear()
            delay = max(1, int(self.interval_provider()))
            try:
                result = self.check_once()
                self._failures = 0
            except TwitchRateLimitError as exc:
                result = LiveCheckResult(0, 0, error=str(exc))
                delay = max(delay, int((exc.reset_at or time.time() + 60) - time.time()) + 1)
            except TwitchAuthError as exc:
                result = LiveCheckResult(0, 0, error=str(exc))
                delay = max(delay, 300)
            except TwitchError as exc:
                self._failures += 1
                result = LiveCheckResult(0, 0, error=str(exc))
                delay = min(MAX_BACKOFF, delay * (2 ** min(self._failures, 5)))
            except Exception as exc:  # noqa: BLE001 - o monitor nunca pode morrer silenciosamente
                log.exception("Erro inesperado no monitor")
                self._failures += 1
                result = LiveCheckResult(0, 0, error=f"Erro inesperado: {exc}")
                delay = min(MAX_BACKOFF, delay * (2 ** min(self._failures, 5)))
            try:
                self.on_result(result)
            except Exception:  # noqa: BLE001
                log.exception("Falha no callback do monitor")
            self._wake.wait(delay)
