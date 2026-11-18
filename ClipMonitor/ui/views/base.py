from __future__ import annotations

import customtkinter as ctk


class BaseView(ctk.CTkFrame):
    """Tela da aplicação. ``app`` é a janela principal (ClipMonitorApp)."""

    def __init__(self, master, app):
        super().__init__(master, fg_color="transparent")
        self.app = app

    @property
    def ctx(self):
        return self.app.ctx

    def on_show(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        pass

    def tick(self) -> None:
        """Chamado a cada segundo enquanto a tela está visível (sem IO pesado)."""
        pass
