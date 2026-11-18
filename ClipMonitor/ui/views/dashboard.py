"""Painel: visão geral do monitoramento."""
from __future__ import annotations

import customtkinter as ctk

from config import theme as t
from ui.components.widgets import (
    Avatar, Badge, Card, EmptyState, GhostButton, PageHeader, PrimaryButton, StatCard, label, muted,
)
from ui.views.base import BaseView
from utils.timeutils import format_duration, format_relative, format_viewers, utcnow


class DashboardView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        header = PageHeader(self, "Painel", "Acompanhe seus streamers e o status do monitoramento.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        self.check_btn = GhostButton(header.actions, "↻  Verificar agora", self.app.check_now, width=160)
        self.check_btn.pack(side="right")

        self.stats = ctk.CTkFrame(self, fg_color="transparent")
        self.stats.grid(row=1, column=0, sticky="ew")
        self.stat_total = StatCard(self.stats, "Streamers", hint="cadastrados")
        self.stat_live = StatCard(self.stats, "Ao vivo agora", hint="canais transmitindo", accent=True)
        self.stat_monitored = StatCard(self.stats, "Monitorados", hint="autorizados e ativos")
        self.stat_clips = StatCard(self.stats, "Clipes", hint="disponível na Fase 4")
        self._stat_cards = [self.stat_total, self.stat_live, self.stat_monitored, self.stat_clips]
        self._stat_cols = 0
        self.stats.bind("<Configure>", self._layout_stats)
        self._layout_stats()

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.grid(row=2, column=0, sticky="nsew", pady=(t.PAD, 0))
        body.grid_columnconfigure(0, weight=3)
        body.grid_columnconfigure(1, weight=2)
        body.grid_rowconfigure(0, weight=1)

        live_card = Card(body)
        live_card.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        live_card.grid_columnconfigure(0, weight=1)
        live_card.grid_rowconfigure(1, weight=1)
        label(live_card, "Ao vivo", font=t.FONT_SUBTITLE).grid(row=0, column=0, sticky="w", padx=18, pady=(16, 8))
        self.last_check = muted(live_card, "")
        self.last_check.grid(row=0, column=1, sticky="e", padx=18, pady=(16, 8))
        self.live_list = ctk.CTkScrollableFrame(live_card, fg_color="transparent")
        self.live_list.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=8, pady=(0, 10))
        self.live_list.grid_columnconfigure(0, weight=1)

        act_card = Card(body)
        act_card.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        act_card.grid_columnconfigure(0, weight=1)
        act_card.grid_rowconfigure(1, weight=1)
        label(act_card, "Atividade recente", font=t.FONT_SUBTITLE).grid(row=0, column=0, sticky="w", padx=18, pady=(16, 8))
        self.activity_list = ctk.CTkScrollableFrame(act_card, fg_color="transparent")
        self.activity_list.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 10))
        self.activity_list.grid_columnconfigure(0, weight=1)

    def _layout_stats(self, _event=None) -> None:
        width = self.stats.winfo_width()
        cols = 2 if 1 < width < 760 else 4
        if cols == self._stat_cols:
            return
        self._stat_cols = cols
        for i in range(4):
            self.stats.grid_columnconfigure(i, weight=1 if i < cols else 0, uniform="stat" if i < cols else "")
        for i, card in enumerate(self._stat_cards):
            r, c = divmod(i, cols)
            card.grid(row=r, column=c, sticky="ew", padx=(0 if c == 0 else 6, 0 if c == cols - 1 else 6), pady=6)

    def refresh(self) -> None:
        counts = self.ctx.streamer_repo.counts()
        self.stat_total.set(str(counts["total"]))
        self.stat_live.set(str(counts["live"]))
        self.stat_monitored.set(str(counts["monitored"]))
        self.stat_clips.set("0")
        streamers = self.ctx.streamers.list()
        self._render_live([s for s in streamers if s.is_live])
        checked = [s.last_checked_at for s in streamers if s.last_checked_at]
        self.last_check.configure(text=f"Última verificação: {format_relative(max(checked))}" if checked else "")
        self._render_activity()

    def _clear(self, frame) -> None:
        for w in frame.winfo_children():
            w.destroy()

    def _render_live(self, live) -> None:
        self._clear(self.live_list)
        if not live:
            if not self.ctx.settings_repo.load().has_twitch_credentials():
                EmptyState(self.live_list, "Conecte sua conta da Twitch",
                           "Informe o Client ID e o Client Secret para verificar quem está ao vivo.",
                           "Abrir configurações", lambda: self.app.show("settings")).grid(row=0, column=0, sticky="ew")
            else:
                EmptyState(self.live_list, "Ninguém ao vivo no momento",
                           "Quando um streamer monitorado iniciar uma transmissão, ele aparecerá aqui.").grid(
                    row=0, column=0, sticky="ew")
            return
        now = utcnow()
        for i, s in enumerate(live):
            row = ctk.CTkFrame(self.live_list, fg_color=t.SECONDARY, corner_radius=10)
            row.grid(row=i, column=0, sticky="ew", pady=4, padx=4)
            row.grid_columnconfigure(1, weight=1)
            Avatar(row, s.name, live=True).grid(row=0, column=0, rowspan=2, padx=12, pady=10)
            label(row, s.name, font=(t.FONT_FAMILY, 13, "bold")).grid(row=0, column=1, sticky="w", pady=(10, 0))
            title = (s.stream_title or "")[:90]
            muted(row, f"{s.game_name or 'Sem categoria'} · {title}").grid(row=1, column=1, sticky="w", pady=(0, 10))
            Badge(row, "AO VIVO", "live").grid(row=0, column=2, padx=12, pady=(10, 0), sticky="e")
            uptime = format_duration((now - s.live_since).total_seconds()) if s.live_since else "—"
            muted(row, f"👁 {format_viewers(s.viewer_count)}  ·  ⏱ {uptime}").grid(row=1, column=2, padx=12, pady=(0, 10), sticky="e")

    def _render_activity(self) -> None:
        self._clear(self.activity_list)
        items = self.ctx.activity_repo.recent(25)
        if not items:
            muted(self.activity_list, "Nenhuma atividade ainda.").grid(row=0, column=0, sticky="w", padx=10, pady=10)
            return
        dot_colors = {"live": t.LIVE, "error": t.DANGER, "warn": t.WARNING}
        for i, item in enumerate(items):
            row = ctk.CTkFrame(self.activity_list, fg_color="transparent")
            row.grid(row=i, column=0, sticky="ew", pady=3)
            row.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(row, text="●", text_color=dot_colors.get(item["level"], t.ACCENT),
                         font=(t.FONT_FAMILY, 10)).grid(row=0, column=0, sticky="n", padx=(6, 8), pady=(2, 0))
            label(row, item["message"], font=t.FONT_SMALL, wraplength=300).grid(row=0, column=1, sticky="w")
            ctk.CTkLabel(row, text=format_relative(item["created_at"]), text_color=t.TEXT_DIM,
                         font=(t.FONT_FAMILY, 10)).grid(row=1, column=1, sticky="w")
