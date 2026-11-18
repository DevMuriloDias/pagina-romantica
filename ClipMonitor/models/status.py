"""Instantâneos de status exibidos na interface."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from models.job import JobStatus, JobType


class MonitorState(str, Enum):
    STOPPED = "stopped"
    IDLE = "idle"          # aguardando a próxima verificação
    CHECKING = "checking"
    BACKOFF = "backoff"    # falhas recentes: esperando mais que o normal
    ERROR = "error"        # erro que exige ação do usuário (ex.: credenciais)

    @property
    def label(self) -> str:
        return {
            "stopped": "Monitoramento parado",
            "idle": "Monitorando",
            "checking": "Verificando…",
            "backoff": "Reconectando",
            "error": "Ação necessária",
        }[self.value]


@dataclass(frozen=True)
class MonitorStatus:
    state: MonitorState = MonitorState.STOPPED
    last_check_at: datetime | None = None
    next_check_at: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    checks_done: int = 0
    last_checked: int = 0
    last_live: int = 0

    @property
    def running(self) -> bool:
        return self.state is not MonitorState.STOPPED


@dataclass(frozen=True)
class ToolInfo:
    name: str
    available: bool
    version: str = ""
    path: str = ""
    hint: str = ""


@dataclass(frozen=True)
class StreamerActivity:
    """Indicador de captura/processamento de um streamer."""

    job_type: JobType
    status: JobStatus
    progress: float = 0.0


@dataclass(frozen=True)
class PipelineStatus:
    capture_running: int = 0
    capture_queued: int = 0
    processing_running: int = 0
    processing_queued: int = 0
    failed: int = 0
    worker_running: bool = False
    per_streamer: dict[int, StreamerActivity] = field(default_factory=dict)

    @property
    def busy(self) -> bool:
        return bool(self.capture_running or self.processing_running)
