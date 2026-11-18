"""Utilitários de teste: áudio sintético "de live" e contexto de tarefa falso."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np

from models.job import Job, JobType

SR = 16_000
HAS_FFMPEG = shutil.which("ffmpeg") is not None


def synth_stream_audio(duration: float = 300.0, excited: tuple[float, float] | None = (150.0, 160.0),
                       level: float = 0.03, seed: int = 0) -> np.ndarray:
    """Fala simulada (rajadas de ruído modulado em sílabas, com pausas) a ~-30 dB,
    e um trecho "empolgado" ~20 dB mais alto com gritos curtos."""
    rng = np.random.default_rng(seed)
    n = int(duration * SR)
    t = np.arange(n) / SR
    env = np.zeros(n, dtype=np.float32)
    pos = 0.0
    while pos < duration:
        talk, pause = rng.uniform(1.5, 4.0), rng.uniform(0.4, 1.2)
        a, b = int(pos * SR), int(min(duration, pos + talk) * SR)
        env[a:b] = level
        pos += talk + pause
    env *= (0.55 + 0.45 * np.sin(2 * np.pi * 4 * t)) ** 2  # ~4 sílabas/s
    if excited:
        a, b = int(excited[0] * SR), int(excited[1] * SR)
        shout = (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 0.8 * t[a:b])))  # gritos em rajadas
        env[a:b] = level * 10 * shout
    audio = rng.normal(0, 1, n).astype(np.float32) * env + rng.normal(0, 0.0005, n).astype(np.float32)
    return np.clip(audio, -1, 1)


def write_ts(audio: np.ndarray, path: Path) -> Path:
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1",
         "-i", "pipe:0", "-c:a", "aac", "-b:a", "96k", "-f", "mpegts", str(path)],
        input=pcm, check=True,
    )
    return path


class FakeCtx:
    def __init__(self, payload=None, job_type=JobType.ANALYSIS, streamer_id=None, job_id=1):
        self.job = Job(job_type, payload=payload or {}, streamer_id=streamer_id, id=job_id)
        self.messages: list[str] = []
        self.cancel = False

    @property
    def cancelled(self):
        return self.cancel

    def raise_if_cancelled(self):
        from workers.job_worker import JobCancelled

        if self.cancel:
            raise JobCancelled()

    def progress(self, fraction, message=None):
        if message:
            self.messages.append(message)
