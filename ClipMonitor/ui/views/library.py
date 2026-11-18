"""Biblioteca: revisão dos clipes gerados (aprovar, rejeitar, assistir, excluir)."""
from __future__ import annotations

import logging
from pathlib import Path

import customtkinter as ctk

from config import theme as t
from models.clip import Clip, ClipStatus
from services import playback
from services.review_service import ReviewError
from ui.components.widgets import Badge, Card, EmptyState, GhostButton, PageHeader, PrimaryButton, StatCard, confirm, label, muted
from ui.views.base import BaseView
from utils.timeutils import format_relative

log = logging.getLogger(__name__)

FILTERS = {
    "Para revisar": (ClipStatus.PENDING,),
    "Aprovados": (ClipStatus.APPROVED,),
    "Rejeitados": (ClipStatus.REJECTED,),
    "Todos": None,
}
STATUS_STYLE = {ClipStatus.PENDING: "warn", ClipStatus.APPROVED: "on", ClipStatus.REJECTED: "off"}
CARD_WIDTH = 270
THUMB = (150, 266)


class LibraryView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)
        self._thumbs: dict[tuple[str, float], ctk.CTkImage] = {}
        self._cols = 0
        self._signature: tuple = ()

        header = PageHeader(self, "Biblioteca", "Clipes verticais 1080x1920 prontos. Aprove os que serão publicados.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        GhostButton(header.actions, "Abrir pasta de saída",
                    lambda: self._open(self.ctx.settings_repo.load().output_dir), width=170).pack(side="right")

        stats = ctk.CTkFrame(self, fg_color="transparent")
        stats.grid(row=1, column=0, sticky="ew")
        for i in range(4):
            stats.grid_columnconfigure(i, weight=1, uniform="lib")
        self.s_pending = StatCard(stats, "Para revisar", hint="em output/pending", accent=True)
        self.s_approved = StatCard(stats, "Aprovados", hint="em output/approved")
        self.s_rejected = StatCard(stats, "Rejeitados", hint="em output/rejected")
        self.s_size = StatCard(stats, "Espaço usado", hint="vídeos na biblioteca")
        for i, c in enumerate([self.s_pending, self.s_approved, self.s_rejected, self.s_size]):
            c.grid(row=0, column=i, sticky="ew", padx=(0 if i == 0 else 6, 0 if i == 3 else 6))

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=2, column=0, sticky="ew", pady=(16, 10))
        label(bar, "Clipes", font=t.FONT_SUBTITLE).pack(side="left")
        self.filter = ctk.CTkSegmentedButton(
            bar, values=list(FILTERS), command=lambda _v: self.refresh(force=True),
            selected_color=t.ACCENT_DIM, selected_hover_color=t.ACCENT_DIM, unselected_color=t.SECONDARY,
            unselected_hover_color=t.CARD_HOVER, fg_color=t.SECONDARY, text_color=t.TEXT, height=34,
            font=(t.FONT_FAMILY, 12))
        self.filter.set("Para revisar")
        self.filter.pack(side="right")

        self.grid_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.grid_frame.grid(row=3, column=0, sticky="nsew")
        # Largura medida na própria tela (não no conteúdo rolável, que muda a cada card criado —
        # isso realimentaria o redesenho em loop).
        self._resize_pending = False
        self.bind("<Configure>", self._on_resize)

    # ------------------------------------------------------------ dados
    def _on_resize(self, event) -> None:
        if event.widget is not self or self._resize_pending:
            return
        self._resize_pending = True
        self.after(150, self._apply_resize)  # agrupa a rajada de eventos ao arrastar a janela

    def _apply_resize(self) -> None:
        self._resize_pending = False
        usable = self.winfo_width() - 24  # barra de rolagem
        cols = max(1, (usable + 12) // (CARD_WIDTH + 12))
        if cols != self._cols:
            self._cols = cols
            self.refresh(force=True)

    def refresh(self, force: bool = False) -> None:
        counts = self.ctx.clip_repo.counts()
        self.s_pending.set(str(counts.get(ClipStatus.PENDING, 0)))
        self.s_approved.set(str(counts.get(ClipStatus.APPROVED, 0)))
        self.s_rejected.set(str(counts.get(ClipStatus.REJECTED, 0)))
        clips = self.ctx.clip_repo.list(FILTERS[self.filter.get()])
        total = sum(c.size_bytes for c in self.ctx.clip_repo.list())
        self.s_size.set(f"{total / 1024 ** 2:.0f} MB" if total < 1024 ** 3 else f"{total / 1024 ** 3:.1f} GB")

        signature = tuple((c.id, c.status, c.path) for c in clips) + (self.filter.get(), self._cols)
        if signature == self._signature and not force:
            return
        self._signature = signature
        for w in self.grid_frame.winfo_children():
            w.destroy()
        cols = max(1, self._cols or 3)
        for i in range(cols):
            self.grid_frame.grid_columnconfigure(i, weight=1, uniform="clip")
        if not clips:
            EmptyState(self.grid_frame, "Nenhum clipe aqui",
                       "Os momentos com nota acima do mínimo viram vídeos automaticamente (ou use "
                       "'Gerar clipe' em Momentos). Eles aparecem aqui para você revisar.").grid(
                row=0, column=0, columnspan=cols, sticky="ew")
            return
        for i, clip in enumerate(clips):
            r, c = divmod(i, cols)
            self._card(clip).grid(row=r, column=c, sticky="new", padx=6, pady=6)

    def _thumbnail(self, clip: Clip):
        path = clip.thumbnail_path
        if not path or not Path(path).exists():
            return None
        key = (path, Path(path).stat().st_mtime)
        if key not in self._thumbs:
            try:
                from PIL import Image

                with Image.open(path) as img:
                    self._thumbs[key] = ctk.CTkImage(img.convert("RGB").copy(), size=THUMB)
            except Exception as exc:  # noqa: BLE001 - miniatura é opcional
                log.warning("Miniatura ilegível %s: %s", path, exc)
                return None
        return self._thumbs[key]

    def _card(self, clip: Clip) -> Card:
        card = Card(self.grid_frame, width=CARD_WIDTH)
        exists = Path(clip.path).exists()
        image = self._thumbnail(clip)
        thumb = ctk.CTkLabel(card, text="" if image else "sem miniatura", image=image, width=THUMB[0],
                             height=THUMB[1], fg_color=t.SECONDARY, corner_radius=8, text_color=t.TEXT_DIM,
                             cursor="hand2" if exists else "")
        thumb.pack(padx=14, pady=(14, 8))
        if exists:
            thumb.bind("<Button-1>", lambda _e: self._play(clip))

        top = ctk.CTkFrame(card, fg_color="transparent")
        top.pack(fill="x", padx=14)
        label(top, clip.streamer_name or "—", font=(t.FONT_FAMILY, 13, "bold")).pack(side="left")
        ctk.CTkLabel(top, text=f"{clip.score:.0f}", font=(t.FONT_FAMILY, 13, "bold"),
                     text_color=t.ACCENT if clip.score >= 75 else t.WARNING).pack(side="right")
        subs = "legendado" if clip.has_subtitles else "sem legenda"
        muted(card, f"{clip.duration:.0f} s · {subs} · {format_relative(clip.created_at)}").pack(anchor="w", padx=14)
        badges = ctk.CTkFrame(card, fg_color="transparent")
        badges.pack(fill="x", padx=14, pady=(6, 0))
        Badge(badges, clip.status.label.upper(), STATUS_STYLE[clip.status]).pack(side="left")
        if not exists:
            Badge(badges, "ARQUIVO AUSENTE", "live").pack(side="left", padx=(6, 0))

        row1 = ctk.CTkFrame(card, fg_color="transparent")
        row1.pack(fill="x", padx=14, pady=(10, 4))
        row1.grid_columnconfigure((0, 1), weight=1)
        if clip.status is ClipStatus.PENDING:
            PrimaryButton(row1, "✓ Aprovar", lambda: self._review(clip, ClipStatus.APPROVED), height=34).grid(
                row=0, column=0, sticky="ew", padx=(0, 3))
            GhostButton(row1, "✕ Rejeitar", lambda: self._review(clip, ClipStatus.REJECTED), danger=True,
                        height=34).grid(row=0, column=1, sticky="ew", padx=(3, 0))
        else:
            GhostButton(row1, "↺ Revisar de novo", lambda: self._review(clip, ClipStatus.PENDING), height=34).grid(
                row=0, column=0, columnspan=2, sticky="ew")
        row2 = ctk.CTkFrame(card, fg_color="transparent")
        row2.pack(fill="x", padx=14, pady=(0, 14))
        row2.grid_columnconfigure((0, 1, 2), weight=1)
        GhostButton(row2, "▶", lambda: self._play(clip), height=30, width=10,
                    state="normal" if exists else "disabled").grid(row=0, column=0, sticky="ew", padx=(0, 3))
        GhostButton(row2, "Texto", lambda: self._copy(clip), height=30, width=10).grid(row=0, column=1, sticky="ew", padx=3)
        GhostButton(row2, "Excluir", lambda: self._delete(clip), danger=True, height=30, width=10).grid(
            row=0, column=2, sticky="ew", padx=(3, 0))
        return card

    # ------------------------------------------------------------ ações
    def _review(self, clip: Clip, status: ClipStatus) -> None:
        try:
            self.ctx.review.set_status(clip.id, status)
        except ReviewError as exc:
            self.app.toast(str(exc), "error")
            return
        msg = {ClipStatus.APPROVED: "Clipe aprovado e movido para approved.",
               ClipStatus.REJECTED: "Clipe movido para rejected.",
               ClipStatus.PENDING: "Clipe voltou para revisão."}[status]
        self.app.toast(msg, "success" if status is ClipStatus.APPROVED else "info")
        self.app.refresh_current()

    def _play(self, clip: Clip) -> None:
        if not Path(clip.path).exists():
            self.app.toast("O arquivo deste clipe não existe mais.", "error")
            return
        try:
            playback.open_path(clip.path)
        except OSError as exc:
            self.app.toast(f"Não foi possível abrir o vídeo: {exc}", "error")

    def _copy(self, clip: Clip) -> None:
        text = clip.transcript_text.strip()
        if not text:
            self.app.toast("Este clipe não tem transcrição.", "warn")
            return
        self.app.clipboard_clear()
        self.app.clipboard_append(text)
        self.app.toast("Texto do clipe copiado.", "success")

    def _delete(self, clip: Clip) -> None:
        if not confirm(self.app, "Excluir clipe", "Apagar o vídeo, a legenda e a miniatura deste clipe? "
                                                  "Isso não pode ser desfeito.", "Excluir", danger=True):
            return
        try:
            self.ctx.review.delete(clip.id)
        except ReviewError as exc:
            self.app.toast(str(exc), "error")
            return
        self.app.toast("Clipe excluído.", "info")
        self.app.refresh_current()

    def _open(self, path: str) -> None:
        try:
            playback.open_folder(path)
        except OSError as exc:
            self.app.toast(f"Não foi possível abrir a pasta: {exc}", "error")
