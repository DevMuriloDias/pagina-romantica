from pathlib import Path

import pytest

from config.settings import AppSettings
from database.repositories import CandidateRepository, ClipRepository, RecordingRepository
from models.candidate import Candidate, CandidateStatus
from models.clip import ClipStatus
from models.job import JobType
from models.recording import Recording, Segment
from models.status import ToolInfo
from models.streamer import Streamer
from services.tools import ToolsService
from tests.helpers import HAS_FFMPEG, FakeCtx
from tests.test_render import TRANSCRIPT, make_recording
from video.service import ClipError, ClipService
from workers.job_worker import JobCancelled, JobWorker

pytestmark = pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")


@pytest.fixture
def env(repos, tmp_path):
    db = repos["streamers"].db
    out = tmp_path / "out"
    repos["settings"].save(AppSettings(output_dir=str(out), video_quality="rapido"))
    s = repos["streamers"].add(Streamer(login="gaules", display_name="Gaulês", authorized=True))
    recs, cands, clips = RecordingRepository(db), CandidateRepository(db), ClipRepository(db)
    paths, durations, segs = make_recording(tmp_path)
    rec = recs.create(Recording(streamer_id=s.id, stream_id="1", directory=str(tmp_path)))
    for info, path in zip(segs, paths):
        recs.add_segment(Segment(rec.id, info.index, path, info.start, info.duration, bytes=Path(path).stat().st_size))
    start = segs[1].start - 2.0
    cand, _ = cands.insert_selected(Candidate(rec.id, s.id, start, start + 5.0, start + 1.0, 82.0, 75.0,
                                              status=CandidateStatus.SCORED, transcript=TRANSCRIPT), 15, 6)
    tools = ToolsService(detector=lambda n: ToolInfo(n, True, "x", path=n))
    jobs = JobWorker(repos["jobs"])
    svc = ClipService(cands, recs, clips, repos["settings"], repos["activity"], jobs, tools)
    return svc, cand, out, repos


def run(svc, job):
    return svc.handle(FakeCtx(job.payload, JobType.RENDER, job.streamer_id, job.id))


def test_render_saves_video_subtitles_and_thumbnail(env):
    svc, cand, out, repos = env
    job = svc.enqueue(cand.id)
    assert svc.candidates.get(cand.id).status is CandidateStatus.APPROVED  # protegido enquanto renderiza
    msg = run(svc, job)
    clip = svc.clips.get_by_candidate(cand.id)
    assert clip.status is ClipStatus.PENDING and clip.has_subtitles
    video = Path(clip.path)
    assert video.parent == out / "pending" and video.name.startswith("Gaules_") and "_n82_m" in video.name
    assert video.exists() and clip.size_bytes == video.stat().st_size
    assert (clip.width, clip.height) == (1080, 1920) and clip.duration == pytest.approx(5.0, abs=0.15)
    assert Path(clip.srt_path).read_text(encoding="utf-8").startswith("1\n00:00:00,500 --> ")
    assert Path(clip.thumbnail_path).parent == out / "thumbnails" and Path(clip.thumbnail_path).exists()
    assert svc.candidates.get(cand.id).status is CandidateStatus.RENDERED
    assert "Clipe salvo" in msg and clip.transcript_text == "que jogada absurda"
    assert not any((out / ".work").iterdir())  # pasta temporária limpa


def test_rerender_replaces_and_resets_review(env):
    svc, cand, out, repos = env
    run(svc, svc.enqueue(cand.id))
    first = svc.clips.get_by_candidate(cand.id)
    svc.clips.move(first.id, ClipStatus.APPROVED, first.path, first.srt_path)
    settings = repos["settings"].load()
    settings.clip_layout = "crop"
    settings.burn_subtitles = False
    repos["settings"].save(settings)
    msg = run(svc, svc.enqueue(cand.id))
    second = svc.clips.get_by_candidate(cand.id)
    assert second.id == first.id and second.layout == "crop" and not second.has_subtitles
    assert second.status is ClipStatus.PENDING and "sem legendas" in msg
    assert Path(second.srt_path).exists()  # .srt continua disponível mesmo sem queimar a legenda
    assert len(list((out / "pending").glob("*.mp4"))) == 1


def test_errors_are_explicit(env):
    svc, cand, out, repos = env
    with pytest.raises(ClipError, match="não encontrado"):
        svc.enqueue(9999)
    svc.candidates.set_status(cand.id, CandidateStatus.DETECTED)
    with pytest.raises(ClipError, match="não pode virar clipe"):
        svc.enqueue(cand.id)
    svc.candidates.set_status(cand.id, CandidateStatus.SCORED)
    job = svc.enqueue(cand.id)
    for seg in svc.recordings.segments(cand.recording_id):
        Path(seg.path).unlink()
    with pytest.raises(ClipError, match="removidos"):
        run(svc, job)
    with pytest.raises(ClipError, match="removidos"):
        svc.enqueue(cand.id)


def test_missing_ffmpeg_is_reported(env):
    svc, cand, out, repos = env
    svc.tools = ToolsService(detector=lambda n: ToolInfo(n, False))
    svc.tools.refresh()
    with pytest.raises(ClipError, match="FFmpeg não encontrado"):
        run(svc, svc.enqueue(cand.id))
    assert svc.clips.get_by_candidate(cand.id) is None


def test_cancel(env):
    svc, cand, out, repos = env
    job = svc.enqueue(cand.id)
    ctx = FakeCtx(job.payload, JobType.RENDER, job.streamer_id, job.id)
    ctx.cancel = True
    with pytest.raises(JobCancelled):
        svc.handle(ctx)
    assert not list((out / "pending").glob("*.mp4")) and svc.clips.get_by_candidate(cand.id) is None


def test_auto_render_setting(env):
    svc, cand, out, repos = env
    svc.on_scored(cand)
    assert [j.job_type for j in repos["jobs"].list()] == [JobType.RENDER]
    assert svc.candidates.get(cand.id).status is CandidateStatus.SCORED  # automático não "aprova"
    settings = repos["settings"].load()
    settings.auto_render = False
    repos["settings"].save(settings)
    repos["jobs"].clear_finished()
    for j in repos["jobs"].list():
        repos["jobs"].delete(j.id)
    svc.on_scored(cand)
    assert repos["jobs"].list() == []
