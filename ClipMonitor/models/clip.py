"""Clipes renderizados (arquivos MP4 verticais) e seu estado de revisão."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class ClipStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

    @property
    def label(self) -> str:
        return {"pending": "Aguardando revisão", "approved": "Aprovado", "rejected": "Rejeitado"}[self.value]

    @property
    def folder(self) -> str:
        return self.value  # output/pending | output/approved | output/rejected


@dataclass
class Clip:
    candidate_id: int
    streamer_id: int
    path: str
    duration: float
    score: float
    layout: str
    status: ClipStatus = ClipStatus.PENDING
    srt_path: str | None = None
    thumbnail_path: str | None = None
    width: int = 1080
    height: int = 1920
    size_bytes: int = 0
    has_subtitles: bool = False
    transcript_text: str = ""
    created_at: datetime | None = None
    reviewed_at: datetime | None = None
    id: int | None = None
    streamer_name: str | None = None
