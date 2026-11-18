"""Gerenciamento de streamers autorizados."""
from __future__ import annotations

import webbrowser

import customtkinter as ctk

from config import theme as t
from models.streamer import Streamer
from ui.components.widgets import (
    Avatar, Badge, Card, EmptyState, Entry, GhostButton, PageHeader, PrimaryButton, Switch, confirm, label, muted,
)
from ui.views.base import BaseView
from ui.views.streamer_dialog import StreamerDialog
from utils.timeutils import format_relative, format_viewers


class StreamersView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        header = PageHeader(self, "Streamers", "Canais autorizados que o ClipMonitor acompanha.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        PrimaryButton(header.actions, "+  Adicionar streamer", self.open_add, width=190).pack(side="right")

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=1, column=0, sticky="ew", pady=(0, 12))
        bar.grid_columnconfigure(0, weight=1)
        self.search = Entry(bar, "Buscar por nome ou canal…")
        self.search.grid(row=0, column=0, sticky="ew")
        self.search.bind("<KeyRelease>", lambda _e: self.refresh())
        self.filter = ctk.CTkSegmentedButton(
            bar, values=["Todos", "Ao vivo", "Monitorados", "Pausados"], command=lambda _v: self.refresh(),
            selected_color=t.ACCENT_DIM, selected_hover_color=t.ACCENT_DIM, unselected_color=t.SECONDARY,
            unselected_hover_color=t.CARD_HOVER, fg_color=t.SECONDARY, text_color=t.TEXT,
            font=(t.FONT_FAMILY, 12), height=38,
        )
        self.filter.set("Todos")
        self.filter.grid(row=0, column=1, padx=(10, 0))

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=2, column=0, sticky="nsew")
        self.list.grid_columnconfigure(0, weight=1)

    def open_add(self) -> None:
        StreamerDialog(self.app)

    def _filtered(self) -> list[Streamer]:
        term = self.search.get().strip().lower()
        mode = self.filter.get()
        out = []
        for s in self.ctx.streamers.list():
            if term and term not in s.login.lower() and term not in s.display_name.lower():
                continue
            if mode == "Ao vivo" and not s.is_live:
                continue
            if mode == "Monitorados" and not s.is_monitorable:
                continue
            if mode == "Pausados" and s.is_monitorable:
                continue
            out.append(s)
        return out

    def refresh(self) -> None:
        for w in self.list.winfo_children():
            w.destroy()
        items = self._filtered()
        if not items:
            if self.search.get().strip() or self.filter.get() != "Todos":
                EmptyState(self.list, "Nenhum resultado", "Ajuste a busca ou o filtro.").grid(row=0, column=0, sticky="ew")
            else:
                EmptyState(self.list, "Nenhum streamer cadastrado",
                           "Adicione os canais que autorizaram você a criar clipes.",
                           "+  Adicionar streamer", self.open_add).grid(row=0, column=0, sticky="ew")
            return
        for i, s in enumerate(items):
            self._row(s).grid(row=i, column=0, sticky="ew", pady=5, padx=2)

    def _row(self, s: Streamer) -> Card:
        card = Card(self.list)
        card.grid_columnconfigure(1, weight=1)
        Avatar(card, s.name, size=44, live=s.is_live).grid(row=0, column=0, rowspan=2, padx=16, pady=14)

        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=0, column=1, sticky="w", pady=(14, 0))
        label(top, s.name, font=(t.FONT_FAMILY, 14, "bold")).pack(side="left")
        muted(top, f"  @{s.login}").pack(side="left")
        if s.is_live:
            Badge(top, "AO VIVO", "live").pack(side="left", padx=(10, 0))
        if not s.authorized:
            Badge(top, "SEM AUTORIZAÇÃO", "warn").pack(side="left", padx=(8, 0))
        elif not s.twitch_user_id:
            Badge(top, "NÃO VERIFICADO", "off").pack(side="left", padx=(8, 0))

        if s.is_live:
            detail = f"{s.game_name or 'Sem categoria'} · {format_viewers(s.viewer_count)} espectadores · {(s.stream_title or '')[:70]}"
        else:
            detail = f"Offline · verificado {format_relative(s.last_checked_at)}"
        muted(card, detail).grid(row=1, column=1, sticky="w", pady=(0, 14))

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=0, column=2, rowspan=2, padx=14)
        sw = Switch(actions, "Monitorar", command=lambda: self._toggle(s, sw))
        if s.monitoring_enabled:
            sw.select()
        if not s.authorized:
            sw.configure(state="disabled")
        sw.pack(side="left", padx=(0, 12))
        GhostButton(actions, "↗", lambda: webbrowser.open(s.channel_url), width=38).pack(side="left", padx=2)
        GhostButton(actions, "Editar", lambda: StreamerDialog(self.app, s), width=70).pack(side="left", padx=2)
        GhostButton(actions, "Remover", lambda: self._remove(s), danger=True, width=80).pack(side="left", padx=2)
        return card

    def _toggle(self, s: Streamer, sw: Switch) -> None:
        enabled = bool(sw.get())
        try:
            self.ctx.streamers.set_monitoring(s.id, enabled)
        except ValueError as exc:
            self.app.toast(str(exc), "error")
        self.app.refresh_current()

    def _remove(self, s: Streamer) -> None:
        if confirm(self.app, "Remover streamer",
                   f"Remover {s.name} da lista? O histórico de transmissões deste canal também será apagado.",
                   "Remover", danger=True):
            self.ctx.streamers.remove(s.id)
            self.app.toast(f"{s.name} removido.", "info")
            self.app.refresh_current()
