"""Gravações (capturas) e seus segmentos em disco."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path


class RecordingStatus(str, Enum):
    RECORDING = "recording"
    COMPLETED = "completed"
    STOPPED = "stopped"     # interrompida pelo usuário
    FAILED = "failed"
    PURGED = "purged"       # arquivos removidos pela retenção

    @property
    def label(self) -> str:
        return {
            "recording": "Gravando", "completed": "Concluída", "stopped": "Interrompida",
            "failed": "Falhou", "purged": "Arquivos removidos",
        }[self.value]


class SegmentStatus(str, Enum):
    PENDING = "pending"
    ANALYZED = "analyzed"
    FAILED = "failed"
    DELETED = "deleted"


@dataclass
class Recording:
    streamer_id: int
    stream_id: str
    directory: str
    status: RecordingStatus = RecordingStatus.RECORDING
    quality: str = ""
    authorization_note: str = ""
    job_id: int | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    bytes: int = 0
    segment_count: int = 0
    id: int | None = None
    streamer_name: str | None = None

    @property
    def path(self) -> Path:
        return Path(self.directory)

    def wallclock(self, offset_seconds: float) -> datetime | None:
        return self.started_at + timedelta(seconds=offset_seconds) if self.started_at else None


@dataclass
class Segment:
    recording_id: int
    index: int
    path: str
    start_offset: float
    duration: float
    status: SegmentStatus = SegmentStatus.PENDING
    bytes: int = 0
    id: int | None = None

    @property
    def end_offset(self) -> float:
        return self.start_offset + self.duration
