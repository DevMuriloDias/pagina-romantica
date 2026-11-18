import numpy as np
import pytest

from detection.features import compute_features
from detection.scoring import (
    PEAK_POSITION, audio_candidates, combine, normalize, parse_custom_keywords, refine_with_words, score_text,
    window_bounds,
)
from detection.selection import decide, suppress
from detection.vad import EnergyVAD
from models.candidate import Candidate, CandidateStatus, TranscriptSegment, TranscriptWord
from tests.helpers import synth_stream_audio


def suppress_windows(windows, gap=15):
    cands = [Candidate(1, 1, w.start, w.end, w.peak, w.score, w.score) for w in windows]
    return suppress(cands, gap)


def analyze(audio, clip=45):
    spans = EnergyVAD().speech_spans(audio)
    return compute_features(audio, spans), spans


# ---------------------------------------------------------------- VAD e intensidade

def test_energy_vad_finds_speech_and_pauses():
    audio = synth_stream_audio(60, excited=None)
    spans = EnergyVAD().speech_spans(audio)
    talk = sum(e - s for s, e in spans)
    assert len(spans) > 5            # várias frases separadas por pausas
    assert 0.5 < talk / 60 < 0.95    # nem tudo é fala


def test_excited_section_is_top_candidate():
    audio = synth_stream_audio(300, excited=(150, 160))
    f, _ = analyze(audio)
    windows = audio_candidates(f, 45)
    best = max(windows, key=lambda w: w.score)
    assert 148 <= best.peak <= 162
    assert best.start < best.peak < best.end
    assert 27 <= best.end - best.start <= 63           # 0,6x–1,4x do tamanho pedido
    assert best.score > 60
    # Janelas que não tocam o trecho empolgado (as que tocam são removidas pela supressão).
    others = [w.score for w in windows if w.end < 150 or w.start > 160]
    assert max(others, default=0) < best.score - 30   # destaque claro sobre conversa normal
    assert [w.peak for w in suppress_windows(windows) if w.score > 60] == [best.peak]


def test_detection_independent_of_microphone_gain():
    audio = synth_stream_audio(240, excited=(100, 110), seed=3)
    loud = max(audio_candidates(analyze(audio)[0], 45), key=lambda w: w.score)
    quiet = max(audio_candidates(analyze(audio * 0.1)[0], 45), key=lambda w: w.score)
    assert abs(loud.peak - quiet.peak) < 2
    assert abs(loud.score - quiet.score) < 8


def test_monotone_talk_scores_low():
    f, _ = analyze(synth_stream_audio(240, excited=None, seed=5))
    assert max((w.score for w in audio_candidates(f, 45)), default=0) < 45


def test_search_from_excludes_context():
    audio = synth_stream_audio(200, excited=(20, 28))
    f, _ = analyze(audio)
    assert all(w.peak >= 60 for w in audio_candidates(f, 45, search_from=60))


def test_window_bounds_peak_position_and_speech_snap():
    start, end = window_bounds(100, 40, 300, spans=[])
    assert (start, end) == (100 - PEAK_POSITION * 40, 100 - PEAK_POSITION * 40 + 40)
    # início cai no meio de uma frase iniciada 2 s antes → recua para o começo da frase
    # e o fim cai no meio de outra frase → estende até o fim dela
    start, end = window_bounds(100, 40, 300, spans=[(74.0, 80.0), (114.0, 119.0)])
    assert start == 74.0 and end == 119.0
    # borda no começo do arquivo
    assert window_bounds(5, 40, 300, spans=[])[0] == 0


# ---------------------------------------------------------------- texto

def seg(text, start=0.0, end=5.0, words=None):
    return TranscriptSegment(start, end, text, words or [])


def test_normalize_strips_accents_and_punctuation():
    assert normalize("NÃO ACREDITO!!! Misericórdia...") == "nao acredito misericordia"


def test_text_score_keywords_laughter_and_explicit_clip():
    plain = score_text([seg("então pessoal vamos continuar a partida aqui")], 45)
    hype = score_text([seg("MEU DEUS não acredito kkkkkk que jogada! clipa isso")], 45)
    assert plain.score < 10
    assert hype.score > 50 and hype.explicit_clip
    assert {"meu deus", "nao acredito", "que jogada", "clipa isso"} <= set(hype.hits)
    assert "clipa" not in hype.hits  # contido em "clipa isso": não conta duas vezes
    assert hype.parts["risadas"] > 0


def test_custom_keywords():
    custom = parse_custom_keywords("Bordão Do Canal, ,  outro termo")
    assert set(custom) == {"bordao do canal", "outro termo"}
    assert "bordao do canal" in score_text([seg("e lá vem o bordão do canal")], 30, custom).hits


def test_combine_text_only_raises_score():
    weak_text = score_text([seg("ok")], 45)
    assert combine(70, weak_text) == 70
    strong = score_text([seg("meu deus caraca não acredito socorro kkkk")], 45)
    assert combine(50, strong) > 50
    assert combine(95, score_text([seg("clipa isso")], 45)) == 100  # limitado a 100
    assert combine(42.04, None) == 42.0


def test_refine_with_words_trims_leading_silence():
    words = [TranscriptWord(3.0, 3.4, "meu"), TranscriptWord(3.4, 3.8, "deus"), TranscriptWord(38.0, 38.5, "fim")]
    start, end = refine_with_words(100, 145, [seg("meu deus fim", 3, 38.5, words)], 45)
    assert start == pytest.approx(102.7) and end == pytest.approx(139.1)
    # nunca encolhe abaixo de 60% do tamanho
    short = [TranscriptWord(20.0, 21.0, "oi")]
    assert refine_with_words(100, 145, [seg("oi", 20, 21, short)], 45) == (100, 145)


# ---------------------------------------------------------------- sobreposição

def cand(start, end, score, status=CandidateStatus.SCORED, cid=None):
    return Candidate(1, 1, start, end, (start + end) / 2, score, score, status=status, id=cid)


def test_suppress_keeps_best_non_overlapping():
    picked = suppress([cand(0, 45, 60), cand(30, 75, 80), cand(70, 115, 50), cand(200, 245, 40)], gap=10)
    assert [(c.start, c.score) for c in picked] == [(30, 80), (200, 40)]


def test_decide_overlap_rules():
    existing = [cand(100, 145, 70, cid=1), cand(400, 445, 90, status=CandidateStatus.APPROVED, cid=2)]
    assert not decide(cand(130, 175, 60), existing, gap=15).accept          # pior que o vizinho
    better = decide(cand(130, 175, 75), existing, gap=15)
    assert better.accept and better.replace == [1]                           # substitui o pior
    assert not decide(cand(420, 465, 99), existing, gap=15).accept          # aprovado é protegido
    assert decide(cand(160, 205, 10), existing, gap=10).accept               # folga respeitada (145+10 < 160)
    assert not decide(cand(150, 195, 10), existing, gap=10).accept           # dentro da folga


def test_decide_density_limit():
    existing = [cand(i * 300, i * 300 + 45, 60 + i, cid=i + 1) for i in range(3)]  # picos 22, 322, 622
    assert not decide(cand(900, 945, 50), existing, gap=15, max_per_hour=3).accept
    d = decide(cand(900, 945, 70), existing, gap=15, max_per_hour=3)
    assert d.accept and d.replace == [1]                                     # tira o mais fraco
    ignored = decide(cand(900, 945, 70), [*existing[:2], cand(5000, 5045, 1, status=CandidateStatus.DISCARDED, cid=9)],
                     gap=15, max_per_hour=3)
    assert ignored.accept and ignored.replace == []                         # descartados não contam


def test_repository_insert_is_atomic_and_respects_overlap(repos):
    from models.recording import Recording
    from models.streamer import Streamer

    s = repos["streamers"].add(Streamer(login="canal", authorized=True))
    from database.repositories import CandidateRepository, RecordingRepository

    db = repos["streamers"].db
    recs, cands = RecordingRepository(db), CandidateRepository(db)
    rec = recs.create(Recording(streamer_id=s.id, stream_id="1", directory="/tmp/x"))
    first, _ = cands.insert_selected(Candidate(rec.id, s.id, 100, 145, 127, 60, 60), 15, 6)
    second, d = cands.insert_selected(Candidate(rec.id, s.id, 120, 165, 147, 80, 80), 15, 6)
    assert second is not None and d.replace == [first.id]
    assert cands.get(first.id).status is CandidateStatus.DISCARDED
    third, d3 = cands.insert_selected(Candidate(rec.id, s.id, 150, 195, 177, 50, 50), 15, 6)
    assert third is None and "melhor" in d3.reason
