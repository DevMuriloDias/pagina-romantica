"""Momentos detectados: nota, motivos, transcrição e ações."""
from __future__ import annotations

import customtkinter as ctk

from config import theme as t
from models.candidate import Candidate, CandidateStatus
from services import playback
from ui.components.widgets import Badge, Card, EmptyState, GhostButton, PageHeader, PrimaryButton, StatCard, label, muted
from ui.views.base import BaseView
from utils.timeutils import format_relative

FILTERS = {
    "Prontos": (CandidateStatus.SCORED,),
    "Em análise": (CandidateStatus.DETECTED,),
    "Com clipe": (CandidateStatus.APPROVED, CandidateStatus.RENDERED),
    "Descartados": (CandidateStatus.DISCARDED, CandidateStatus.REJECTED),
    "Todos": None,
}
AUDIO_LABELS = {"pico": "Volume", "subida": "Explosão", "intensidade": "Energia", "rajadas": "Gritos", "fala": "Fala"}
TEXT_LABELS = {"palavras": "Palavras", "ritmo": "Ritmo", "risadas": "Risadas"}
STATUS_STYLE = {
    CandidateStatus.DETECTED: "off", CandidateStatus.SCORED: "on", CandidateStatus.APPROVED: "on",
    CandidateStatus.DISCARDED: "off", CandidateStatus.REJECTED: "warn", CandidateStatus.RENDERED: "on",
}


def timecode(seconds: float) -> str:
    seconds = int(max(0, seconds))
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def score_color(score: float) -> str:
    return t.ACCENT if score >= 75 else (t.WARNING if score >= 55 else t.TEXT_MUTED)


class MomentsView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        PageHeader(self, "Momentos", "Trechos com maior potencial de clipe, detectados nas gravações.").grid(
            row=0, column=0, sticky="ew", pady=(0, t.PAD))

        stats = ctk.CTkFrame(self, fg_color="transparent")
        stats.grid(row=1, column=0, sticky="ew")
        for i in range(4):
            stats.grid_columnconfigure(i, weight=1, uniform="m")
        self.s_ready = StatCard(stats, "Prontos", hint="aguardando sua revisão", accent=True)
        self.s_pending = StatCard(stats, "Em análise", hint="na fila de transcrição")
        self.s_approved = StatCard(stats, "Com clipe", hint="gerados ou na fila de vídeo")
        self.s_discarded = StatCard(stats, "Descartados", hint="nota baixa ou sobreposição")
        for i, c in enumerate([self.s_ready, self.s_pending, self.s_approved, self.s_discarded]):
            c.grid(row=0, column=i, sticky="ew", padx=(0 if i == 0 else 6, 0 if i == 3 else 6))

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=2, column=0, sticky="ew", pady=(16, 10))
        self.sort = ctk.CTkSegmentedButton(
            bar, values=["Maior nota", "Mais recentes"], command=lambda _v: self.refresh(),
            selected_color=t.ACCENT_DIM, selected_hover_color=t.ACCENT_DIM, unselected_color=t.SECONDARY,
            unselected_hover_color=t.CARD_HOVER, fg_color=t.SECONDARY, text_color=t.TEXT, height=34,
            font=(t.FONT_FAMILY, 12))
        self.sort.set("Maior nota")
        self.sort.pack(side="left")
        self.filter = ctk.CTkSegmentedButton(
            bar, values=list(FILTERS), command=lambda _v: self.refresh(),
            selected_color=t.ACCENT_DIM, selected_hover_color=t.ACCENT_DIM, unselected_color=t.SECONDARY,
            unselected_hover_color=t.CARD_HOVER, fg_color=t.SECONDARY, text_color=t.TEXT, height=34,
            font=(t.FONT_FAMILY, 12))
        self.filter.set("Prontos")
        self.filter.pack(side="right")

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=3, column=0, sticky="nsew")
        self.list.grid_columnconfigure(0, weight=1)
        self._signature: tuple = ()

    def refresh(self) -> None:
        counts = self.ctx.candidate_repo.counts()
        self.s_ready.set(str(counts.get(CandidateStatus.SCORED, 0)))
        self.s_pending.set(str(counts.get(CandidateStatus.DETECTED, 0)))
        self.s_approved.set(str(counts.get(CandidateStatus.APPROVED, 0) + counts.get(CandidateStatus.RENDERED, 0)))
        self.s_discarded.set(str(counts.get(CandidateStatus.DISCARDED, 0) + counts.get(CandidateStatus.REJECTED, 0)))

        items = self.ctx.candidate_repo.list(FILTERS[self.filter.get()], limit=150)
        if self.sort.get() == "Maior nota":
            items.sort(key=lambda c: c.score, reverse=True)
        signature = tuple((c.id, c.status, c.score) for c in items) + (self.filter.get(), self.sort.get())
        if signature == self._signature:
            return
        self._signature = signature
        for w in self.list.winfo_children():
            w.destroy()
        if not items:
            EmptyState(self.list, "Nenhum momento aqui",
                       "Quando uma live autorizada for gravada, cada segmento é analisado (voz, volume e "
                       "mudanças de intensidade) e os melhores trechos aparecem nesta lista.").grid(
                row=0, column=0, sticky="ew")
            return
        recordings = {}
        for i, c in enumerate(items):
            if c.recording_id not in recordings:
                recordings[c.recording_id] = self.ctx.recording_repo.get(c.recording_id)
            self._row(c, recordings[c.recording_id]).grid(row=i, column=0, sticky="ew", pady=5, padx=2)

    def _row(self, c: Candidate, rec) -> Card:
        card = Card(self.list)
        card.grid_columnconfigure(1, weight=1)

        score_box = ctk.CTkFrame(card, width=74, height=74, corner_radius=37, fg_color=t.SECONDARY,
                                 border_width=2, border_color=score_color(c.score))
        score_box.grid(row=0, column=0, rowspan=4, padx=18, pady=16, sticky="n")
        score_box.grid_propagate(False)
        ctk.CTkLabel(score_box, text=f"{c.score:.0f}", font=(t.FONT_FAMILY, 24, "bold"),
                     text_color=score_color(c.score)).place(relx=0.5, rely=0.44, anchor="center")
        ctk.CTkLabel(score_box, text="nota", font=(t.FONT_FAMILY, 9), text_color=t.TEXT_MUTED).place(
            relx=0.5, rely=0.76, anchor="center")

        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=0, column=1, sticky="w", pady=(14, 0))
        label(top, c.streamer_name or "—", font=(t.FONT_FAMILY, 14, "bold")).pack(side="left")
        muted(top, f"   {timecode(c.start)} → {timecode(c.end)}  ({c.duration:.0f} s)").pack(side="left")
        Badge(top, c.status.label.upper(), STATUS_STYLE[c.status]).pack(side="left", padx=(10, 0))
        if c.breakdown.get("pedido_de_clipe"):
            Badge(top, "PEDIRAM CLIPE", "live").pack(side="left", padx=(6, 0))

        when = rec.wallclock(c.start) if rec else None
        subtitle = f"Ao vivo em {when.astimezone():%d/%m %H:%M}" if when else ""
        subtitle += f"  ·  detectado {format_relative(c.created_at)}" if c.created_at else ""
        muted(card, subtitle).grid(row=1, column=1, sticky="w")

        chips = ctk.CTkFrame(card, fg_color="transparent")
        chips.grid(row=2, column=1, sticky="w", pady=(8, 0))
        audio = c.breakdown.get("audio", {})
        for key, name in AUDIO_LABELS.items():
            if key in audio:
                self._chip(chips, name, audio[key])
        for key, name in TEXT_LABELS.items():
            if key in c.breakdown.get("texto", {}):
                self._chip(chips, name, c.breakdown["texto"][key])

        text = c.text
        terms = c.breakdown.get("termos") or []
        if text or terms:
            excerpt = (text[:220] + "…") if len(text) > 220 else text
            line = f"“{excerpt}”" if excerpt else ""
            if terms:
                line += ("\n" if line else "") + "Destaques: " + ", ".join(terms[:6])
            label(card, line, font=t.FONT_SMALL, color=t.TEXT_MUTED, wraplength=640).grid(
                row=3, column=1, sticky="w", pady=(8, 14))
        elif c.status is CandidateStatus.DETECTED:
            muted(card, "Transcrição na fila…").grid(row=3, column=1, sticky="w", pady=(8, 14))

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=0, column=2, rowspan=4, padx=14, sticky="e")
        GhostButton(actions, "▶  Ouvir", lambda: self._preview(c, rec), width=96).pack(pady=2, fill="x")
        if c.status in (CandidateStatus.SCORED, CandidateStatus.REJECTED, CandidateStatus.DISCARDED):
            PrimaryButton(actions, "Gerar clipe", lambda: self._render(c), width=96).pack(pady=2, fill="x")
        elif c.status is CandidateStatus.RENDERED:
            GhostButton(actions, "Gerar de novo", lambda: self._render(c), width=96).pack(pady=2, fill="x")
        if c.status not in (CandidateStatus.REJECTED, CandidateStatus.RENDERED, CandidateStatus.APPROVED):
            GhostButton(actions, "Rejeitar", lambda: self._set(c, CandidateStatus.REJECTED), danger=True,
                        width=96).pack(pady=2, fill="x")
        if rec:
            GhostButton(actions, "Pasta", lambda: self._open(rec), width=96).pack(pady=2, fill="x")
        return card

    @staticmethod
    def _chip(parent, name: str, value: int) -> None:
        color = t.ACCENT if value >= 70 else (t.TEXT if value >= 35 else t.TEXT_DIM)
        chip = ctk.CTkFrame(parent, fg_color=t.SECONDARY, corner_radius=8)
        chip.pack(side="left", padx=(0, 6))
        ctk.CTkLabel(chip, text=f"{name} ", font=(t.FONT_FAMILY, 10), text_color=t.TEXT_MUTED).pack(
            side="left", padx=(8, 0), pady=3)
        ctk.CTkLabel(chip, text=str(value), font=(t.FONT_FAMILY, 10, "bold"), text_color=color).pack(
            side="left", padx=(0, 8), pady=3)

    # ------------------------------------------------------------ ações
    def _set(self, c: Candidate, status: CandidateStatus) -> None:
        self.ctx.candidate_repo.set_status(c.id, status)
        self.app.toast("Momento rejeitado.", "info")
        self.app.refresh_current()

    def _render(self, c: Candidate) -> None:
        from video.service import ClipError

        try:
            if c.status in (CandidateStatus.REJECTED, CandidateStatus.DISCARDED):
                self.ctx.candidate_repo.set_status(c.id, CandidateStatus.SCORED)
            self.ctx.clips.enqueue(c.id)
            self.app.toast("Clipe adicionado à fila de renderização.", "success")
        except ClipError as exc:
            self.app.toast(str(exc), "error")
        self.app.refresh_current()

    def _preview(self, c: Candidate, rec) -> None:
        segs = self.ctx.recording_repo.segments_covering(c.recording_id, c.start, c.end)
        info = (self.ctx.tools.cached() or {}).get("ffmpeg")
        ffplay = playback.find_ffplay(info.path if info else None)
        if not segs:
            self.app.toast("Os arquivos desta gravação já foram removidos.", "warn")
            return
        if not ffplay:
            self.app.toast("ffplay não encontrado (vem junto do FFmpeg completo).", "warn")
            return
        title = f"{c.streamer_name} · {timecode(c.start)} · nota {c.score:.0f}"
        playback.play(playback.preview_command(ffplay, [s.path for s in segs], c.start - segs[0].start_offset,
                                               c.duration, title))

    def _open(self, rec) -> None:
        try:
            playback.open_folder(rec.directory)
        except OSError as exc:
            self.app.toast(f"Não foi possível abrir a pasta: {exc}", "error")
