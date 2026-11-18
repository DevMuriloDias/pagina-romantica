"""Pipeline de detecção com FFmpeg real: arquivo .ts → análise → transcrição (Whisper falso)."""
import pytest

from config.settings import AppSettings
from database.repositories import CandidateRepository, RecordingRepository
from detection.analyzer import DetectionService
from detection.vad import EnergyVAD
from models.candidate import CandidateStatus, TranscriptSegment, TranscriptWord
from models.job import JobStatus, JobType
from models.recording import Recording, Segment, SegmentStatus
from models.streamer import Streamer
from tests.helpers import HAS_FFMPEG, FakeCtx, synth_stream_audio, write_ts
from workers.job_worker import JobWorker

pytestmark = pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")


class FakeTranscriber:
    def __init__(self, text):
        self.text, self.calls, self.model_name = text, [], "small"

    def transcribe(self, audio):
        duration = audio.size / 16000
        self.calls.append(duration)
        tokens = self.text.split()
        step = (duration - 5.0) / max(1, len(tokens) - 1)  # fala de 2 s até ~3 s antes do fim
        words = [TranscriptWord(2.0 + i * step, 2.3 + i * step, w) for i, w in enumerate(tokens)]
        return [TranscriptSegment(2.0, words[-1].end, self.text, words)], "pt"


@pytest.fixture
def env(repos, tmp_path, request):
    excited = getattr(request, "param", (170, 180))
    db = repos["streamers"].db
    repos["settings"].save(AppSettings(clip_duration_seconds=45, min_moment_score=55))
    s = repos["streamers"].add(Streamer(login="canal", display_name="Canal", authorized=True))
    recs, cands = RecordingRepository(db), CandidateRepository(db)
    rec = recs.create(Recording(streamer_id=s.id, stream_id="1", directory=str(tmp_path)))
    audio = synth_stream_audio(240, excited=excited, seed=7)
    # dois segmentos de 120 s; o momento fica perto da divisa, no segundo
    for i in range(2):
        path = write_ts(audio[i * 120 * 16000:(i + 1) * 120 * 16000], tmp_path / f"seg_{i:05d}.ts")
        recs.add_segment(Segment(rec.id, i, str(path), i * 120.0, 120.0, bytes=path.stat().st_size))
    jobs = JobWorker(repos["jobs"])
    return s, rec, recs, cands, jobs, repos


def make_service(env, transcriber):
    s, rec, recs, cands, jobs, repos = env
    return DetectionService(recs, cands, repos["settings"], repos["activity"], jobs, transcriber=transcriber,
                            vad_factory=EnergyVAD)


def analyze_all(svc, recs, rec):
    msgs = []
    for seg in recs.segments(rec.id):
        msgs.append(svc.handle_analysis(FakeCtx({"segment_id": seg.id})))
    return msgs


def test_analysis_finds_moment_and_queues_transcription(env):
    s, rec, recs, cands, jobs, repos = env
    svc = make_service(env, FakeTranscriber("meu deus que jogada clipa isso"))
    msgs = analyze_all(svc, recs, rec)
    assert all("Segmento" in m for m in msgs)
    assert all(g.status is SegmentStatus.ANALYZED for g in recs.segments(rec.id))
    found = [c for c in cands.for_recording(rec.id) if c.status is CandidateStatus.DETECTED]
    assert len(found) == 1
    c = found[0]
    assert 165 <= c.peak <= 185 and c.start < 170 and c.end > 175
    assert c.breakdown["vad"] == "VAD por energia" and c.breakdown["audio"]["pico"] > 50
    queued = [j for j in repos["jobs"].list((JobStatus.QUEUED,)) if j.job_type is JobType.TRANSCRIPTION]
    assert [j.payload["candidate_id"] for j in queued] == [c.id]

    # Re-analisar o mesmo segmento não duplica o momento (sobreposição bloqueada).
    svc.handle_analysis(FakeCtx({"segment_id": recs.segments(rec.id)[1].id}))
    assert len([c for c in cands.for_recording(rec.id) if c.status is CandidateStatus.DETECTED]) == 1


def test_transcription_scores_and_refines(env):
    s, rec, recs, cands, jobs, repos = env
    fake = FakeTranscriber("meu deus que jogada clipa isso")
    svc = make_service(env, fake)
    analyze_all(svc, recs, rec)
    c = next(c for c in cands.for_recording(rec.id) if c.status is CandidateStatus.DETECTED)
    msg = svc.handle_transcription(FakeCtx({"candidate_id": c.id}, JobType.TRANSCRIPTION))
    done = cands.get(c.id)
    assert done.status is CandidateStatus.SCORED, msg
    assert fake.calls and abs(fake.calls[0] - c.duration) < 0.5      # só o trecho foi transcrito
    assert done.score > c.audio_score and done.breakdown["pedido_de_clipe"] is True
    assert "clipa isso" in done.breakdown["termos"]
    assert done.start == pytest.approx(c.start + 1.7, abs=0.01)       # silêncio inicial aparado
    assert done.transcript[0].words[0].start == pytest.approx(0.3, abs=0.01)  # tempos relativos ao novo início
    assert done.language == "pt" and "clipa isso" in done.text
    assert any("Momento detectado" in a["message"] for a in repos["activity"].recent())


def test_transcription_discards_below_minimum(env):
    s, rec, recs, cands, jobs, repos = env
    settings = repos["settings"].load()
    settings.min_moment_score = 99
    repos["settings"].save(settings)
    svc = make_service(env, FakeTranscriber("ok"))
    analyze_all(svc, recs, rec)
    for c in cands.for_recording(rec.id):
        if c.status is CandidateStatus.DETECTED:
            assert "Descartado" in svc.handle_transcription(FakeCtx({"candidate_id": c.id}, JobType.TRANSCRIPTION))
            assert cands.get(c.id).status is CandidateStatus.DISCARDED


def test_without_transcription_moments_are_final(env):
    s, rec, recs, cands, jobs, repos = env
    settings = repos["settings"].load()
    settings.transcribe_moments = False
    repos["settings"].save(settings)
    svc = make_service(env, None)
    analyze_all(svc, recs, rec)
    statuses = {c.status for c in cands.for_recording(rec.id)}
    assert statuses == {CandidateStatus.SCORED}
    assert not [j for j in repos["jobs"].list() if j.job_type is JobType.TRANSCRIPTION]


def test_missing_files_are_handled(env, tmp_path):
    s, rec, recs, cands, jobs, repos = env
    svc = make_service(env, FakeTranscriber("x"))
    analyze_all(svc, recs, rec)
    for g in recs.segments(rec.id):
        (tmp_path / f"seg_{g.index:05d}.ts").unlink()
    c = next(c for c in cands.for_recording(rec.id) if c.status is CandidateStatus.DETECTED)
    assert "não estão mais disponíveis" in svc.handle_transcription(FakeCtx({"candidate_id": c.id}))
    assert "não está mais disponível" in svc.handle_analysis(FakeCtx({"segment_id": recs.segments(rec.id)[0].id}))


def test_silero_vad_runs_offline():
    pytest.importorskip("faster_whisper")
    from detection.vad import SileroVAD

    spans = SileroVAD().speech_spans(synth_stream_audio(20, excited=None))
    assert isinstance(spans, list)  # ruído sintético não é voz humana; só valida a integração


@pytest.mark.parametrize("env", [(108, 120)], indirect=True)
def test_moment_at_segment_boundary_gets_full_window(env):
    """Evento termina exatamente na divisa (120 s): não pode virar um clipe cortado no fim do segmento."""
    s, rec, recs, cands, jobs, repos = env
    svc = make_service(env, FakeTranscriber("x"))
    first, second = recs.segments(rec.id)
    svc.handle_analysis(FakeCtx({"segment_id": first.id}))
    assert cands.for_recording(rec.id) == []          # adiado: falta áudio depois do pico
    svc.handle_analysis(FakeCtx({"segment_id": second.id}))
    found = [c for c in cands.for_recording(rec.id) if c.status is CandidateStatus.DETECTED]
    assert len(found) == 1
    c = found[0]
    assert c.start < 105 and c.end > 125               # evento inteiro, com contexto antes e depois
    assert 0.4 < (c.peak - c.start) / c.duration < 0.8


def test_last_segment_of_finished_recording_covers_the_end(env):
    from models.recording import RecordingStatus

    s, rec, recs, cands, jobs, repos = env
    recs.finish(rec.id, RecordingStatus.COMPLETED)
    svc = make_service(env, FakeTranscriber("x"))
    from detection.scoring import audio_candidates as real

    seen = {}

    def spy(*a, **kw):
        seen.update(kw)
        return real(*a, **kw)

    import detection.analyzer as mod

    mod.audio_candidates, original = spy, mod.audio_candidates
    try:
        svc.handle_analysis(FakeCtx({"segment_id": recs.segments(rec.id)[-1].id}))
    finally:
        mod.audio_candidates = original
    assert seen["search_until"] is None
