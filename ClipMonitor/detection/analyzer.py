"""Handlers das etapas de detecção (fila de processamento).

ANALYSIS (por segmento, ~5 min de áudio):
    decodifica (+45 s finais do segmento anterior como contexto, para momentos que
    cruzam a divisa) → VAD → curvas de intensidade → janelas candidatas →
    supressão local → inserção atômica sem sobreposição → enfileira transcrição.
TRANSCRIPTION (por candidato, ~45 s):
    decodifica o trecho → Whisper → pontuação por texto → bordas refinadas →
    nota final → nova checagem de sobreposição.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import replace
from pathlib import Path
from typing import Callable

import numpy as np

from config.settings import AppSettings
from database.repositories import ActivityRepository, CandidateRepository, RecordingRepository, SettingsRepository
from detection.audio import SAMPLE_RATE, decode_audio
from detection.features import compute_features
from detection.scoring import (
    audio_candidates, combine, parse_custom_keywords, refine_with_words, score_text, tail_after_peak,
)
from detection.selection import suppress
from detection.vad import VoiceActivityDetector, create_vad
from models.candidate import Candidate, CandidateStatus, TranscriptSegment, TranscriptWord
from models.job import Job, JobType
from models.recording import RecordingStatus, SegmentStatus
from transcription.whisper import Transcriber
from workers.job_worker import JobContext, JobWorker

log = logging.getLogger(__name__)

CONTEXT_SECONDS = 45.0
PREFILTER_MARGIN = 15  # a transcrição pode somar até ~15 pontos (texto + pedido de clipe)


class AnalysisError(RuntimeError):
    pass


def _shift(segments: list[TranscriptSegment], delta: float) -> list[TranscriptSegment]:
    return [
        TranscriptSegment(round(s.start + delta, 2), round(s.end + delta, 2), s.text,
                          [TranscriptWord(round(w.start + delta, 2), round(w.end + delta, 2), w.word, w.probability)
                           for w in s.words])
        for s in segments
    ]


class DetectionService:
    def __init__(
        self,
        recordings: RecordingRepository,
        candidates: CandidateRepository,
        settings_repo: SettingsRepository,
        activity: ActivityRepository,
        jobs: JobWorker,
        transcriber: Transcriber | None = None,
        vad_factory: Callable[[], VoiceActivityDetector] = create_vad,
        decoder: Callable[..., np.ndarray] = decode_audio,
        ffmpeg: Callable[[], str] = lambda: "ffmpeg",
    ):
        self.recordings = recordings
        self.candidates = candidates
        self.settings_repo = settings_repo
        self.activity = activity
        self.jobs = jobs
        self.transcriber = transcriber
        self.vad_factory = vad_factory
        self.decoder = decoder
        self.ffmpeg = ffmpeg
        self.on_scored: Callable[[Candidate], None] = lambda c: None  # ex.: renderização automática
        self._vad: VoiceActivityDetector | None = None
        self._vad_lock = threading.Lock()

    @property
    def vad(self) -> VoiceActivityDetector:
        with self._vad_lock:
            if self._vad is None:
                self._vad = self.vad_factory()
            return self._vad

    # ------------------------------------------------------------ ANALYSIS
    def handle_analysis(self, ctx: JobContext) -> str:
        settings = self.settings_repo.load()
        seg = self.recordings.get_segment(ctx.job.payload["segment_id"])
        if seg is None or seg.status is SegmentStatus.DELETED or not Path(seg.path).exists():
            return "Segmento não está mais disponível."
        rec = self.recordings.get(seg.recording_id)
        ff = self.ffmpeg()

        ctx.progress(0.05, "Decodificando áudio")
        context = np.zeros(0, dtype=np.float32)
        previous = [s for s in self.recordings.segments(seg.recording_id) if s.index == seg.index - 1]
        if previous and previous[0].status is not SegmentStatus.DELETED and Path(previous[0].path).exists():
            try:
                context = self.decoder([previous[0].path], from_end=CONTEXT_SECONDS, ffmpeg=ff)
            except Exception as exc:  # noqa: BLE001 - contexto é opcional
                log.warning("Sem contexto do segmento anterior: %s", exc)
        audio = self.decoder([seg.path], ffmpeg=ff)
        if audio.size < SAMPLE_RATE * 5:
            self.recordings.set_segment_status(seg.id, SegmentStatus.ANALYZED)
            return "Segmento sem áudio suficiente."
        ctx.raise_if_cancelled()

        full = np.concatenate([context, audio]) if context.size else audio
        context_len = context.size / SAMPLE_RATE
        origin = seg.start_offset - context_len  # tempo da gravação no início de ``full``

        ctx.progress(0.3, f"Detectando voz ({self.vad.name})")
        spans = self.vad.speech_spans(full)
        ctx.raise_if_cancelled()
        ctx.progress(0.65, "Analisando intensidade")
        feats = compute_features(full, spans)
        # Divisa entre segmentos: picos no fim deste segmento ficam para o próximo (que os vê
        # com áudio antes E depois); picos do fim do anterior são tratados aqui, no contexto.
        defer = tail_after_peak(settings.clip_duration_seconds)
        search_from = max(0.0, context_len - defer) if context.size else 0.0
        rec = self.recordings.get(seg.recording_id)  # estado atual: a gravação pode ter acabado agora
        is_last = rec.status is not RecordingStatus.RECORDING and seg.index == max(
            s.index for s in self.recordings.segments(seg.recording_id))
        search_until = None if is_last else feats.duration - defer
        windows = audio_candidates(feats, settings.clip_duration_seconds, search_from=search_from,
                                   search_until=search_until)

        threshold = settings.min_moment_score - (PREFILTER_MARGIN if settings.transcribe_moments else 0)
        local = suppress(
            [Candidate(rec.id, rec.streamer_id, origin + w.start, origin + w.end, origin + w.peak,
                       score=round(w.score, 1), audio_score=round(w.score, 1),
                       breakdown={**w.breakdown, "vad": self.vad.name},
                       status=CandidateStatus.DETECTED if settings.transcribe_moments else CandidateStatus.SCORED)
             for w in windows if w.score >= threshold],
            gap=settings.min_gap_between_moments,
        )
        ctx.progress(0.9, "Selecionando momentos")
        accepted = 0
        for cand in local:
            saved, _decision = self.candidates.insert_selected(
                cand, settings.min_gap_between_moments, settings.max_moments_per_hour)
            if saved is None:
                continue
            accepted += 1
            if settings.transcribe_moments:
                self.jobs.enqueue(Job(
                    JobType.TRANSCRIPTION, streamer_id=rec.streamer_id, priority=3,
                    dedupe_key=f"transcribe:{saved.id}", payload={"candidate_id": saved.id},
                    message="Aguardando transcrição",
                ))
            else:
                self._announce(saved)
        self.recordings.set_segment_status(seg.id, SegmentStatus.ANALYZED)
        speech_pct = int(100 * sum(e - s for s, e in spans) / max(1.0, full.size / SAMPLE_RATE))
        return f"Segmento {seg.index + 1}: {accepted} momento(s) candidato(s) · {speech_pct}% com voz"

    # ------------------------------------------------------------ TRANSCRIPTION
    def handle_transcription(self, ctx: JobContext) -> str:
        settings = self.settings_repo.load()
        cand = self.candidates.get(ctx.job.payload["candidate_id"])
        if cand is None or cand.status is not CandidateStatus.DETECTED:
            return "Momento já processado ou removido."
        segs = self.recordings.segments_covering(cand.recording_id, cand.start, cand.end)
        if not segs or not all(Path(s.path).exists() for s in segs):
            self.candidates.set_status(cand.id, CandidateStatus.DISCARDED)
            return "Arquivos da gravação não estão mais disponíveis."
        ctx.progress(0.1, "Extraindo trecho")
        audio = self.decoder([s.path for s in segs], start=cand.start - segs[0].start_offset,
                             duration=cand.duration, ffmpeg=self.ffmpeg(),
                             durations=[s.duration for s in segs])
        ctx.raise_if_cancelled()
        if self.transcriber is None:
            raise AnalysisError("Transcrição indisponível.")
        if hasattr(self.transcriber, "model_name"):
            self.transcriber.model_name = settings.whisper_model
        ctx.progress(0.3, f"Transcrevendo com Whisper '{settings.whisper_model}'")
        transcript, language = self.transcriber.transcribe(audio)
        ctx.raise_if_cancelled()

        text = score_text(transcript, cand.duration, parse_custom_keywords(settings.custom_keywords))
        start, end = refine_with_words(cand.start, cand.end, transcript, settings.clip_duration_seconds)
        transcript = _shift(transcript, cand.start - start)  # tempos relativos ao novo início
        final = combine(cand.audio_score, text)
        updated = replace(
            cand, start=start, end=end, score=final, text_score=round(text.score, 1), language=language,
            transcript=transcript,
            breakdown={**cand.breakdown, "texto": text.parts, "termos": sorted(text.hits),
                       "pedido_de_clipe": text.explicit_clip},
            status=CandidateStatus.SCORED if final >= settings.min_moment_score else CandidateStatus.DISCARDED,
        )
        decision = self.candidates.update_selected(updated, settings.min_gap_between_moments,
                                                   settings.max_moments_per_hour)
        if updated.status is CandidateStatus.DISCARDED:
            return f"Descartado: nota {final:.0f} abaixo do mínimo ({settings.min_moment_score})"
        if not decision.accept:
            return f"Descartado: {decision.reason}"
        self._announce(self.candidates.get(cand.id))
        return f"Nota final {final:.0f} · {len(text.hits)} termo(s) de destaque"

    def _announce(self, cand: Candidate | None) -> None:
        if cand is None:
            return
        self.activity.add(f"Momento detectado em {cand.streamer_name} (nota {cand.score:.0f}).",
                          "live", cand.streamer_id)
        try:
            self.on_scored(cand)
        except Exception:  # noqa: BLE001 - a detecção não pode falhar por causa do passo seguinte
            log.exception("Falha ao encaminhar momento %s", cand.id)
