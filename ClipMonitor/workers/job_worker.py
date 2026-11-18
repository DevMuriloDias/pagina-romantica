"""Fila de tarefas persistente (captura, análise, transcrição, exportação).

As tarefas ficam no SQLite, então sobrevivem ao fechamento do app: o que
estava ``running`` vira ``interrupted`` na próxima abertura e pode ser
reenfileirado. Cada tipo de tarefa tem um *handler* registrado pelas fases
seguintes; tarefas sem handler permanecem na fila aguardando.

Há duas "pistas" com limites independentes:
- captura: limitada por rede/disco (uma por live gravada, padrão até 2);
- processamento: limitada por CPU (padrão 1 — no i3-10100F a transcrição e o
  FFmpeg já usam vários núcleos cada).
Assim uma captura de horas nunca bloqueia a análise/transcrição de outro clipe.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable

from database.repositories import JobRepository
from models.job import Job, JobStatus, JobType

log = logging.getLogger(__name__)


class JobCancelled(Exception):
    """Lançada por handlers (via ``ctx.raise_if_cancelled``) ao serem cancelados."""


class JobContext:
    PROGRESS_MIN_INTERVAL = 0.5  # s — evita escrever no SQLite a cada frame

    def __init__(self, job: Job, repo: JobRepository, cancel_event: threading.Event,
                 on_change: Callable[[], None]):
        self.job = job
        self._repo = repo
        self._cancel = cancel_event
        self._on_change = on_change
        self._last_write = 0.0
        self._last_progress = -1.0

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def raise_if_cancelled(self) -> None:
        if self._cancel.is_set():
            raise JobCancelled()

    def progress(self, fraction: float, message: str | None = None) -> None:
        now = time.monotonic()
        significant = message is not None or fraction >= 1.0 or abs(fraction - self._last_progress) >= 0.05
        if not significant and now - self._last_write < self.PROGRESS_MIN_INTERVAL:
            return
        self._repo.update_progress(self.job.id, fraction, message)
        self._last_write, self._last_progress = now, fraction
        self._on_change()


JobHandler = Callable[[JobContext], "str | None"]


class JobWorker:
    def __init__(
        self,
        repo: JobRepository,
        concurrency: Callable[[], int] = lambda: 1,
        capture_concurrency: Callable[[], int] = lambda: 2,
        on_change: Callable[[], None] | None = None,
        poll_seconds: float = 2.0,
    ):
        self.repo = repo
        self.concurrency = concurrency
        self.capture_concurrency = capture_concurrency
        self.on_change = on_change or (lambda: None)
        self.poll_seconds = poll_seconds
        self._handlers: dict[JobType, JobHandler] = {}
        self._running: dict[int, tuple[threading.Thread, threading.Event, bool]] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None

    # ------------------------------------------------------------ registro
    def register(self, job_type: JobType, handler: JobHandler) -> None:
        self._handlers[job_type] = handler
        self._wake.set()

    def has_handler(self, job_type: JobType) -> bool:
        return job_type in self._handlers

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def running_count(self) -> int:
        with self._lock:
            return len(self._running)

    # ------------------------------------------------------------ operações
    def enqueue(self, job: Job) -> Job:
        saved = self.repo.enqueue(job)
        self._notify()
        self._wake.set()
        return saved

    def cancel(self, job_id: int) -> bool:
        if self.repo.cancel_if_queued(job_id):
            self._notify()
            return True
        with self._lock:
            entry = self._running.get(job_id)
        if entry:
            entry[1].set()
            return True
        return False

    def retry(self, job_id: int) -> bool:
        ok = self.repo.requeue(job_id)
        if ok:
            self._notify()
            self._wake.set()
        return ok

    def remove(self, job_id: int) -> bool:
        ok = self.repo.delete(job_id)
        if ok:
            self._notify()
        return ok

    def clear_finished(self) -> int:
        n = self.repo.clear_finished()
        if n:
            self._notify()
        return n

    # ------------------------------------------------------------ ciclo de vida
    def start(self) -> None:
        if self.running:
            return
        interrupted = self.repo.mark_running_as_interrupted()
        if interrupted:
            log.warning("%d tarefa(s) marcadas como interrompidas", interrupted)
            self._notify()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="JobWorker", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        self._wake.set()
        with self._lock:
            entries = list(self._running.values())
        for _thread, cancel, _capture in entries:
            cancel.set()
        deadline = time.monotonic() + timeout
        for thread, _cancel, _capture in entries:
            thread.join(max(0.0, deadline - time.monotonic()))
        if self._thread is not None:
            self._thread.join(max(0.0, deadline - time.monotonic()))
        self._thread = None

    def _notify(self) -> None:
        try:
            self.on_change()
        except Exception:  # noqa: BLE001
            log.exception("Falha no callback da fila")

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.clear()
            try:
                self._fill_slots()
            except Exception:  # noqa: BLE001
                log.exception("Erro ao despachar tarefas")
            self._wake.wait(self.poll_seconds)

    def _free_types(self) -> list[JobType]:
        with self._lock:
            captures = sum(1 for *_x, is_capture in self._running.values() if is_capture)
            processing = len(self._running) - captures
        types = []
        for job_type in self._handlers:
            limit = self.capture_concurrency() if job_type.is_capture else self.concurrency()
            used = captures if job_type.is_capture else processing
            if used < max(1, int(limit)):
                types.append(job_type)
        return types

    def _fill_slots(self) -> None:
        while not self._stop.is_set():
            types = self._free_types()
            if not types:
                return
            job = self.repo.claim_next(types)
            if job is None:
                return
            cancel = threading.Event()
            thread = threading.Thread(target=self._run, args=(job, cancel), name=f"Job-{job.id}", daemon=True)
            with self._lock:
                self._running[job.id] = (thread, cancel, job.job_type.is_capture)
            self._notify()
            thread.start()

    def _run(self, job: Job, cancel: threading.Event) -> None:
        ctx = JobContext(job, self.repo, cancel, self._notify)
        try:
            message = self._handlers[job.job_type](ctx)
            if cancel.is_set():
                self.repo.finish(job.id, JobStatus.CANCELLED, "Cancelada pelo usuário")
            else:
                self.repo.finish(job.id, JobStatus.COMPLETED, message or "Concluída")
        except JobCancelled:
            self.repo.finish(job.id, JobStatus.CANCELLED, "Cancelada pelo usuário")
        except Exception as exc:  # noqa: BLE001
            log.exception("Tarefa %s (%s) falhou", job.id, job.job_type.value)
            self.repo.finish(job.id, JobStatus.FAILED, "Falhou", error=str(exc) or exc.__class__.__name__)
        finally:
            with self._lock:
                self._running.pop(job.id, None)
            self._notify()
            self._wake.set()
