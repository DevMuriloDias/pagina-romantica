"""Agrega o status de captura e processamento para os indicadores da UI."""
from __future__ import annotations

from database.repositories import JobRepository
from models.job import JobStatus, JobType
from models.status import PipelineStatus, StreamerActivity


class StatusService:
    def __init__(self, jobs: JobRepository, worker_running=lambda: False):
        self.jobs = jobs
        self.worker_running = worker_running

    def pipeline(self) -> PipelineStatus:
        counts = self.jobs.counts()

        def total(capture: bool, status: JobStatus) -> int:
            return sum(n for (t, s), n in counts.items() if t.is_capture == capture and s is status)

        per_streamer = {
            sid: StreamerActivity(job.job_type, job.status, job.progress)
            for sid, job in self.jobs.active_by_streamer().items()
        }
        return PipelineStatus(
            capture_running=total(True, JobStatus.RUNNING),
            capture_queued=total(True, JobStatus.QUEUED),
            processing_running=total(False, JobStatus.RUNNING),
            processing_queued=total(False, JobStatus.QUEUED),
            failed=sum(n for (_t, s), n in counts.items() if s in (JobStatus.FAILED, JobStatus.INTERRUPTED)),
            worker_running=bool(self.worker_running()),
            per_streamer=per_streamer,
        )


def activity_label(a: StreamerActivity) -> tuple[str, str]:
    """Texto curto e estilo de badge para o indicador de um streamer."""
    if a.job_type is JobType.CAPTURE:
        if a.status is JobStatus.RUNNING:
            return "● GRAVANDO", "live"
        return "CAPTURA NA FILA", "off"
    if a.status is JobStatus.RUNNING:
        pct = f" {int(a.progress * 100)}%" if a.progress else ""
        return f"PROCESSANDO{pct}", "on"
    return "PROCESSAMENTO NA FILA", "off"
