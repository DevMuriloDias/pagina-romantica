"""Fila de capturas e processamento, com indicadores de status."""
from __future__ import annotations

import customtkinter as ctk

from config import theme as t
from models.job import Job, JobStatus
from ui.components.widgets import (
    Badge, Card, EmptyState, GhostButton, PageHeader, ProgressBar, StatCard, StatusRow, confirm, label, muted,
)
from ui.views.base import BaseView
from utils.timeutils import format_relative

FILTERS = {
    "Ativas": (JobStatus.QUEUED, JobStatus.RUNNING),
    "Falhas": (JobStatus.FAILED, JobStatus.INTERRUPTED),
    "Concluídas": (JobStatus.COMPLETED, JobStatus.CANCELLED),
    "Todas": None,
}
STATUS_BADGE = {
    JobStatus.QUEUED: "off",
    JobStatus.RUNNING: "on",
    JobStatus.COMPLETED: "on",
    JobStatus.FAILED: "live",
    JobStatus.CANCELLED: "off",
    JobStatus.INTERRUPTED: "warn",
}


class QueueView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(4, weight=1)

        header = PageHeader(self, "Fila e capturas", "Acompanhe gravações e etapas de processamento.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        GhostButton(header.actions, "Limpar concluídas", self._clear_finished, width=150).pack(side="right")
        GhostButton(header.actions, "↻  Verificar ferramentas", lambda: self.app.refresh_tools(notify=True),
                    width=190).pack(side="right", padx=(0, 8))

        stats = ctk.CTkFrame(self, fg_color="transparent")
        stats.grid(row=1, column=0, sticky="ew")
        for i in range(4):
            stats.grid_columnconfigure(i, weight=1, uniform="q")
        self.s_capturing = StatCard(stats, "Gravando agora", hint="capturas em andamento", accent=True)
        self.s_cap_queue = StatCard(stats, "Capturas na fila", hint="aguardando início")
        self.s_processing = StatCard(stats, "Processando", hint="análise, legendas, exportação")
        self.s_failed = StatCard(stats, "Com falha", hint="podem ser reenfileiradas")
        for i, c in enumerate([self.s_capturing, self.s_cap_queue, self.s_processing, self.s_failed]):
            c.grid(row=0, column=i, sticky="ew", padx=(0 if i == 0 else 6, 0 if i == 3 else 6))

        tools = Card(self)
        tools.grid(row=2, column=0, sticky="ew", pady=(16, 0))
        for i in range(3):
            tools.grid_columnconfigure(i, weight=1, uniform="tools")
        self.t_streamlink = StatusRow(tools, "Streamlink")
        self.t_ffmpeg = StatusRow(tools, "FFmpeg")
        self.t_worker = StatusRow(tools, "Executor de tarefas")
        for i, row in enumerate([self.t_streamlink, self.t_ffmpeg, self.t_worker]):
            row.grid(row=0, column=i, sticky="ew", padx=18, pady=(14, 4))
        self.tools_hint = muted(tools, "", wraplength=900)
        self.tools_hint.grid(row=1, column=0, columnspan=3, sticky="w", padx=18, pady=(0, 12))

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=3, column=0, sticky="ew", pady=(16, 10))
        label(bar, "Tarefas", font=t.FONT_SUBTITLE).pack(side="left")
        self.filter = ctk.CTkSegmentedButton(
            bar, values=list(FILTERS), command=lambda _v: self.refresh(),
            selected_color=t.ACCENT_DIM, selected_hover_color=t.ACCENT_DIM, unselected_color=t.SECONDARY,
            unselected_hover_color=t.CARD_HOVER, fg_color=t.SECONDARY, text_color=t.TEXT,
            font=(t.FONT_FAMILY, 12), height=34,
        )
        self.filter.set("Ativas")
        self.filter.pack(side="right")

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=4, column=0, sticky="nsew")
        self.list.grid_columnconfigure(0, weight=1)
        self._rows: dict[int, dict] = {}
        self._signature: tuple = ()

    # ------------------------------------------------------------ dados
    def refresh(self) -> None:
        p = self.app.pipeline
        self.s_capturing.set(str(p.capture_running))
        self.s_cap_queue.set(str(p.capture_queued))
        self.s_processing.set(str(p.processing_running), f"{p.processing_queued} aguardando na fila")
        self.s_failed.set(str(p.failed))
        self._render_tools()

        jobs = self.ctx.job_repo.list(FILTERS[self.filter.get()])
        signature = tuple((j.id, j.status) for j in jobs) + (self.filter.get(),)
        if signature == self._signature:
            for j in jobs:  # só progresso/mensagem mudaram: atualiza no lugar
                self._update_row(j)
            return
        self._signature = signature
        for w in self.list.winfo_children():
            w.destroy()
        self._rows = {}
        if not jobs:
            EmptyState(
                self.list,
                "Nenhuma tarefa aqui" if self.filter.get() != "Ativas" else "Fila vazia",
                "Quando um streamer autorizado entra ao vivo, a gravação começa automaticamente; cada "
                "segmento gravado passa por análise de áudio e transcrição. Tudo aparece aqui.",
            ).grid(row=0, column=0, sticky="ew")
            return
        for i, job in enumerate(jobs):
            self._build_row(job).grid(row=i, column=0, sticky="ew", pady=4, padx=2)

    def _render_tools(self) -> None:
        tools = self.ctx.tools.cached()
        hints = []
        for row, key in ((self.t_streamlink, "streamlink"), (self.t_ffmpeg, "ffmpeg")):
            info = (tools or {}).get(key)
            if tools is None:
                row.set("verificando…", t.TEXT_DIM)
            elif info and info.available:
                row.set(info.version or "instalado", t.ACCENT)
            else:
                row.set("não encontrado", t.WARNING)
                if info and info.hint:
                    hints.append(f"{info.name}: {info.hint}")
        if self.app.pipeline.worker_running:
            self.t_worker.set("ativo", t.ACCENT)
        else:
            self.t_worker.set("parado", t.TEXT_DIM)
        self.tools_hint.configure(text="   ·   ".join(hints) if hints else "Tudo pronto para capturar e processar.")

    # ------------------------------------------------------------ linhas
    def _build_row(self, job: Job) -> Card:
        card = Card(self.list)
        card.grid_columnconfigure(1, weight=1)
        icon = "●" if job.job_type.is_capture else "◆"
        color = t.LIVE if job.job_type.is_capture and job.status is JobStatus.RUNNING else t.ACCENT
        ctk.CTkLabel(card, text=icon, text_color=color, font=(t.FONT_FAMILY, 16), width=30).grid(
            row=0, column=0, rowspan=3, padx=(14, 4))

        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=0, column=1, sticky="w", pady=(12, 0))
        label(top, job.job_type.label, font=(t.FONT_FAMILY, 13, "bold")).pack(side="left")
        if job.streamer_name:
            muted(top, f"  ·  {job.streamer_name}").pack(side="left")
        Badge(top, job.status.label.upper(), STATUS_BADGE[job.status]).pack(side="left", padx=(10, 0))

        message = muted(card, "")
        message.grid(row=1, column=1, sticky="w")
        progress = ProgressBar(card)
        pct = muted(card, "", font=(t.FONT_FAMILY, 11, "bold"))
        if job.status is JobStatus.RUNNING and job.job_type.is_capture:
            progress.configure(mode="indeterminate", progress_color=t.LIVE)
            progress.grid(row=2, column=1, sticky="ew", pady=(6, 12))
            progress.start()
        elif job.status is JobStatus.RUNNING:
            progress.grid(row=2, column=1, sticky="ew", pady=(6, 12))
            pct.grid(row=2, column=2, sticky="w", padx=(10, 0), pady=(6, 12))
        else:
            message.grid_configure(pady=(0, 12))

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=0, column=3, rowspan=3, padx=14)
        if job.status.is_active:
            GhostButton(actions, "Cancelar", lambda: self._cancel(job), danger=True, width=90).pack(side="left", padx=2)
        if job.status.is_retryable:
            GhostButton(actions, "Tentar novamente", lambda: self._retry(job), width=140).pack(side="left", padx=2)
        if job.status is not JobStatus.RUNNING:
            GhostButton(actions, "Remover", lambda: self._remove(job), width=80).pack(side="left", padx=2)

        self._rows[job.id] = {"message": message, "progress": progress, "pct": pct}
        self._update_row(job)
        return card

    def _update_row(self, job: Job) -> None:
        row = self._rows.get(job.id)
        if not row:
            return
        if job.status is JobStatus.FAILED and job.error:
            text, color = f"Erro: {job.error}", t.DANGER
        elif job.status is JobStatus.QUEUED and not self.ctx.jobs.has_handler(job.job_type):
            text, color = f"{job.job_type.label} chega na próxima fase", t.TEXT_MUTED
        else:
            text, color = job.message or "", t.TEXT_MUTED
        when = job.finished_at or job.started_at or job.created_at
        suffix = f"  ·  {format_relative(when)}" if when else ""
        row["message"].configure(text=f"{text}{suffix}".strip(" ·"), text_color=color)
        if not (job.job_type.is_capture and job.status is JobStatus.RUNNING):
            row["progress"].set(job.progress)
        row["pct"].configure(text=f"{int(job.progress * 100)}%")

    # ------------------------------------------------------------ ações
    def _cancel(self, job: Job) -> None:
        if self.ctx.jobs.cancel(job.id):
            self.app.toast("Cancelamento solicitado.", "info")
        self.app.refresh_current()

    def _retry(self, job: Job) -> None:
        if self.ctx.jobs.retry(job.id):
            self.app.toast("Tarefa recolocada na fila.", "success")
        else:
            self.app.toast("Já existe uma tarefa equivalente ativa.", "warn")
        self.app.refresh_current()

    def _remove(self, job: Job) -> None:
        self.ctx.jobs.remove(job.id)
        self.app.refresh_current()

    def _clear_finished(self) -> None:
        if confirm(self.app, "Limpar concluídas", "Remover da lista as tarefas concluídas e canceladas?", "Limpar"):
            n = self.ctx.jobs.clear_finished()
            self.app.toast(f"{n} tarefa(s) removida(s).", "info")
            self.app.refresh_current()
