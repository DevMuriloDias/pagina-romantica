"""Revisão de clipes: aprovar, rejeitar, voltar para revisão e excluir.

A pasta reflete o estado: ``pending/``, ``approved/`` e ``rejected/``. Os
arquivos (.mp4 e .srt) são movidos ANTES de atualizar o banco; se qualquer
passo falhar, o que já foi movido volta ao lugar — banco e disco nunca ficam
divergentes. No Windows, um vídeo aberto no player não pode ser movido: o
erro é explicado ao usuário em vez de deixar um estado parcial.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from database.repositories import ActivityRepository, CandidateRepository, ClipRepository, SettingsRepository
from models.candidate import CandidateStatus
from models.clip import Clip, ClipStatus

log = logging.getLogger(__name__)


class ReviewError(RuntimeError):
    pass


def _free_target(folder: Path, name: str) -> Path:
    target = folder / name
    stem, suffix, n = target.stem, target.suffix, 2
    while target.exists():
        target = folder / f"{stem}_{n}{suffix}"
        n += 1
    return target


def _explain(exc: OSError, path: Path) -> ReviewError:
    if isinstance(exc, PermissionError):
        return ReviewError(f"O arquivo {path.name} está em uso (aberto em algum player?). Feche-o e tente de novo.")
    return ReviewError(f"Não foi possível mover {path.name}: {exc.strerror or exc}")


class ReviewService:
    def __init__(self, clips: ClipRepository, candidates: CandidateRepository, settings_repo: SettingsRepository,
                 activity: ActivityRepository):
        self.clips = clips
        self.candidates = candidates
        self.settings_repo = settings_repo
        self.activity = activity

    def _get(self, clip_id: int) -> Clip:
        clip = self.clips.get(clip_id)
        if clip is None:
            raise ReviewError("Clipe não encontrado.")
        return clip

    def set_status(self, clip_id: int, status: ClipStatus) -> Clip:
        clip = self._get(clip_id)
        if clip.status is status:
            return clip
        video = Path(clip.path)
        if not video.exists():
            raise ReviewError(f"O arquivo {video.name} não existe mais. Você pode removê-lo da biblioteca.")
        folder = Path(self.settings_repo.load().output_dir) / status.folder
        folder.mkdir(parents=True, exist_ok=True)

        moved: list[tuple[Path, Path]] = []
        try:
            for source in [video] + ([Path(clip.srt_path)] if clip.srt_path and Path(clip.srt_path).exists() else []):
                # O .srt acompanha o nome final do vídeo (inclusive o sufixo _2 em caso de conflito).
                name = source.name if source == video else moved[0][1].with_suffix(".srt").name
                target = _free_target(folder, name)
                try:
                    os.replace(source, target)
                except OSError as exc:
                    raise _explain(exc, source) from exc
                moved.append((source, target))
        except ReviewError:
            for source, target in reversed(moved):  # desfaz o que já foi movido
                try:
                    os.replace(target, source)
                except OSError:
                    log.exception("Falha ao desfazer movimentação de %s", target)
            raise

        new_video = moved[0][1]
        new_srt = moved[1][1] if len(moved) > 1 else None
        self.clips.move(clip.id, status, str(new_video), str(new_srt) if new_srt else None)
        verb = {ClipStatus.APPROVED: "aprovado", ClipStatus.REJECTED: "rejeitado", ClipStatus.PENDING: "devolvido à revisão"}
        self.activity.add(f"Clipe de {clip.streamer_name} {verb[status]}.", "info", clip.streamer_id)
        return self._get(clip.id)

    def approve(self, clip_id: int) -> Clip:
        return self.set_status(clip_id, ClipStatus.APPROVED)

    def reject(self, clip_id: int) -> Clip:
        return self.set_status(clip_id, ClipStatus.REJECTED)

    def restore(self, clip_id: int) -> Clip:
        return self.set_status(clip_id, ClipStatus.PENDING)

    def delete(self, clip_id: int, delete_files: bool = True) -> None:
        clip = self._get(clip_id)
        if delete_files:
            for p in (clip.path, clip.srt_path, clip.thumbnail_path):
                if p and Path(p).exists():
                    try:
                        Path(p).unlink()
                    except OSError as exc:
                        raise _explain(exc, Path(p)) from exc
        self.clips.delete(clip.id)
        # O momento volta a ser "pronto": pode virar clipe de novo enquanto houver gravação.
        if self.candidates.get(clip.candidate_id):
            self.candidates.set_status(clip.candidate_id, CandidateStatus.SCORED)
        self.activity.add(f"Clipe de {clip.streamer_name} excluído.", "info", clip.streamer_id)

    def missing_files(self) -> list[Clip]:
        return [c for c in self.clips.list() if not Path(c.path).exists()]
