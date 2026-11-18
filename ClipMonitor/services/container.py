"""Composição da aplicação (injeção de dependências manual)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from config import settings as cfg
from database.connection import Database, open_database
from capture.service import CaptureService
from database.repositories import (
    ActivityRepository,
    CandidateRepository,
    RecordingRepository,
    JobRepository,
    LiveSessionRepository,
    SettingsRepository,
    StreamerRepository,
    StreamEventRepository,
)
from detection.analyzer import DetectionService
from models.job import JobType
from monitoring.events import EventBus
from monitoring.live_checker import LiveStatusChecker
from services.status_service import StatusService
from services.streamer_service import StreamerService
from services.tools import ToolsService
from services.twitch_service import TwitchService
from transcription.whisper import WhisperTranscriber
from workers.job_worker import JobWorker
from workers.monitoring_worker import MonitoringWorker


@dataclass
class AppContext:
    db: Database
    settings_repo: SettingsRepository
    streamer_repo: StreamerRepository
    activity_repo: ActivityRepository
    event_repo: StreamEventRepository
    job_repo: JobRepository
    bus: EventBus
    twitch: TwitchService
    streamers: StreamerService
    checker: LiveStatusChecker
    monitor: MonitoringWorker
    jobs: JobWorker
    tools: ToolsService
    status: StatusService
    recording_repo: RecordingRepository
    candidate_repo: CandidateRepository
    capture: CaptureService
    detection: DetectionService
    transcriber: WhisperTranscriber

    def close(self) -> None:
        self.monitor.stop()
        self.jobs.stop()
        self.transcriber.close()
        self.db.close()


def build_context(db_path: Path | str | None = None) -> AppContext:
    db = open_database(db_path or cfg.DB_PATH)
    settings_repo = SettingsRepository(db)
    streamer_repo = StreamerRepository(db)
    activity_repo = ActivityRepository(db)
    sessions_repo = LiveSessionRepository(db)
    event_repo = StreamEventRepository(db)
    job_repo = JobRepository(db)
    bus = EventBus()
    twitch = TwitchService(settings_repo)
    streamers = StreamerService(streamer_repo, activity_repo, helix_provider=twitch.client)
    checker = LiveStatusChecker(
        streamer_repo, sessions_repo, activity_repo, event_repo, bus,
        default_interval=lambda: settings_repo.load().poll_interval_seconds,
        grace_checks=lambda: settings_repo.load().offline_grace_checks,
    )
    monitor = MonitoringWorker(checker, helix_provider=twitch.client)
    jobs = JobWorker(
        job_repo,
        concurrency=lambda: settings_repo.load().max_parallel_jobs,
        capture_concurrency=lambda: settings_repo.load().max_concurrent_captures,
    )
    status = StatusService(job_repo, worker_running=lambda: jobs.running)
    tools = ToolsService()
    recording_repo = RecordingRepository(db)
    candidate_repo = CandidateRepository(db)

    def ffmpeg_path() -> str:
        info = (tools.cached() or {}).get("ffmpeg")
        return info.path if info and info.available and info.path else "ffmpeg"

    settings = settings_repo.load()
    transcriber = WhisperTranscriber(settings.whisper_model, download_root=str(cfg.DATA_DIR / "models"))
    capture = CaptureService(streamer_repo, recording_repo, candidate_repo, settings_repo, activity_repo,
                             jobs, tools)
    detection = DetectionService(recording_repo, candidate_repo, settings_repo, activity_repo, jobs,
                                 transcriber=transcriber, ffmpeg=ffmpeg_path)
    capture.attach(bus)
    jobs.register(JobType.CAPTURE, capture.handle)
    jobs.register(JobType.ANALYSIS, detection.handle_analysis)
    jobs.register(JobType.TRANSCRIPTION, detection.handle_transcription)
    return AppContext(
        db, settings_repo, streamer_repo, activity_repo, event_repo, job_repo, bus, twitch,
        streamers, checker, monitor, jobs, tools, status, recording_repo, candidate_repo,
        capture, detection, transcriber,
    )
