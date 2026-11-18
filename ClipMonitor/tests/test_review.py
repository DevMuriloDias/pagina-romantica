import os
from pathlib import Path

import pytest

from config.settings import AppSettings
from database.repositories import CandidateRepository, ClipRepository, RecordingRepository
from models.candidate import Candidate, CandidateStatus
from models.clip import Clip, ClipStatus
from models.recording import Recording
from models.streamer import Streamer
from services.review_service import ReviewError, ReviewService


@pytest.fixture
def env(repos, tmp_path):
    db = repos["streamers"].db
    out = tmp_path / "out"
    repos["settings"].save(AppSettings(output_dir=str(out)))
    s = repos["streamers"].add(Streamer(login="canal", authorized=True))
    rec = RecordingRepository(db).create(Recording(streamer_id=s.id, stream_id="1", directory=str(tmp_path)))
    cands, clips = CandidateRepository(db), ClipRepository(db)
    cand, _ = cands.insert_selected(Candidate(rec.id, s.id, 0, 45, 27, 80, 80, status=CandidateStatus.RENDERED), 15, 6)
    pending = out / "pending"
    pending.mkdir(parents=True)
    video, srt, thumb = pending / "clip.mp4", pending / "clip.srt", out / "thumbnails" / "clip.jpg"
    thumb.parent.mkdir(parents=True)
    for f, data in ((video, b"video"), (srt, b"1\n"), (thumb, b"jpg")):
        f.write_bytes(data)
    clip = clips.upsert(Clip(cand.id, s.id, str(video), 45.0, 80, "blur", srt_path=str(srt), thumbnail_path=str(thumb)))
    return ReviewService(clips, cands, repos["settings"], repos["activity"]), clip, out


def test_approve_reject_restore_move_files(env):
    svc, clip, out = env
    approved = svc.approve(clip.id)
    assert approved.status is ClipStatus.APPROVED and approved.reviewed_at is not None
    assert Path(approved.path) == out / "approved" / "clip.mp4" and Path(approved.path).read_bytes() == b"video"
    assert Path(approved.srt_path) == out / "approved" / "clip.srt"
    assert not (out / "pending" / "clip.mp4").exists()
    rejected = svc.reject(clip.id)
    assert Path(rejected.path).parent == out / "rejected"
    back = svc.restore(clip.id)
    assert back.status is ClipStatus.PENDING and Path(back.path) == out / "pending" / "clip.mp4"


def test_name_conflict_gets_suffix_and_srt_follows(env):
    svc, clip, out = env
    (out / "approved").mkdir()
    (out / "approved" / "clip.mp4").write_bytes(b"outro")
    moved = svc.approve(clip.id)
    assert Path(moved.path).name == "clip_2.mp4" and Path(moved.srt_path).name == "clip_2.srt"
    assert (out / "approved" / "clip.mp4").read_bytes() == b"outro"  # nada sobrescrito


def test_locked_file_keeps_everything_consistent(env, monkeypatch):
    svc, clip, out = env
    real = os.replace
    calls = []

    def flaky(src, dst):
        calls.append(src)
        if str(src).endswith(".srt"):  # vídeo já movido, legenda bloqueada
            raise PermissionError(13, "Permission denied")
        return real(src, dst)

    monkeypatch.setattr(os, "replace", flaky)
    with pytest.raises(ReviewError, match="em uso"):
        svc.approve(clip.id)
    monkeypatch.setattr(os, "replace", real)
    assert (out / "pending" / "clip.mp4").exists() and (out / "pending" / "clip.srt").exists()  # rollback
    assert not (out / "approved" / "clip.mp4").exists()
    assert svc.clips.get(clip.id).status is ClipStatus.PENDING


def test_missing_file_and_delete(env):
    svc, clip, out = env
    Path(clip.path).unlink()
    assert [c.id for c in svc.missing_files()] == [clip.id]
    with pytest.raises(ReviewError, match="não existe mais"):
        svc.approve(clip.id)
    svc.delete(clip.id)
    assert svc.clips.get(clip.id) is None
    assert not (out / "pending" / "clip.srt").exists() and not (out / "thumbnails" / "clip.jpg").exists()
    assert svc.candidates.get(clip.candidate_id).status is CandidateStatus.SCORED  # pode ser gerado de novo
