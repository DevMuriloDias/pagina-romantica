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

OUTPUT_SUBDIRS = ("pending", "approved", "rejected", "thumbnails", "recordings")

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
    # Quantas verificações seguidas sem a live são necessárias para declarar o fim.
    # Evita falsos "encerrou" quando a API da Twitch omite um canal por instantes.
    offline_grace_checks: int = 2
    start_monitoring_on_launch: bool = False
    output_dir: str = field(default_factory=lambda: str(OUTPUT_DIR))
    # Reservado para fases seguintes (já expostos na tela de configurações).
    whisper_model: str = "small"
    clip_duration_seconds: int = 45
    max_parallel_jobs: int = 1
    max_concurrent_captures: int = 2
    # Fase 3 — captura e detecção
    auto_capture: bool = True
    capture_quality: str = "1080p60,1080p,720p60,720p,best"
    segment_seconds: int = 300
    min_free_disk_gb: int = 10
    recording_retention_hours: int = 48
    min_moment_score: int = 55
    max_moments_per_hour: int = 6
    min_gap_between_moments: int = 15
    transcribe_moments: bool = True
    custom_keywords: str = ""

    SECRET_FIELDS = ("twitch_client_secret",)

    @classmethod
    def field_names(cls) -> list[str]:
        return [f.name for f in fields(cls)]

    def has_twitch_credentials(self) -> bool:
        return bool(self.twitch_client_id.strip() and self.twitch_client_secret.strip())

    def normalized(self) -> "AppSettings":
        """Retorna uma cópia com valores dentro dos limites válidos."""
        interval = clamp_interval(self.poll_interval_seconds)
        return AppSettings(
            twitch_client_id=self.twitch_client_id.strip(),
            twitch_client_secret=self.twitch_client_secret.strip(),
            poll_interval_seconds=interval,
            offline_grace_checks=max(1, min(5, int(self.offline_grace_checks))),
            start_monitoring_on_launch=bool(self.start_monitoring_on_launch),
            output_dir=self.output_dir.strip() or str(OUTPUT_DIR),
            whisper_model=self.whisper_model,
            clip_duration_seconds=max(10, min(180, int(self.clip_duration_seconds))),
            max_parallel_jobs=max(1, min(4, int(self.max_parallel_jobs))),
            max_concurrent_captures=max(1, min(4, int(self.max_concurrent_captures))),
            auto_capture=bool(self.auto_capture),
            capture_quality=self.capture_quality.strip() or "best",
            segment_seconds=max(60, min(900, int(self.segment_seconds))),
            min_free_disk_gb=max(1, min(500, int(self.min_free_disk_gb))),
            recording_retention_hours=max(1, min(24 * 30, int(self.recording_retention_hours))),
            min_moment_score=max(0, min(100, int(self.min_moment_score))),
            max_moments_per_hour=max(1, min(30, int(self.max_moments_per_hour))),
            min_gap_between_moments=max(0, min(300, int(self.min_gap_between_moments))),
            transcribe_moments=bool(self.transcribe_moments),
            custom_keywords=self.custom_keywords.strip(),
        )


WHISPER_MODELS = ("tiny", "base", "small", "medium")

QUALITY_PRESETS = {
    "Melhor disponível (até 1080p)": "1080p60,1080p,720p60,720p,best",
    "720p (economiza disco)": "720p60,720p,best",
    "480p (mínimo)": "480p,best",
}

# Opções de intervalo exibidas na UI (segundos).
INTERVAL_PRESETS = (30, 45, 60, 90, 120, 300, 600)


def clamp_interval(seconds: int) -> int:
    return max(MIN_POLL_INTERVAL, min(MAX_POLL_INTERVAL, int(seconds)))


def ensure_directories(output_dir: str | Path | None = None) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = Path(output_dir) if output_dir else OUTPUT_DIR
    for sub in OUTPUT_SUBDIRS:
        (root / sub).mkdir(parents=True, exist_ok=True)
