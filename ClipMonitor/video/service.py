"""Geração de clipes: momento → MP4 vertical 1080x1920 com legendas, salvo localmente.

Arquivos (em ``<pasta de saída>``):
    pending/<canal>_<data>_<nota>_m<id>.mp4   vídeo (aguardando revisão)
    pending/<mesmo nome>.srt                   legenda em texto (se houver transcrição)
    thumbnails/<mesmo nome>.jpg                miniatura no pico do momento
A renderização acontece numa pasta temporária ``.work`` e o MP4 só é movido para
``pending`` depois de validado com ffprobe.
"""
from __future__ import annotations

import logging
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path
from typing import Callable

from database.repositories import (
    ActivityRepository, CandidateRepository, ClipRepository, RecordingRepository, SettingsRepository,
)
from models.candidate import Candidate, CandidateStatus
from models.clip import Clip, ClipStatus
from models.job import Job, JobType
from services.tools import ToolsService
from video.renderer import RenderCancelled, Renderer, RenderError, RenderRequest
from video.subtitles import build_cues, to_ass, to_srt
from workers.job_worker import JobCancelled, JobContext, JobWorker

log = logging.getLogger(__name__)

RENDERABLE = (CandidateStatus.SCORED, CandidateStatus.APPROVED, CandidateStatus.RENDERED)


class ClipError(RuntimeError):
    pass


def safe_name(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z0-9_-]+", "_", text).strip("_")[:40] or "clipe"


class ClipService:
    def __init__(
        self,
        candidates: CandidateRepository,
        recordings: RecordingRepository,
        clips: ClipRepository,
        settings_repo: SettingsRepository,
        activity: ActivityRepository,
        jobs: JobWorker,
        tools: ToolsService,
        renderer_factory: Callable[[str], Renderer] = Renderer,
    ):
        self.candidates = candidates
        self.recordings = recordings
        self.clips = clips
        self.settings_repo = settings_repo
        self.activity = activity
        self.jobs = jobs
        self.tools = tools
        self.renderer_factory = renderer_factory

    # ------------------------------------------------------------ fila
    def enqueue(self, candidate_id: int, manual: bool = True) -> Job:
        cand = self.candidates.get(candidate_id)
        if cand is None:
            raise ClipError("Momento não encontrado.")
        if cand.status not in RENDERABLE:
            raise ClipError(f"Este momento não pode virar clipe ({cand.status.label.lower()}).")
        segs = self.recordings.segments_covering(cand.recording_id, cand.start, cand.end)
        if not segs or not all(Path(s.path).exists() for s in segs):
            raise ClipError("Os arquivos da gravação deste momento já foram removidos.")
        if manual and cand.status is CandidateStatus.SCORED:
            # Protege o momento (retenção e sobreposição) enquanto o clipe é gerado.
            self.candidates.set_status(cand.id, CandidateStatus.APPROVED)
        return self.jobs.enqueue(Job(
            JobType.RENDER, streamer_id=cand.streamer_id, priority=1 if manual else 0,
            dedupe_key=f"render:{cand.id}", payload={"candidate_id": cand.id},
            message="Aguardando renderização",
        ))

    def on_scored(self, cand: Candidate) -> None:
        """Chamado pela detecção quando um momento atinge a nota mínima."""
        if not self.settings_repo.load().auto_render:
            return
        try:
            self.enqueue(cand.id, manual=False)
        except ClipError as exc:
            log.warning("Renderização automática não enfileirada: %s", exc)

    # ------------------------------------------------------------ handler
    def _ffmpeg(self) -> str:
        if self.tools.cached() is None:
            self.tools.refresh()
        info = (self.tools.cached() or {}).get("ffmpeg")
        if not info or not info.available:
            raise ClipError("FFmpeg não encontrado. Instale-o e adicione ao PATH (veja Fila e capturas).")
        return info.path or "ffmpeg"

    def handle(self, ctx: JobContext) -> str:
        settings = self.settings_repo.load()
        cand = self.candidates.get(ctx.job.payload["candidate_id"])
        if cand is None:
            return "Momento removido; nada a renderizar."
        if cand.status not in RENDERABLE:
            return f"Momento {cand.status.label.lower()}; renderização ignorada."
        segs = self.recordings.segments_covering(cand.recording_id, cand.start, cand.end)
        if not segs or not all(Path(s.path).exists() for s in segs):
            raise ClipError("Os arquivos da gravação deste momento já foram removidos.")
        rec = self.recordings.get(cand.recording_id)
        renderer = self.renderer_factory(self._ffmpeg())

        when = rec.wallclock(cand.start) if rec else None
        stem = (f"{safe_name(cand.streamer_name or 'canal')}_{when.astimezone():%Y%m%d-%H%M}_"
                f"n{cand.score:.0f}_m{cand.id}") if when else f"clipe_m{cand.id}"
        out_root = Path(settings.output_dir)
        output = out_root / ClipStatus.PENDING.folder / f"{stem}.mp4"

        cues = build_cues(cand.transcript, cand.duration) if settings.burn_subtitles else []
        ass = to_ass(cues, uppercase=settings.subtitle_uppercase) if cues else None
        ctx.progress(0.01, "Renderizando 1080x1920" + (" com legendas" if ass else " (sem legendas)"))

        work_root = out_root / ".work"
        work_root.mkdir(parents=True, exist_ok=True)
        workdir = Path(tempfile.mkdtemp(prefix=f"m{cand.id}_", dir=work_root))
        try:
            info = renderer.render(
                RenderRequest(
                    paths=[s.path for s in segs], durations=[s.duration for s in segs],
                    start=cand.start - segs[0].start_offset, duration=cand.duration, output=output,
                    layout=settings.clip_layout, fps=settings.clip_fps, preset=settings.video_quality,
                    subtitles_ass=ass,
                ),
                workdir,
                progress=lambda f: ctx.progress(0.02 + 0.93 * f, None),
                cancelled=lambda: ctx.cancelled,
            )
        except RenderCancelled:
            raise JobCancelled() from None
        except RenderError as exc:
            self.activity.add(f"Falha ao gerar clipe de {cand.streamer_name}: {exc}", "error", cand.streamer_id)
            raise
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

        srt_path = None
        all_cues = cues or build_cues(cand.transcript, cand.duration)
        if all_cues:
            srt_path = output.with_suffix(".srt")
            srt_path.write_text(to_srt(all_cues), encoding="utf-8")
        ctx.progress(0.97, "Gerando miniatura")
        thumb = None
        try:
            thumb = renderer.thumbnail(output, cand.peak - cand.start,
                                       out_root / "thumbnails" / f"{stem}.jpg")
        except RenderError as exc:
            log.warning("Miniatura não gerada: %s", exc)  # não impede o clipe

        old = self.clips.get_by_candidate(cand.id)
        clip = self.clips.upsert(Clip(
            candidate_id=cand.id, streamer_id=cand.streamer_id, path=str(output),
            srt_path=str(srt_path) if srt_path else None, thumbnail_path=str(thumb) if thumb else None,
            duration=round(info.duration, 2), width=info.width, height=info.height,
            size_bytes=output.stat().st_size, score=cand.score, layout=settings.clip_layout,
            has_subtitles=bool(ass), transcript_text=cand.text,
        ))
        if old and old.path != clip.path:
            for stale in (old.path, old.srt_path):
                if stale and Path(stale).exists():
                    Path(stale).unlink()
        self.candidates.set_status(cand.id, CandidateStatus.RENDERED)
        self.activity.add(f"Clipe de {cand.streamer_name} pronto para revisão (nota {cand.score:.0f}).",
                          "live", cand.streamer_id)
        mb = clip.size_bytes / 1024 ** 2
        return f"Clipe salvo: {output.name} · {info.duration:.0f} s · {mb:.1f} MB" + (
            "" if ass else " · sem legendas")
