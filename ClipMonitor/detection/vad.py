"""Detecção de voz (VAD).

``SileroVAD`` usa o modelo Silero em ONNX que já acompanha o faster-whisper
(onnxruntime, CPU) — sem PyTorch, que custaria ~1 GB de disco/RAM.
``EnergyVAD`` é um substituto simples por energia, usado se o Silero não
estiver disponível (e nos testes).
"""
from __future__ import annotations

import logging
from typing import Protocol

import numpy as np

from detection.audio import SAMPLE_RATE

log = logging.getLogger(__name__)

Span = tuple[float, float]  # (início, fim) em segundos


class VoiceActivityDetector(Protocol):
    name: str

    def speech_spans(self, audio: np.ndarray) -> list[Span]: ...


class SileroVAD:
    name = "Silero VAD"

    def __init__(self, threshold: float = 0.5, min_silence_ms: int = 500, speech_pad_ms: int = 200):
        from faster_whisper.vad import VadOptions, get_speech_timestamps  # import tardio: pesado

        self._get = get_speech_timestamps
        self._opts = VadOptions(threshold=threshold, min_silence_duration_ms=min_silence_ms,
                                speech_pad_ms=speech_pad_ms, min_speech_duration_ms=250)

    def speech_spans(self, audio: np.ndarray) -> list[Span]:
        if audio.size == 0:
            return []
        stamps = self._get(audio, self._opts, sampling_rate=SAMPLE_RATE)
        return [(s["start"] / SAMPLE_RATE, s["end"] / SAMPLE_RATE) for s in stamps]


class EnergyVAD:
    name = "VAD por energia"

    def __init__(self, frame: float = 0.03, margin_db: float = 12.0, min_silence: float = 0.5,
                 min_speech: float = 0.25):
        self.frame = frame
        self.margin_db = margin_db
        self.min_silence = min_silence
        self.min_speech = min_speech

    def speech_spans(self, audio: np.ndarray) -> list[Span]:
        n = int(self.frame * SAMPLE_RATE)
        if audio.size < n:
            return []
        frames = audio[: audio.size // n * n].reshape(-1, n)
        db = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)
        noise_floor = np.percentile(db, 10)
        active = db > max(noise_floor + self.margin_db, -55)
        spans: list[Span] = []
        start = None
        for i, a in enumerate(active):
            t = i * self.frame
            if a and start is None:
                start = t
            elif not a and start is not None:
                spans.append((start, t))
                start = None
        if start is not None:
            spans.append((start, len(active) * self.frame))
        merged: list[Span] = []
        for s, e in spans:
            if merged and s - merged[-1][1] < self.min_silence:
                merged[-1] = (merged[-1][0], e)
            else:
                merged.append((s, e))
        return [(s, e) for s, e in merged if e - s >= self.min_speech]


def create_vad() -> VoiceActivityDetector:
    try:
        return SileroVAD()
    except Exception as exc:  # noqa: BLE001
        log.warning("Silero VAD indisponível (%s); usando VAD por energia", exc)
        return EnergyVAD()
