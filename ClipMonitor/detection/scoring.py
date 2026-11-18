"""Pontuação de momentos candidatos.

Etapa 1 (barata, todo o áudio): picos de "excitação" (volume acima do normal +
subidas bruscas) viram janelas com o pico a ~60% do clipe — o contexto antes do
clímax é o que faz um clipe funcionar. Bordas são ajustadas aos limites de fala
para não cortar frases no meio.

Etapa 2 (cara, só candidatos): a transcrição alimenta a pontuação por texto
(palavras-chave, risadas, ritmo de fala) e refina as bordas pelas palavras.

Todas as pontuações são 0–100 e o detalhamento é guardado para a interface.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

import numpy as np

from config.keywords import EXPLICIT_CLIP_TERMS, KEYWORDS, LAUGH_PATTERNS
from detection.features import AudioFeatures
from detection.vad import Span
from models.candidate import TranscriptSegment

PEAK_POSITION = 0.6


def tail_after_peak(clip_length: float) -> float:
    """Quanto áudio é necessário depois de um pico para montar a janela completa."""
    return (1 - PEAK_POSITION) * clip_length
EDGE_SNAP = 4.0
PEAK_TOLERANCE_DB = 0.5

AUDIO_WEIGHTS = {"pico": 0.30, "subida": 0.25, "intensidade": 0.15, "rajadas": 0.15, "fala": 0.15}
TEXT_WEIGHTS = {"palavras": 0.6, "ritmo": 0.25, "risadas": 0.15}
AUDIO_SHARE = 0.7  # peso do áudio na média com o texto


@dataclass
class Window:
    start: float
    end: float
    peak: float
    score: float
    breakdown: dict


# ---------------------------------------------------------------- etapa 1: áudio

def excitement_curve(f: AudioFeatures) -> np.ndarray:
    raw = f.excess + 0.8 * f.rise
    k = max(1, int(1.0 / f.hop))
    return np.convolve(raw, np.ones(k) / k, mode="same")


def find_peaks(curve: np.ndarray, hop: float, min_distance: float = 8.0, min_value: float = 3.0,
               limit: int = 20) -> list[int]:
    order = np.argsort(curve)[::-1]
    chosen: list[int] = []
    dist = int(min_distance / hop)
    for i in order:
        if curve[i] < min_value or len(chosen) >= limit:
            break
        if all(abs(i - c) >= dist for c in chosen):
            chosen.append(int(i))
    return chosen


def _count_bursts(excess: np.ndarray, hop: float, threshold: float = 6.0, separation: float = 1.5) -> int:
    above = excess > threshold
    starts = np.flatnonzero(above & ~np.concatenate([[False], above[:-1]]))
    count, last = 0, -1e9
    for s in starts:
        if (s - last) * hop >= separation:
            count += 1
            last = s
    return count


def score_window(f: AudioFeatures, start: float, end: float) -> tuple[float, dict]:
    a, b = f.index(start), max(f.index(end), f.index(start) + 1)
    excess, rise, speech = f.excess[a:b], f.rise[a:b], f.speech[a:b]
    parts = {
        "pico": float(np.clip(np.percentile(excess, 95) / 12.0, 0, 1)),
        "subida": float(np.clip(rise.max() / 10.0, 0, 1)),
        "intensidade": float(np.clip(excess.mean() / 5.0, 0, 1)),
        "rajadas": float(np.clip(_count_bursts(excess, f.hop) / 4.0, 0, 1)),
        "fala": float(np.clip(speech.mean() / 0.6, 0, 1)),
    }
    score = 100 * sum(AUDIO_WEIGHTS[k] * v for k, v in parts.items())
    if speech.mean() < 0.15:
        score *= 0.6  # quase sem voz: provavelmente só som do jogo/música
    return float(score), {k: round(v * 100) for k, v in parts.items()}


def _snap_start(t: float, spans: list[Span]) -> float:
    for s, e in spans:
        if s < t < e and t - s <= EDGE_SNAP:
            return s  # começa no início da frase em curso
        if t <= s <= t + EDGE_SNAP / 2:
            return s  # pula silêncio inicial curto
    return t


def _snap_end(t: float, spans: list[Span]) -> float:
    for s, e in spans:
        if s < t < e:
            return e if e - t <= EDGE_SNAP else t  # termina a frase
    return t


def window_bounds(peak: float, length: float, duration: float, spans: list[Span],
                  lo: float = 0.0) -> tuple[float, float]:
    start = max(lo, peak - PEAK_POSITION * length)
    end = min(duration, start + length)
    start = max(lo, end - length)
    start, end = _snap_start(start, spans), _snap_end(end, spans)
    min_len, max_len = 0.6 * length, 1.4 * length
    if end - start < min_len:
        end = min(duration, start + min_len)
    if end - start > max_len:
        end = start + max_len
    return round(start, 2), round(end, 2)


def audio_candidates(f: AudioFeatures, clip_length: float, search_from: float = 0.0,
                     search_until: float | None = None, limit: int = 20) -> list[Window]:
    """Janelas cujo pico está em [``search_from``, ``search_until``).

    Picos fora desse intervalo pertencem ao segmento vizinho, que os enxerga
    com contexto completo antes e depois.
    """
    curve = excitement_curve(f)
    lo_index = f.index(search_from)
    hi_index = f.index(search_until) if search_until is not None else len(curve)
    peaks = [i for i in find_peaks(curve, f.hop, limit=limit * 3) if lo_index <= i < hi_index][:limit]
    windows = []
    for i in peaks:
        peak = i * f.hop
        start, end = window_bounds(peak, clip_length, f.duration, f.spans)
        # O pico precisa dominar a própria janela: se há um ponto mais intenso nela, é ele o
        # clímax de verdade (e terá a sua própria janela). Sem isso, um pico fraco "pegaria
        # carona" na nota de um evento vizinho, gerando um clipe com o clímax fora de posição.
        if curve[f.index(start):f.index(end)].max() > curve[i] + PEAK_TOLERANCE_DB:
            continue
        score, parts = score_window(f, start, end)
        windows.append(Window(start, end, peak, score, {"audio": parts}))
    return windows


# ---------------------------------------------------------------- etapa 2: texto

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text)).strip()


def parse_custom_keywords(raw: str) -> dict[str, float]:
    return {normalize(k): 2.0 for k in raw.split(",") if normalize(k)}


@dataclass
class TextScore:
    score: float
    parts: dict
    hits: dict
    explicit_clip: bool


def score_text(segments: list[TranscriptSegment], duration: float,
               custom: dict[str, float] | None = None) -> TextScore:
    text = normalize(" ".join(s.text for s in segments))
    if not text:
        return TextScore(0.0, {"palavras": 0, "ritmo": 0, "risadas": 0}, {}, False)
    lexicon = {**KEYWORDS, **(custom or {})}
    padded = f" {text} "
    hits = {}
    for term, weight in lexicon.items():
        n = padded.count(f" {term} ")
        if n:
            hits[term] = n
    # Termos contidos em termos maiores ("meu deus" em "ai meu deus") não contam duas vezes.
    for term in list(hits):
        for other in hits:
            if other != term and f" {term} " in f" {other} ":
                hits[term] = max(0, hits[term] - hits[other])
    hits = {k: v for k, v in hits.items() if v}
    keyword_points = sum(lexicon[k] * min(v, 3) for k, v in hits.items())
    laughs = sum(len(re.findall(p, text)) for p in LAUGH_PATTERNS)
    words = len(text.split())
    wps = words / max(duration, 1.0)
    parts = {
        "palavras": float(np.clip(keyword_points / 8.0, 0, 1)),
        "ritmo": float(np.clip((wps - 1.5) / 2.0, 0, 1)),
        "risadas": float(np.clip((laughs + hits.get("risos", 0)) / 2.0, 0, 1)),
    }
    score = 100 * sum(TEXT_WEIGHTS[k] * v for k, v in parts.items())
    explicit = any(t in hits for t in EXPLICIT_CLIP_TERMS)
    return TextScore(float(score), {k: round(v * 100) for k, v in parts.items()}, hits, explicit)


def combine(audio_score: float, text: TextScore | None) -> float:
    if text is None:
        return round(audio_score, 1)
    # O texto só pode elevar a nota: uma reação alta sem palavras (grito, susto)
    # continua valendo o que o áudio indicou.
    score = max(audio_score, AUDIO_SHARE * audio_score + (1 - AUDIO_SHARE) * text.score)
    if text.explicit_clip:
        score += 10  # alguém pediu "clipa isso"
    return round(float(min(100.0, score)), 1)


def refine_with_words(start: float, end: float, segments: list[TranscriptSegment],
                      clip_length: float) -> tuple[float, float]:
    """Aparar silêncio no começo e terminar após a última palavra (tempos relativos a ``start``)."""
    words = [w for s in segments for w in s.words]
    if not words:
        return start, end
    first, last = words[0].start, words[-1].end
    new_start = start + max(0.0, first - 0.3) if first > 1.5 else start
    new_end = min(end, start + last + 0.6)
    if new_end - new_start < 0.6 * clip_length:
        return start, end
    return round(new_start, 2), round(new_end, 2)
