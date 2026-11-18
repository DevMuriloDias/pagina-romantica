"""Caminhos da aplicação e configurações do usuário.

Os valores de ``AppSettings`` são persistidos na tabela ``settings`` do SQLite
(ver ``database.repositories.SettingsRepository``).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from pathlib import Path

APP_NAME = "ClipMonitor"
APP_VERSION = "0.1.0"

BASE_DIR = Path(__file__).resolve().parent.parent


def _default_data_dir() -> Path:
    override = os.environ.get("CLIPMONITOR_DATA_DIR")
    return Path(override) if override else BASE_DIR / "data"


DATA_DIR = _default_data_dir()
DB_PATH = DATA_DIR / "clipmonitor.db"
LOG_DIR = BASE_DIR / "logs"
OUTPUT_DIR = BASE_DIR / "output"

OUTPUT_SUBDIRS = ("pending", "approved", "rejected", "thumbnails")

# Limites do intervalo de verificação ao vivo (segundos). O Helix permite
# ~800 req/min com app token; consultamos até 100 canais por requisição,
# então 30 s já é folgado. Mantemos um mínimo conservador.
MIN_POLL_INTERVAL = 30
MAX_POLL_INTERVAL = 3600


@dataclass
class AppSettings:
    """Configurações editáveis pelo usuário."""

    twitch_client_id: str = ""
    twitch_client_secret: str = ""
    poll_interval_seconds: int = 60
    start_monitoring_on_launch: bool = False
    output_dir: str = field(default_factory=lambda: str(OUTPUT_DIR))
    # Reservado para fases seguintes (já expostos na tela de configurações).
    whisper_model: str = "small"
    clip_duration_seconds: int = 45
    max_parallel_jobs: int = 1

    SECRET_FIELDS = ("twitch_client_secret",)

    @classmethod
    def field_names(cls) -> list[str]:
        return [f.name for f in fields(cls)]

    def has_twitch_credentials(self) -> bool:
        return bool(self.twitch_client_id.strip() and self.twitch_client_secret.strip())

    def normalized(self) -> "AppSettings":
        """Retorna uma cópia com valores dentro dos limites válidos."""
        interval = max(MIN_POLL_INTERVAL, min(MAX_POLL_INTERVAL, int(self.poll_interval_seconds)))
        return AppSettings(
            twitch_client_id=self.twitch_client_id.strip(),
            twitch_client_secret=self.twitch_client_secret.strip(),
            poll_interval_seconds=interval,
            start_monitoring_on_launch=bool(self.start_monitoring_on_launch),
            output_dir=self.output_dir.strip() or str(OUTPUT_DIR),
            whisper_model=self.whisper_model,
            clip_duration_seconds=max(10, min(180, int(self.clip_duration_seconds))),
            max_parallel_jobs=max(1, min(4, int(self.max_parallel_jobs))),
        )


WHISPER_MODELS = ("tiny", "base", "small", "medium")


def ensure_directories(output_dir: str | Path | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = Path(output_dir) if output_dir else OUTPUT_DIR
    for sub in OUTPUT_SUBDIRS:
        (root / sub).mkdir(parents=True, exist_ok=True)
