"""Composição da aplicação (injeção de dependências manual)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from config import settings as cfg
from database.connection import Database, open_database
from database.repositories import (
    ActivityRepository,
    LiveSessionRepository,
    SettingsRepository,
    StreamerRepository,
)
from monitoring.live_checker import LiveStatusChecker
from monitoring.monitor import MonitorService
from services.streamer_service import StreamerService
from services.twitch_service import TwitchService


@dataclass
class AppContext:
    db: Database
    settings_repo: SettingsRepository
    streamer_repo: StreamerRepository
    activity_repo: ActivityRepository
    twitch: TwitchService
    streamers: StreamerService
    monitor: MonitorService

    def close(self) -> None:
        self.monitor.stop()
        self.db.close()


def build_context(db_path: Path | str | None = None) -> AppContext:
    db = open_database(db_path or cfg.DB_PATH)
    settings_repo = SettingsRepository(db)
    streamer_repo = StreamerRepository(db)
    activity_repo = ActivityRepository(db)
    sessions_repo = LiveSessionRepository(db)
    twitch = TwitchService(settings_repo)
    streamers = StreamerService(streamer_repo, activity_repo, helix_provider=twitch.client)
    checker = LiveStatusChecker(streamer_repo, sessions_repo, activity_repo)
    monitor = MonitorService(
        checker,
        helix_provider=twitch.client,
        interval_provider=lambda: settings_repo.load().poll_interval_seconds,
    )
    return AppContext(db, settings_repo, streamer_repo, activity_repo, twitch, streamers, monitor)
