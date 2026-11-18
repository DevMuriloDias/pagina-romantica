"""Worker de monitoramento em segundo plano.

- Thread daemon própria; nunca toca na UI (publica status por callback).
- Dorme até o próximo vencimento entre os streamers (intervalos individuais),
  acordando antes se ``trigger_now`` for chamado (ex.: configurações salvas).
- Backoff exponencial em falhas de rede, respeita ``Ratelimit-Reset`` e pausa
  longa em erro de credenciais (que exige ação do usuário).
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Callable

from config.settings import MAX_POLL_INTERVAL
from models.live_status import LiveCheckResult
from models.status import MonitorState, MonitorStatus
from monitoring.live_checker import LiveStatusChecker
from twitch.errors import TwitchAuthError, TwitchError, TwitchRateLimitError
from utils.timeutils import utcnow

log = logging.getLogger(__name__)

MIN_SLEEP = 5
MAX_BACKOFF = 15 * 60
AUTH_RETRY = 5 * 60


class MonitoringWorker:
    def __init__(
        self,
        checker: LiveStatusChecker,
        helix_provider: Callable[[], object],
        on_status: Callable[[MonitorStatus], None] | None = None,
        on_result: Callable[[LiveCheckResult], None] | None = None,
        clock: Callable[[], datetime] = utcnow,
    ):
        self.checker = checker
        self.helix_provider = helix_provider
        self.on_status = on_status or (lambda st: None)
        self.on_result = on_result or (lambda r: None)
        self.clock = clock
        self._status = MonitorStatus()
        self._status_lock = threading.Lock()
        self._check_lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._force = False
        # Executados (nesta thread) após cada verificação bem-sucedida.
        self.after_check: list[Callable[[], object]] = []

    # ------------------------------------------------------------ status
    @property
    def status(self) -> MonitorStatus:
        with self._status_lock:
            return self._status

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _set_status(self, **changes) -> None:
        with self._status_lock:
            self._status = replace(self._status, **changes)
            status = self._status
        try:
            self.on_status(status)
        except Exception:  # noqa: BLE001
            log.exception("Falha no callback de status do monitor")

    # ------------------------------------------------------------ controle
    def start(self) -> None:
        if self.running:
            return
        self._stop.clear()
        self._force = False
        self._set_status(state=MonitorState.IDLE, consecutive_failures=0, last_error=None, next_check_at=None)
        self._thread = threading.Thread(target=self._loop, name="MonitoringWorker", daemon=True)
        self._thread.start()
        log.info("Monitoramento iniciado")

    def stop(self, timeout: float = 5.0) -> None:
        thread = self._thread
        if thread is None:
            return
        self._stop.set()
        self._wake.set()
        if thread is not threading.current_thread():
            thread.join(timeout)
        self._thread = None
        self._set_status(state=MonitorState.STOPPED, next_check_at=None)
        log.info("Monitoramento parado")

    def trigger_now(self, force: bool = False) -> None:
        """Acorda o worker. ``force=True`` verifica todos os canais, vencidos ou não."""
        if force:
            self._force = True
        self._wake.set()

    def check_now(self) -> LiveCheckResult:
        """Verificação completa síncrona (usada com o monitor parado)."""
        result = self._run_check(force=True)
        self._set_status(last_check_at=self.clock(), last_checked=result.checked, last_live=result.live,
                         last_error=None)
        return result

    # ------------------------------------------------------------ loop
    def _run_check(self, force: bool) -> LiveCheckResult:
        with self._check_lock:
            helix = self.helix_provider()
            if helix is None:
                raise TwitchAuthError("Configure as credenciais da Twitch nas Configurações.")
            return self.checker.check(helix, force=force)

    def _delay_until_next_due(self) -> float:
        now = self.clock()
        due = self.checker.next_due(now)
        if due is None:
            return float(self.checker.default_interval())
        return max(MIN_SLEEP, min(MAX_POLL_INTERVAL, (due - now).total_seconds()))

    def _loop(self) -> None:
        failures = 0
        while not self._stop.is_set():
            self._wake.clear()
            force, self._force = self._force, False
            self._set_status(state=MonitorState.CHECKING)
            base = max(MIN_SLEEP, int(self.checker.default_interval()))
            try:
                result = self._run_check(force=force)
                failures = 0
                delay = self._delay_until_next_due()
                state, error = MonitorState.IDLE, None
            except TwitchRateLimitError as exc:
                result = LiveCheckResult(0, 0, error=str(exc))
                delay = max(base, (exc.reset_at or time.time() + 60) - time.time() + 1)
                state, error = MonitorState.BACKOFF, str(exc)
            except TwitchAuthError as exc:
                result = LiveCheckResult(0, 0, error=str(exc))
                delay, state, error = AUTH_RETRY, MonitorState.ERROR, str(exc)
            except Exception as exc:  # noqa: BLE001 - o worker nunca pode morrer silenciosamente
                if not isinstance(exc, TwitchError):
                    log.exception("Erro inesperado no monitoramento")
                failures += 1
                msg = str(exc) if isinstance(exc, TwitchError) else f"Erro inesperado: {exc}"
                result = LiveCheckResult(0, 0, error=msg)
                delay = min(MAX_BACKOFF, base * (2 ** min(failures, 5)))
                state, error = MonitorState.BACKOFF, msg

            if self._stop.is_set():
                break
            now = self.clock()
            prev = self.status
            self._set_status(
                state=state,
                last_error=error,
                consecutive_failures=failures,
                next_check_at=now + timedelta(seconds=delay),
                last_check_at=now if result.error is None else prev.last_check_at,
                checks_done=prev.checks_done + (1 if result.error is None else 0),
                last_checked=result.checked if result.error is None else prev.last_checked,
                last_live=result.live if result.error is None else prev.last_live,
            )
            if result.error is None:
                for hook in list(self.after_check):
                    try:
                        hook()
                    except Exception:  # noqa: BLE001
                        log.exception("Falha em rotina pós-verificação")
            try:
                self.on_result(result)
            except Exception:  # noqa: BLE001
                log.exception("Falha no callback de resultado do monitor")
            self._wake.wait(delay)
