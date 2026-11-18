"""Serviço de captura autorizada.

Autorização é verificada em três pontos: ao enfileirar, ao iniciar a gravação
(o usuário pode ter revogado nesse meio-tempo) e no próprio cadastro (só canais
autorizados são monitorados). Cada gravação guarda um ``metadata.json`` com o
registro da autorização vigente no momento da captura.
"""
from __future__ import annotations

import json
import logging
import shutil
import threading
import time
from datetime import timedelta
from pathlib import Path
from typing import Callable

from capture.recorder import Recorder, streamlink_command
from config.settings import AppSettings
from database.repositories import (
    ActivityRepository, CandidateRepository, RecordingRepository, SettingsRepository, StreamerRepository,
)
from models.candidate import CandidateStatus
from models.events import StreamEvent, StreamEventType
from models.job import Job, JobType
from models.recording import Recording, RecordingStatus, Segment, SegmentStatus
from monitoring.events import EventBus
from services.tools import ToolsService
from utils.timeutils import format_duration, utcnow
from workers.job_worker import JobCancelled, JobContext, JobWorker

log = logging.getLogger(__name__)

POLL_SECONDS = 1.0
DISK_CHECK_SECONDS = 30
GB = 1024 ** 3


class CaptureError(RuntimeError):
    pass


class CaptureService:
    def __init__(
        self,
        streamers: StreamerRepository,
        recordings: RecordingRepository,
        candidates: CandidateRepository,
        settings_repo: SettingsRepository,
        activity: ActivityRepository,
        jobs: JobWorker,
        tools: ToolsService,
        recorder_factory: Callable[..., Recorder] = Recorder,
        source_command: Callable[[AppSettings, str], list[str]] | None = None,
        disk_free: Callable[[Path], int] = lambda p: shutil.disk_usage(p).free,
    ):
        self.streamers = streamers
        self.recordings = recordings
        self.candidates = candidates
        self.settings_repo = settings_repo
        self.activity = activity
        self.jobs = jobs
        self.tools = tools
        self.recorder_factory = recorder_factory
        self.source_command = source_command or self._streamlink_source
        self.disk_free = disk_free
        self._stops: dict[int, threading.Event] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------ integração
    def attach(self, bus: EventBus) -> None:
        bus.subscribe(self._on_online, StreamEventType.ONLINE)
        bus.subscribe(self._on_offline, StreamEventType.OFFLINE)

    def _on_online(self, e: StreamEvent) -> None:
        if not self.settings_repo.load().auto_capture:
            return
        try:
            self.enqueue(e.streamer_id, e.stream_id, manual=False)
        except CaptureError as exc:
            log.info("Captura automática não iniciada para %s: %s", e.streamer_name, exc)

    def _on_offline(self, e: StreamEvent) -> None:
        self.request_stop(e.streamer_id)

    # ------------------------------------------------------------ comandos
    def enqueue(self, streamer_id: int, stream_id: str | None = None, manual: bool = True) -> Job:
        s = self.streamers.get(streamer_id)
        if s is None:
            raise CaptureError("Streamer não encontrado.")
        if not s.authorized:
            raise CaptureError("Este canal não tem autorização registrada. A captura foi bloqueada.")
        stream_id = stream_id or s.stream_id
        if not s.is_live or not stream_id:
            raise CaptureError(f"{s.name} não está ao vivo.")
        job = self.jobs.enqueue(Job(
            JobType.CAPTURE, streamer_id=s.id, priority=10, dedupe_key=f"capture:{s.id}:{stream_id}",
            payload={"stream_id": stream_id, "login": s.login, "manual": manual},
            message="Aguardando início da gravação",
        ))
        if manual:
            self.activity.add(f"Gravação de {s.name} solicitada.", "info", s.id)
        return job

    def request_stop(self, streamer_id: int) -> bool:
        """Encerra a gravação normalmente (os segmentos já gravados seguem para análise)."""
        with self._lock:
            ev = self._stops.get(streamer_id)
        if ev:
            ev.set()
            return True
        return False

    def is_capturing(self, streamer_id: int) -> bool:
        with self._lock:
            return streamer_id in self._stops

    # ------------------------------------------------------------ handler
    def _streamlink_source(self, settings: AppSettings, login: str) -> list[str]:
        info = (self.tools.cached() or {}).get("streamlink")
        exe = info.path.split(" ") if info and info.available and info.path else ["streamlink"]
        return streamlink_command(exe, login, settings.capture_quality)

    def _ffmpeg(self) -> str:
        info = (self.tools.cached() or {}).get("ffmpeg")
        return info.path if info and info.available and info.path else "ffmpeg"

    def recordings_root(self, settings: AppSettings) -> Path:
        return Path(settings.output_dir) / "recordings"

    def _check_disk(self, path: Path, settings: AppSettings) -> None:
        free = self.disk_free(path)
        if free < settings.min_free_disk_gb * GB:
            raise CaptureError(
                f"Pouco espaço em disco ({free / GB:.1f} GB livres; mínimo {settings.min_free_disk_gb} GB)."
            )

    def handle(self, ctx: JobContext) -> str:
        job = ctx.job
        settings = self.settings_repo.load()
        s = self.streamers.get(job.streamer_id) if job.streamer_id else None
        if s is None:
            raise CaptureError("Streamer removido.")
        if not s.authorized:
            raise CaptureError("Autorização do canal revogada. Gravação bloqueada.")
        stream_id = job.payload.get("stream_id")
        if not s.is_live or s.stream_id != stream_id:
            return "A live já havia terminado; nada foi gravado."

        if self.tools.cached() is None:
            self.tools.refresh()
        root = self.recordings_root(settings)
        root.mkdir(parents=True, exist_ok=True)
        self._check_disk(root, settings)

        started = utcnow()
        directory = root / s.login / f"{started.astimezone():%Y%m%d-%H%M%S}_{stream_id}"
        rec = self.recordings.create(Recording(
            streamer_id=s.id, stream_id=stream_id, job_id=job.id, directory=str(directory),
            quality=settings.capture_quality, authorization_note=s.authorization_note, started_at=started,
        ))
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "metadata.json").write_text(json.dumps({
            "streamer": s.login, "display_name": s.name, "twitch_user_id": s.twitch_user_id,
            "stream_id": stream_id, "title": s.stream_title, "game": s.game_name,
            "started_at": started.isoformat(), "quality": settings.capture_quality,
            "authorized": True, "authorization_note": s.authorization_note,
        }, ensure_ascii=False, indent=2), encoding="utf-8")

        stop = threading.Event()
        with self._lock:
            self._stops[s.id] = stop
        recorder = self.recorder_factory(self.source_command(settings, s.login), directory,
                                         settings.segment_seconds, self._ffmpeg())
        self.activity.add(f"Gravando {s.name}.", "live", s.id)
        outcome, error = RecordingStatus.COMPLETED, None
        try:
            try:
                recorder.start()
            except RuntimeError as exc:
                raise CaptureError(str(exc)) from exc
            last_disk = time.monotonic()
            while True:
                self._register_segments(rec, recorder)
                elapsed = (utcnow() - started).total_seconds()
                ctx.progress(0.0, f"Gravando {format_duration(elapsed)} · {rec.segment_count} segmento(s) · "
                                  f"{recorder.total_bytes() / 1024 ** 2:.0f} MB")
                if ctx.cancelled:
                    outcome = RecordingStatus.STOPPED
                    break
                if stop.is_set():
                    break  # live encerrada (evento OFFLINE)
                if not recorder.alive():
                    break  # Streamlink terminou: fim da live ou falha
                if time.monotonic() - last_disk > DISK_CHECK_SECONDS:
                    last_disk = time.monotonic()
                    self._check_disk(root, settings)
                time.sleep(POLL_SECONDS)
        except CaptureError as exc:
            outcome, error = RecordingStatus.FAILED, str(exc)
        finally:
            recorder.stop()
            self._register_segments(rec, recorder)
            with self._lock:
                self._stops.pop(s.id, None)

        if outcome is RecordingStatus.COMPLETED and rec.segment_count == 0:
            outcome = RecordingStatus.FAILED
            error = recorder.error_tail() or "Nenhum dado de vídeo foi recebido."
        self.recordings.finish(rec.id, outcome)
        if outcome is RecordingStatus.FAILED:
            self.activity.add(f"Falha ao gravar {s.name}: {error}", "error", s.id)
            raise CaptureError(error)
        if outcome is RecordingStatus.STOPPED:
            self.activity.add(f"Gravação de {s.name} interrompida.", "info", s.id)
            raise JobCancelled()
        total = format_duration((utcnow() - started).total_seconds())
        self.activity.add(f"Gravação de {s.name} concluída ({total}).", "info", s.id)
        return f"Gravação concluída: {total}, {rec.segment_count} segmento(s)"

    def _register_segments(self, rec: Recording, recorder: Recorder) -> None:
        fresh = recorder.new_segments()
        for info in fresh:
            path = Path(rec.directory) / info.filename
            size = path.stat().st_size if path.exists() else 0
            if info.duration < 1.0 or size == 0:
                continue
            seg = self.recordings.add_segment(Segment(
                recording_id=rec.id, index=info.index, path=str(path),
                start_offset=info.start, duration=info.duration, bytes=size,
            ))
            self.jobs.enqueue(Job(
                JobType.ANALYSIS, streamer_id=rec.streamer_id, priority=5,
                dedupe_key=f"analysis:{seg.id}", payload={"segment_id": seg.id},
                message=f"Segmento {info.index + 1} aguardando análise",
            ))
        if fresh:
            segments = self.recordings.segments(rec.id)
            rec.segment_count = len(segments)
            rec.bytes = sum(sg.bytes for sg in segments)
            self.recordings.update_stats(rec.id, rec.bytes, rec.segment_count)

    # ------------------------------------------------------------ manutenção
    def recover(self) -> int:
        """Ao abrir o app: gravações que estavam em andamento ficam como falhas."""
        return self.recordings.mark_running_as_failed()

    def purge_expired(self) -> int:
        """Apaga segmentos antigos que não contêm momentos pendentes. Retorna bytes liberados."""
        settings = self.settings_repo.load()
        cutoff = utcnow() - timedelta(hours=settings.recording_retention_hours)
        keep_status = (CandidateStatus.DETECTED, CandidateStatus.SCORED, CandidateStatus.APPROVED)
        freed = 0
        for rec in self.recordings.finished_before(cutoff):
            needed = [c for c in self.candidates.for_recording(rec.id) if c.status in keep_status]
            keep_ids = {sg.id for c in needed for sg in self.recordings.segments_covering(rec.id, c.start, c.end)}
            for sg in self.recordings.segments(rec.id):
                if sg.id in keep_ids or sg.status is SegmentStatus.DELETED:
                    continue
                p = Path(sg.path)
                if p.exists():
                    freed += p.stat().st_size
                    p.unlink()
                self.recordings.set_segment_status(sg.id, SegmentStatus.DELETED)
            if not keep_ids:
                self.recordings.mark_purged(rec.id)
        if freed:
            log.info("Retenção: %.1f MB liberados", freed / 1024 ** 2)
        return freed
