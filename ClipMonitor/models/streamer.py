"""Modelos de domínio relacionados a streamers."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class Streamer:
    login: str
    display_name: str = ""
    id: int | None = None
    twitch_user_id: str | None = None
    profile_image_url: str | None = None
    # Confirmação explícita do usuário de que possui autorização do streamer
    # para capturar e republicar trechos. Só streamers autorizados são monitorados.
    authorized: bool = False
    authorization_note: str = ""
    monitoring_enabled: bool = True
    notes: str = ""
    # Intervalo próprio de verificação (segundos). None = usa o intervalo global.
    check_interval_seconds: int | None = None
    is_live: bool = False
    stream_id: str | None = None
    stream_title: str | None = None
    game_name: str | None = None
    viewer_count: int | None = None
    live_since: datetime | None = None
    last_checked_at: datetime | None = None
    last_seen_live_at: datetime | None = None
    offline_misses: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def name(self) -> str:
        return self.display_name or self.login

    @property
    def channel_url(self) -> str:
        return f"https://www.twitch.tv/{self.login}"

    @property
    def is_monitorable(self) -> bool:
        return self.authorized and self.monitoring_enabled


@dataclass
class LiveSession:
    """Uma transmissão observada (online → offline)."""

    streamer_id: int
    stream_id: str
    started_at: datetime | None
    title: str = ""
    game_name: str = ""
    id: int | None = None
    ended_at: datetime | None = None
    peak_viewers: int = 0
