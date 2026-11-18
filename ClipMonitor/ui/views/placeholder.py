"""Telas das funcionalidades das próximas fases."""
from __future__ import annotations

from config import theme as t
from ui.components.widgets import Card, EmptyState, PageHeader
from ui.views.base import BaseView


class PlaceholderView(BaseView):
    def __init__(self, master, app, title: str, subtitle: str, phase: str, description: str):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        PageHeader(self, title, subtitle).grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        card = Card(self)
        card.grid(row=1, column=0, sticky="nsew")
        EmptyState(card, f"Chega na {phase}", description).pack(expand=True)
