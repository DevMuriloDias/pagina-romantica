import os
import time
from datetime import timedelta
from pathlib import Path

import pytest

from capture.recorder import Recorder, parse_segment_list, segmenter_command, streamlink_command
from capture.service import CaptureError, CaptureService
from config.settings import AppSettings
from database.repositories import CandidateRepository, RecordingRepository
from models.candidate import Candidate, CandidateStatus
from models.events import StreamEvent, StreamEventType
from models.job import JobStatus, JobType
from models.live_status import StreamInfo
from models.recording import RecordingStatus, SegmentStatus
from models.status import ToolInfo
from models.streamer import Streamer
from monitoring.events import EventBus
from services.tools import ToolsService
from tests.helpers import HAS_FFMPEG, FakeCtx
from utils.timeutils import utcnow
from workers.job_worker import JobCancelled, JobWorker

# ---------------------------------------------------------------- recorder (FFmpeg real)

FAKE_LIVE = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "sine=f=440:r=16000",
             "-f", "lavfi", "-i", "testsrc=s=160x120:r=10", "-c:v", "mpeg2video", "-b:v", "2M",
             "-c:a", "mp2", "-f", "mpegts", "pipe:1"]


def test_commands():
    cmd = streamlink_command(["streamlink"], "gaules", "720p,best")
    assert cmd[0] == "streamlink" and "--stdout" in cmd and cmd[-2:] == ["https://www.twitch.tv/gaules", "720p,best"]
    seg = segmenter_command("ffmpeg", 300)
    assert seg[seg.index("-c") + 1] == "copy" and seg[seg.index("-segment_time") + 1] == "300"


def test_parse_segment_list_ignores_partial_lines(tmp_path):
    p = tmp_path / "segments.csv"
    p.write_text("seg_00000.ts,0.000000,300.016\nseg_00001.ts,300.016,600.0\nseg_0000", encoding="utf-8")
    segs = parse_segment_list(p)
    assert [(s.index, s.start, s.end) for s in segs] == [(0, 0.0, 300.016), (1, 300.016, 600.0)]


@pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")
def test_recorder_segments_live_stream_and_finalizes_on_stop(tmp_path):
    rec = Recorder(FAKE_LIVE, tmp_path, segment_seconds=1)
    rec.start()
    deadline, seen = time.time() + 15, []
    while time.time() < deadline and len(seen) < 2:
        seen += rec.new_segments()
        time.sleep(0.2)
    assert rec.alive() and len(seen) >= 2
    rec.stop()
    seen += rec.new_segments()  # o último segmento é fechado ao parar
    assert not rec.alive()
    indexes = [s.index for s in seen]
    assert indexes == list(range(len(indexes))) and len(indexes) >= 3
    assert all((tmp_path / s.filename).stat().st_size > 0 for s in seen)
    assert seen[1].start == pytest.approx(seen[0].end, abs=0.2)


@pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")
def test_recorder_missing_program(tmp_path):
    rec = Recorder(["programa-que-nao-existe-123"], tmp_path, 5)
    with pytest.raises(RuntimeError, match="não encontrado"):
        rec.start()


# ---------------------------------------------------------------- serviço (gravador falso)

class FakeRecorder:
    """Simula o segmentador: a cada ``poll`` 'fecha' um segmento de 300 s."""
    instances: list["FakeRecorder"] = []

    def __init__(self, cmd, out_dir, seg_seconds, ffmpeg, segments=3, die_after=None):
        self.cmd, self.dir, self.n = cmd, Path(out_dir), segments
        self.produced, self.stopped, self.started = 0, False, False
        self.die_after = die_after
        FakeRecorder.instances.append(self)

    def start(self):
        self.started = True

    def _produce(self):
        if self.produced < self.n:
            i = self.produced
            (self.dir / f"seg_{i:05d}.ts").write_bytes(b"x" * 1000)
            with open(self.dir / "segments.csv", "a") as fh:
                fh.write(f"seg_{i:05d}.ts,{i * 300}.0,{(i + 1) * 300}.0\n")
            self.produced += 1

    def alive(self):
        if self.stopped:
            return False
        self._produce()
        return self.die_after is None or self.produced < self.die_after

    _seen = 0

    def new_segments(self):
        from capture.recorder import parse_segment_list

        segs = parse_segment_list(self.dir / "segments.csv")[self._seen:]
        self._seen += len(segs)
        return segs

    def stop(self):
        self.stopped = True

    def total_bytes(self):
        return 1000 * self.produced

    def error_tail(self):
        return "error: No playable streams found"


@pytest.fixture
def capture_env(repos, tmp_path, monkeypatch):
    import capture.service as svc_mod

    monkeypatch.setattr(svc_mod, "POLL_SECONDS", 0.0)
    db = repos["streamers"].db
    repos["settings"].save(AppSettings(output_dir=str(tmp_path / "out"), segment_seconds=300))
    jobs = JobWorker(repos["jobs"])  # não iniciado: só enfileira
    tools = ToolsService(detector=lambda n: ToolInfo(n, True, "1", path=n))
    tools.refresh()
    FakeRecorder.instances = []
    free = {"bytes": 500 * 1024 ** 3}
    svc = CaptureService(
        repos["streamers"], RecordingRepository(db), CandidateRepository(db), repos["settings"], repos["activity"],
        jobs, tools, recorder_factory=lambda *a: FakeRecorder(*a, die_after=3),
        disk_free=lambda p: free["bytes"],
    )
    return svc, repos, free


def live_streamer(repos, login="canal", authorized=True, stream_id="s1"):
    s = repos["streamers"].add(Streamer(login=login, authorized=authorized, monitoring_enabled=authorized,
                                        authorization_note="OK por e-mail em 01/11"))
    repos["streamers"].set_live(s.id, StreamInfo(stream_id, "u", login, login, "Título", "Jogo", 10, utcnow()), utcnow())
    return repos["streamers"].get(s.id)


def run_capture(svc, s, stream_id="s1"):
    job = svc.enqueue(s.id, stream_id)
    return job, svc.handle(FakeCtx(job.payload, JobType.CAPTURE, s.id, job.id))


def test_capture_records_segments_and_queues_analysis(capture_env):
    svc, repos, _ = capture_env
    s = live_streamer(repos)
    job, message = run_capture(svc, s)
    assert "3 segmento" in message
    rec = svc.recordings.list_recent()[0]
    assert rec.status is RecordingStatus.COMPLETED and rec.segment_count == 3 and rec.bytes == 3000
    segs = svc.recordings.segments(rec.id)
    assert [(g.index, g.start_offset) for g in segs] == [(0, 0.0), (1, 300.0), (2, 600.0)]
    analysis = repos["jobs"].list((JobStatus.QUEUED,))
    assert sorted(j.payload["segment_id"] for j in analysis if j.job_type is JobType.ANALYSIS) == [g.id for g in segs]
    meta = (Path(rec.directory) / "metadata.json").read_text(encoding="utf-8")
    assert '"authorized": true' in meta and "OK por e-mail" in meta
    assert "streamlink" in FakeRecorder.instances[0].cmd[0]


def test_capture_requires_authorization(capture_env):
    svc, repos, _ = capture_env
    s = live_streamer(repos, authorized=False)
    with pytest.raises(CaptureError, match="autorização"):
        svc.enqueue(s.id)
    # autorização revogada depois de enfileirar
    ok = live_streamer(repos, login="outro")
    job = svc.enqueue(ok.id)
    ok.authorized, ok.monitoring_enabled = False, False
    repos["streamers"].update(ok)
    with pytest.raises(CaptureError, match="revogada"):
        svc.handle(FakeCtx(job.payload, JobType.CAPTURE, ok.id))
    assert FakeRecorder.instances == []


def test_capture_skips_when_stream_already_over(capture_env):
    svc, repos, _ = capture_env
    s = live_streamer(repos)
    job = svc.enqueue(s.id)
    repos["streamers"].set_offline(s.id, utcnow())
    assert "terminado" in svc.handle(FakeCtx(job.payload, JobType.CAPTURE, s.id))
    with pytest.raises(CaptureError, match="não está ao vivo"):
        svc.enqueue(s.id)


def test_auto_capture_on_online_event_is_deduplicated(capture_env):
    svc, repos, _ = capture_env
    bus = EventBus()
    svc.attach(bus)
    s = live_streamer(repos)
    ev = StreamEvent(StreamEventType.ONLINE, s.id, s.name, utcnow(), stream_id="s1")
    bus.publish(ev)
    bus.publish(ev)
    captures = [j for j in repos["jobs"].list() if j.job_type is JobType.CAPTURE]
    assert len(captures) == 1 and captures[0].priority == 10
    settings = repos["settings"].load()
    settings.auto_capture = False
    repos["settings"].save(settings)
    other = live_streamer(repos, login="dois", stream_id="s2")
    bus.publish(StreamEvent(StreamEventType.ONLINE, other.id, other.name, utcnow(), stream_id="s2"))
    assert len([j for j in repos["jobs"].list() if j.job_type is JobType.CAPTURE]) == 1


def test_stop_request_completes_and_cancel_stops(capture_env, monkeypatch):
    svc, repos, _ = capture_env
    s = live_streamer(repos)
    svc.recorder_factory = lambda *a: FakeRecorder(*a, segments=1000)
    job = svc.enqueue(s.id)
    ctx = FakeCtx(job.payload, JobType.CAPTURE, s.id)
    original = FakeRecorder.alive

    def alive_then_offline(self):
        if self.produced == 2:
            svc.request_stop(s.id)  # evento OFFLINE chega durante a gravação
        return original(self)

    monkeypatch.setattr(FakeRecorder, "alive", alive_then_offline)
    assert "concluída" in svc.handle(ctx)
    assert not svc.is_capturing(s.id)

    s2 = live_streamer(repos, login="dois", stream_id="x")
    job2 = svc.enqueue(s2.id)
    ctx2 = FakeCtx(job2.payload, JobType.CAPTURE, s2.id)
    monkeypatch.setattr(FakeRecorder, "alive", lambda self: (setattr(ctx2, "cancel", self.produced >= 1),
                                                             original(self))[1])
    with pytest.raises(JobCancelled):
        svc.handle(ctx2)
    stopped = svc.recordings.list_recent()[0]
    assert stopped.status is RecordingStatus.STOPPED
    # O que foi gravado até a parada segue para análise.
    seg_ids = {g.id for g in svc.recordings.segments(stopped.id)}
    queued = {j.payload["segment_id"] for j in repos["jobs"].list() if j.job_type is JobType.ANALYSIS}
    assert seg_ids and seg_ids <= queued


def test_low_disk_space_fails_capture(capture_env):
    svc, repos, free = capture_env
    s = live_streamer(repos)
    free["bytes"] = 2 * 1024 ** 3
    with pytest.raises(CaptureError, match="espaço em disco"):
        run_capture(svc, s)


def test_failure_without_data_reports_streamlink_error(capture_env):
    svc, repos, _ = capture_env
    svc.recorder_factory = lambda *a: FakeRecorder(*a, segments=0, die_after=0)
    s = live_streamer(repos)
    with pytest.raises(CaptureError, match="No playable streams"):
        run_capture(svc, s)
    assert svc.recordings.list_recent()[0].status is RecordingStatus.FAILED


def test_retention_keeps_segments_with_pending_moments(capture_env, monkeypatch):
    svc, repos, _ = capture_env
    s = live_streamer(repos)
    run_capture(svc, s)
    rec = svc.recordings.list_recent()[0]
    segs = svc.recordings.segments(rec.id)
    # momento cruzando a divisa entre os segmentos 1 e 2
    svc.candidates.insert_selected(Candidate(rec.id, s.id, 580, 625, 610, 80, 80, status=CandidateStatus.SCORED), 15, 6)
    import capture.service as svc_mod

    monkeypatch.setattr(svc_mod, "utcnow", lambda: utcnow() + timedelta(days=30))
    assert svc.purge_expired() == 1000
    status = {g.index: g.status for g in svc.recordings.segments(rec.id)}
    assert status == {0: SegmentStatus.DELETED, 1: SegmentStatus.PENDING, 2: SegmentStatus.PENDING}
    assert not Path(segs[0].path).exists() and Path(segs[1].path).exists()
    # Momento rejeitado → gravação pode ser apagada por inteiro
    for c in svc.candidates.for_recording(rec.id):
        svc.candidates.set_status(c.id, CandidateStatus.REJECTED)
    svc.purge_expired()
    assert svc.recordings.get(rec.id).status is RecordingStatus.PURGED


def test_reconcile_restarts_live_streams_but_respects_user(capture_env, monkeypatch):
    svc, repos, _ = capture_env
    s = live_streamer(repos)
    assert svc.reconcile() == [s.id]                     # app aberto com a live já rolando
    assert svc.reconcile() == []                         # já há captura ativa
    job = repos["jobs"].list()[0]
    repos["jobs"].claim_next([JobType.CAPTURE])
    repos["jobs"].finish(job.id, JobStatus.COMPLETED)    # Streamlink caiu, mas a live continua
    assert svc.reconcile() == [s.id]
    job2 = repos["jobs"].list((JobStatus.QUEUED,))[0]
    repos["jobs"].cancel_if_queued(job2.id)              # usuário cancelou: não insistir
    assert svc.reconcile() == []

    other = live_streamer(repos, login="dois", stream_id="z")
    svc.reconcile()
    failed = repos["jobs"].latest_by_dedupe(f"capture:{other.id}:z")
    repos["jobs"].claim_next([JobType.CAPTURE])
    repos["jobs"].finish(failed.id, JobStatus.FAILED, error="disco cheio")
    assert svc.reconcile() == []                         # falha recente: espera
    import capture.service as mod

    monkeypatch.setattr(mod, "utcnow", lambda: utcnow() + timedelta(minutes=11))
    assert svc.reconcile() == [other.id]

    settings = repos["settings"].load()
    settings.auto_capture = False
    repos["settings"].save(settings)
    repos["jobs"].finish(repos["jobs"].list((JobStatus.QUEUED,))[0].id, JobStatus.COMPLETED)
    assert svc.reconcile() == []
