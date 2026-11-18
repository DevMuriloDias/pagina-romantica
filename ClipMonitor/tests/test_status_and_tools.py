import subprocess

from models.job import Job, JobStatus, JobType
from models.streamer import Streamer
from services.status_service import StatusService, activity_label
from services.tools import ToolsService, detect_tool


def test_pipeline_status_counts_and_per_streamer(repos):
    s1 = repos["streamers"].add(Streamer(login="um", authorized=True))
    s2 = repos["streamers"].add(Streamer(login="dois", authorized=True))
    jobs = repos["jobs"]
    cap = jobs.enqueue(Job(JobType.CAPTURE, streamer_id=s1.id))
    jobs.claim_next([JobType.CAPTURE])
    jobs.enqueue(Job(JobType.CAPTURE, streamer_id=s2.id))
    jobs.enqueue(Job(JobType.TRANSCRIPTION, streamer_id=s1.id))
    failed = jobs.enqueue(Job(JobType.RENDER))
    jobs.finish(failed.id, JobStatus.FAILED, error="x")

    p = StatusService(jobs, worker_running=lambda: True).pipeline()
    assert (p.capture_running, p.capture_queued, p.processing_queued, p.failed) == (1, 1, 1, 1)
    assert p.busy and p.worker_running
    # s1 tem captura rodando e transcrição na fila: a captura prevalece
    assert p.per_streamer[s1.id].job_type is JobType.CAPTURE
    assert p.per_streamer[s1.id].status is JobStatus.RUNNING
    assert activity_label(p.per_streamer[s1.id]) == ("● GRAVANDO", "live")
    assert activity_label(p.per_streamer[s2.id]) == ("CAPTURA NA FILA", "off")
    assert cap.id


def test_detect_tool_parses_version():
    out = "ffmpeg version 7.0.1-full_build-www.gyan.dev Copyright (c) 2000-2024"
    info = detect_tool("ffmpeg", runner=lambda cmd: out, locate=lambda n: "C:/ffmpeg/bin/ffmpeg.exe")
    assert info.available and info.version == "7.0.1-full_build-www.gyan.dev"


def test_detect_tool_missing_has_hint():
    info = detect_tool("streamlink", locate=lambda n: None)
    assert not info.available and "pip install streamlink" in info.hint


def test_detect_tool_execution_failure():
    def boom(cmd):
        raise subprocess.TimeoutExpired(cmd, 10)

    info = detect_tool("ffmpeg", runner=boom, locate=lambda n: "/usr/bin/ffmpeg")
    assert not info.available and info.path == "/usr/bin/ffmpeg"


def test_tools_service_cache():
    from models.status import ToolInfo

    svc = ToolsService(detector=lambda name: ToolInfo(name, True, "1.0"))
    assert svc.cached() is None and not svc.capture_ready()
    svc.refresh()
    assert svc.capture_ready() and set(svc.cached()) == {"ffmpeg", "streamlink"}
