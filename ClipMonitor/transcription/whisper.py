"""Transcrição local com faster-whisper (CPU, int8).

Otimizado para o i3-10100F (4 núcleos/8 threads) com 16 GB:
- ``compute_type="int8"``: ~4x menos RAM e bem mais rápido que float32 na CPU;
- ``cpu_threads=4``: um por núcleo físico, deixando folga para captura/UI;
- modelo carregado sob demanda e descarregado após ociosidade (libera ~0,5–1,5 GB);
- só os trechos candidatos são transcritos, nunca a live inteira.
Na primeira utilização o modelo é baixado do Hugging Face (~250 MB para o "small").
"""
from __future__ import annotations

import gc
import logging
import threading
import time
from typing import Protocol

import numpy as np

from models.candidate import TranscriptSegment, TranscriptWord

log = logging.getLogger(__name__)


class TranscriptionError(RuntimeError):
    pass


class Transcriber(Protocol):
    def transcribe(self, audio: np.ndarray) -> tuple[list[TranscriptSegment], str]: ...


class WhisperTranscriber:
    def __init__(self, model_name: str = "small", cpu_threads: int = 4, idle_unload_seconds: int = 600,
                 download_root: str | None = None):
        self.model_name = model_name
        self.cpu_threads = cpu_threads
        self.idle_unload_seconds = idle_unload_seconds
        self.download_root = download_root
        self._model = None
        self._loaded_name: str | None = None
        self._lock = threading.Lock()
        self._last_used = 0.0
        self._timer: threading.Timer | None = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def _ensure_model(self):
        if self._model is not None and self._loaded_name == self.model_name:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise TranscriptionError("faster-whisper não está instalado (pip install faster-whisper).") from exc
        log.info("Carregando modelo Whisper '%s' (int8, CPU)", self.model_name)
        try:
            self._model = WhisperModel(self.model_name, device="cpu", compute_type="int8",
                                       cpu_threads=self.cpu_threads, download_root=self.download_root)
        except Exception as exc:  # noqa: BLE001 - rede, disco, modelo corrompido
            raise TranscriptionError(f"Não foi possível carregar o modelo Whisper '{self.model_name}': {exc}") from exc
        self._loaded_name = self.model_name
        return self._model

    def transcribe(self, audio: np.ndarray) -> tuple[list[TranscriptSegment], str]:
        with self._lock:
            model = self._ensure_model()
            segments_iter, info = model.transcribe(
                audio, language="pt", beam_size=1, best_of=1, temperature=0.0,
                vad_filter=True, word_timestamps=True, condition_on_previous_text=False,
            )
            out = []
            for s in segments_iter:
                words = [TranscriptWord(round(w.start, 2), round(w.end, 2), w.word.strip(), round(w.probability, 3))
                         for w in (s.words or [])]
                out.append(TranscriptSegment(round(s.start, 2), round(s.end, 2), s.text.strip(), words))
            self._last_used = time.monotonic()
            self._schedule_unload()
            return out, info.language

    def _schedule_unload(self) -> None:
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(self.idle_unload_seconds, self.unload_if_idle)
        self._timer.daemon = True
        self._timer.start()

    def unload_if_idle(self) -> None:
        with self._lock:
            if self._model is not None and time.monotonic() - self._last_used >= self.idle_unload_seconds - 1:
                log.info("Descarregando modelo Whisper por ociosidade")
                self._model = None
                self._loaded_name = None
                gc.collect()

    def close(self) -> None:
        if self._timer:
            self._timer.cancel()
        with self._lock:
            self._model = None
