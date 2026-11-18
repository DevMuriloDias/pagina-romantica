"""Resultado de uma consulta de status ao vivo na Twitch."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TwitchUser:
    id: str
    login: str
    display_name: str
    profile_image_url: str = ""


@dataclass(frozen=True)
class StreamInfo:
    stream_id: str
    user_id: str
    user_login: str
    user_name: str
    title: str
    game_name: str
    viewer_count: int
    started_at: datetime | None
    thumbnail_url: str = ""


@dataclass(frozen=True)
class LiveCheckResult:
    checked: int
    live: int
    went_online: tuple[str, ...] = ()
    went_offline: tuple[str, ...] = ()
    error: str | None = None
