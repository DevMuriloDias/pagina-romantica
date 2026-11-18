"""Tarefas da fila de captura/processamento."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class JobType(str, Enum):
    CAPTURE = "capture"
    ANALYSIS = "analysis"
    TRANSCRIPTION = "transcription"
    RENDER = "render"

    @property
    def label(self) -> str:
        return {
            "capture": "Captura",
            "analysis": "Análise de áudio",
            "transcription": "Transcrição",
            "render": "Exportação 9:16",
        }[self.value]

    @property
    def is_capture(self) -> bool:
        return self is JobType.CAPTURE


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    INTERRUPTED = "interrupted"  # app fechada no meio da execução

    @property
    def label(self) -> str:
        return {
            "queued": "Na fila",
            "running": "Em andamento",
            "completed": "Concluída",
            "failed": "Falhou",
            "cancelled": "Cancelada",
            "interrupted": "Interrompida",
        }[self.value]

    @property
    def is_active(self) -> bool:
        return self in (JobStatus.QUEUED, JobStatus.RUNNING)

    @property
    def is_retryable(self) -> bool:
        return self in (JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.INTERRUPTED)


ACTIVE_STATUSES = (JobStatus.QUEUED, JobStatus.RUNNING)


@dataclass
class Job:
    job_type: JobType
    status: JobStatus = JobStatus.QUEUED
    streamer_id: int | None = None
    priority: int = 0
    progress: float = 0.0
    message: str = ""
    error: str | None = None
    payload: dict = field(default_factory=dict)
    dedupe_key: str | None = None
    attempts: int = 0
    id: int | None = None
    streamer_name: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime | None = None


def eta_seconds(job: Job, now: datetime) -> float | None:
    """Tempo restante estimado pelo ritmo atual (só para tarefas com progresso medido)."""
    if job.status is not JobStatus.RUNNING or not job.started_at or job.progress < 0.05 or job.job_type.is_capture:
        return None
    elapsed = (now - job.started_at).total_seconds()
    return max(0.0, elapsed / job.progress * (1 - job.progress))
