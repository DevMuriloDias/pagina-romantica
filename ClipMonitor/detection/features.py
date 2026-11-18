"""Curvas de intensidade do áudio.

Tudo em grade de ``HOP`` segundos:
- ``loudness``: nível RMS em dB (janela de 0,5 s);
- ``baseline``: mediana móvel de 60 s — o "normal" do streamer naquele trecho;
- ``excess``: quanto o volume está acima do normal (dB);
- ``rise``: variação brusca — volume dos próximos 2 s menos o dos 8 s anteriores;
- ``speech``: fração de cada passo com voz detectada.
Comparar com a linha de base (e não com um volume absoluto) torna a detecção
independente do ganho do microfone de cada streamer.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from detection.audio import SAMPLE_RATE
from detection.vad import Span

HOP = 0.25
FRAME = 0.5
BASELINE_SECONDS = 60
RISE_BEFORE = 8.0
RISE_AFTER = 2.0
SILENCE_DB = -60.0


@dataclass
class AudioFeatures:
    hop: float
    loudness: np.ndarray
    baseline: np.ndarray
    excess: np.ndarray
    rise: np.ndarray
    speech: np.ndarray
    spans: list[Span]

    @property
    def duration(self) -> float:
        return len(self.loudness) * self.hop

    def index(self, t: float) -> int:
        return int(max(0, min(len(self.loudness), round(t / self.hop))))


def _moving(values: np.ndarray, width: int, fn) -> np.ndarray:
    width = max(1, width)
    pad = width // 2
    padded = np.pad(values, (pad, width - pad - 1), mode="edge")
    windows = np.lib.stride_tricks.sliding_window_view(padded, width)
    return fn(windows, axis=1)


def loudness_curve(audio: np.ndarray, hop: float = HOP, frame: float = FRAME) -> np.ndarray:
    hop_n, frame_n = int(hop * SAMPLE_RATE), int(frame * SAMPLE_RATE)
    if audio.size < frame_n:
        return np.full(max(1, audio.size // max(1, hop_n)), SILENCE_DB, dtype=np.float32)
    count = 1 + (audio.size - frame_n) // hop_n
    windows = np.lib.stride_tricks.as_strided(
        audio, shape=(count, frame_n), strides=(audio.strides[0] * hop_n, audio.strides[0]), writeable=False
    )
    rms = np.sqrt(np.mean(np.square(windows, dtype=np.float32), axis=1))
    return np.maximum(20 * np.log10(rms + 1e-9), SILENCE_DB).astype(np.float32)


def speech_mask(spans: list[Span], length: int, hop: float = HOP) -> np.ndarray:
    mask = np.zeros(length, dtype=np.float32)
    for s, e in spans:
        mask[int(s / hop): int(np.ceil(e / hop))] = 1.0
    return mask


def compute_features(audio: np.ndarray, spans: list[Span]) -> AudioFeatures:
    loud = loudness_curve(audio)
    n = len(loud)
    baseline = _moving(loud, int(BASELINE_SECONDS / HOP), np.median)
    # Silêncio puxa a linha de base para baixo; limitar evita "picos" em ruído baixo.
    baseline = np.maximum(baseline, np.percentile(loud, 25))
    excess = np.clip(loud - baseline, 0, None)
    before = _moving(loud, int(RISE_BEFORE / HOP), np.mean)
    after = _moving(loud, int(RISE_AFTER / HOP), np.mean)
    shift_b, shift_a = int(RISE_BEFORE / HOP / 2), int(RISE_AFTER / HOP / 2)
    before_past = np.concatenate([np.full(shift_b, before[0]), before[: n - shift_b]]) if n > shift_b else before
    after_future = np.concatenate([after[shift_a:], np.full(shift_a, after[-1])]) if n > shift_a else after
    rise = np.clip(after_future - before_past, 0, None)
    return AudioFeatures(HOP, loud, baseline, excess, rise, speech_mask(spans, n), spans)
