"""Momentos candidatos a clipe."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class CandidateStatus(str, Enum):
    DETECTED = "detected"        # pontuação de áudio; aguardando transcrição
    SCORED = "scored"            # pontuação final; pronto para virar clipe (Fase 4)
    DISCARDED = "discarded"      # abaixo do mínimo após transcrição / sobreposição
    APPROVED = "approved"        # usuário pediu o clipe (renderização na fila)
    REJECTED = "rejected"
    RENDERED = "rendered"        # clipe gerado (ver tabela clips)

    @property
    def label(self) -> str:
        return {
            "detected": "Transcrevendo", "scored": "Pronto", "discarded": "Descartado",
            "approved": "Gerando clipe", "rejected": "Rejeitado", "rendered": "Clipe gerado",
        }[self.value]


@dataclass
class TranscriptWord:
    start: float
    end: float
    word: str
    probability: float = 1.0


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    words: list[TranscriptWord] = field(default_factory=list)


@dataclass
class Candidate:
    recording_id: int
    streamer_id: int
    start: float          # segundos desde o início da gravação
    end: float
    peak: float
    score: float          # 0–100
    audio_score: float = 0.0
    text_score: float | None = None
    breakdown: dict = field(default_factory=dict)
    status: CandidateStatus = CandidateStatus.DETECTED
    transcript: list[TranscriptSegment] = field(default_factory=list)
    language: str | None = None
    created_at: datetime | None = None
    id: int | None = None
    streamer_name: str | None = None

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def text(self) -> str:
        return " ".join(s.text.strip() for s in self.transcript).strip()

    def overlaps(self, other_start: float, other_end: float, gap: float = 0.0) -> bool:
        return self.start < other_end + gap and other_start < self.end + gap
