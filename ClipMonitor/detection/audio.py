"""Decodificação de áudio via FFmpeg (16 kHz mono float32, direto na memória).

16 kHz mono é o formato que o Silero VAD e o Whisper esperam; 5 min de áudio
ocupam ~19 MB em float32 — leve para 16 GB de RAM.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Sequence

import numpy as np

from utils.ffmpeg_input import ffmpeg_input

SAMPLE_RATE = 16_000
_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


class AudioDecodeError(RuntimeError):
    pass


def decode_audio(
    paths: Sequence[str | Path],
    start: float = 0.0,
    duration: float | None = None,
    ffmpeg: str = "ffmpeg",
    from_end: float | None = None,
    durations: Sequence[float | None] | None = None,
) -> np.ndarray:
    """Decodifica um ou mais arquivos MPEG-TS consecutivos como um só fluxo.

    ``start``/``duration`` são relativos ao início do primeiro arquivo.
    ``from_end`` lê apenas os últimos N segundos (contexto do segmento anterior).
    ``durations`` (do ``segments.csv``) tornam a junção de vários arquivos exata.
    """
    if not paths:
        return np.zeros(0, dtype=np.float32)
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin"]
    if from_end is not None:
        cmd += ["-sseof", f"-{from_end:.3f}"]
    elif start > 0:
        cmd += ["-ss", f"{start:.3f}"]
    try:
        with ffmpeg_input(paths, durations) as input_args:
            cmd += input_args
            if duration is not None:
                cmd += ["-t", f"{duration:.3f}"]
            cmd += ["-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"]
            proc = subprocess.run(cmd, capture_output=True, timeout=600, creationflags=_CREATE_NO_WINDOW)
    except FileNotFoundError as exc:
        raise AudioDecodeError("FFmpeg não encontrado. Instale-o e adicione ao PATH.") from exc
    except subprocess.TimeoutExpired as exc:
        raise AudioDecodeError("FFmpeg demorou demais para decodificar o áudio.") from exc
    if proc.returncode != 0:
        msg = proc.stderr.decode("utf-8", "replace").strip().splitlines()
        raise AudioDecodeError(f"FFmpeg falhou ao ler o áudio: {msg[-1] if msg else proc.returncode}")
    data = np.frombuffer(proc.stdout, dtype=np.int16)
    return (data.astype(np.float32) / 32768.0)
