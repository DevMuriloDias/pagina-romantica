"""Eventos de transmissão detectados pelo monitoramento."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class StreamEventType(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    TITLE_CHANGED = "title_changed"
    GAME_CHANGED = "game_changed"

    @property
    def label(self) -> str:
        return {
            "online": "Entrou ao vivo",
            "offline": "Encerrou a live",
            "title_changed": "Título alterado",
            "game_changed": "Categoria alterada",
        }[self.value]


@dataclass(frozen=True)
class StreamEvent:
    type: StreamEventType
    streamer_id: int
    streamer_name: str
    detected_at: datetime
    stream_id: str | None = None
    title: str = ""
    game_name: str = ""
    viewer_count: int | None = None
    stream_started_at: datetime | None = None
    id: int | None = None
