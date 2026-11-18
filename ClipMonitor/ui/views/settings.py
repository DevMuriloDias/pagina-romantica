"""Configurações da aplicação."""
from __future__ import annotations

import webbrowser
from dataclasses import replace
from tkinter import filedialog

import customtkinter as ctk

from config import theme as t
from config.settings import MAX_POLL_INTERVAL, MIN_POLL_INTERVAL, WHISPER_MODELS, ensure_directories
from ui.components.widgets import Card, Entry, GhostButton, PageHeader, PrimaryButton, Switch, label, muted
from ui.views.base import BaseView

TWITCH_CONSOLE_URL = "https://dev.twitch.tv/console/apps"


class SettingsView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        header = PageHeader(self, "Configurações", "Credenciais, monitoramento e preferências de processamento.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        PrimaryButton(header.actions, "Salvar alterações", self.save, width=170).pack(side="right")

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll.grid(row=1, column=0, sticky="nsew")
        scroll.grid_columnconfigure(0, weight=1)

        # ---- Twitch
        tw = self._section(scroll, 0, "Conexão com a Twitch",
                           "Crie um aplicativo em dev.twitch.tv (categoria 'Application Integration', "
                           "OAuth Redirect: http://localhost) e copie o Client ID e o Client Secret.")
        self.client_id = Entry(tw, "Client ID")
        self._field(tw, "Client ID", self.client_id)
        secret_row = ctk.CTkFrame(tw, fg_color="transparent")
        secret_row.grid_columnconfigure(0, weight=1)
        self.client_secret = Entry(secret_row, "Client Secret", show="•")
        self.client_secret.grid(row=0, column=0, sticky="ew")
        self.show_secret = GhostButton(secret_row, "Mostrar", self._toggle_secret, width=90)
        self.show_secret.grid(row=0, column=1, padx=(8, 0))
        self._field(tw, "Client Secret", secret_row, "Armazenado criptografado com a proteção de dados do Windows.")
        row = ctk.CTkFrame(tw, fg_color="transparent")
        row.grid(row=self._next(tw), column=0, sticky="ew", padx=20, pady=(14, 18))
        self.test_btn = GhostButton(row, "Testar conexão", self.test_connection, width=150)
        self.test_btn.pack(side="left")
        GhostButton(row, "Abrir console da Twitch ↗", lambda: webbrowser.open(TWITCH_CONSOLE_URL), width=210).pack(
            side="left", padx=8)
        self.test_status = muted(row, "")
        self.test_status.pack(side="left", padx=8)

        # ---- Monitoramento
        mon = self._section(scroll, 1, "Monitoramento", "Com que frequência o status ao vivo é consultado.")
        interval_row = ctk.CTkFrame(mon, fg_color="transparent")
        interval_row.grid_columnconfigure(0, weight=1)
        self.interval_label = label(interval_row, "", font=(t.FONT_FAMILY, 13, "bold"), color=t.ACCENT, width=70)
        self.interval = ctk.CTkSlider(
            interval_row, from_=MIN_POLL_INTERVAL, to=600, number_of_steps=(600 - MIN_POLL_INTERVAL) // 15,
            command=self._on_interval, progress_color=t.ACCENT, button_color=t.ACCENT,
            button_hover_color=t.ACCENT_HOVER, fg_color=t.BORDER,
        )
        self.interval.grid(row=0, column=0, sticky="ew")
        self.interval_label.grid(row=0, column=1, padx=(12, 0))
        self._field(mon, "Intervalo de verificação", interval_row,
                    f"Entre {MIN_POLL_INTERVAL} s e 10 min. Valores menores detectam lives mais cedo.")
        self.autostart = Switch(mon, "Iniciar monitoramento ao abrir o ClipMonitor")
        self.autostart.grid(row=self._next(mon), column=0, sticky="w", padx=20, pady=(14, 18))

        # ---- Processamento
        proc = self._section(scroll, 2, "Processamento de clipes",
                             "Usado nas próximas fases (captura, transcrição e exportação).")
        out_row = ctk.CTkFrame(proc, fg_color="transparent")
        out_row.grid_columnconfigure(0, weight=1)
        self.output_dir = Entry(out_row, "Pasta de saída")
        self.output_dir.grid(row=0, column=0, sticky="ew")
        GhostButton(out_row, "Procurar…", self._browse, width=100).grid(row=0, column=1, padx=(8, 0))
        self._field(proc, "Pasta de saída", out_row, "Subpastas: pending, approved, rejected e thumbnails.")

        grid = ctk.CTkFrame(proc, fg_color="transparent")
        grid.grid(row=self._next(proc), column=0, sticky="ew", padx=20, pady=(14, 18))
        for i in range(3):
            grid.grid_columnconfigure(i, weight=1, uniform="p")
        self.whisper = self._option(grid, 0, "Modelo Whisper", list(WHISPER_MODELS))
        self.clip_len = self._option(grid, 1, "Duração do clipe", ["30", "45", "60", "90"])
        self.jobs = self._option(grid, 2, "Tarefas simultâneas", ["1", "2"])
        muted(proc, "Para o i3-10100F recomendamos o modelo 'small' (int8) e 1 tarefa simultânea.").grid(
            row=self._next(proc), column=0, sticky="w", padx=20, pady=(0, 18))

    # ------------------------------------------------------------ helpers
    def _section(self, parent, row: int, title: str, subtitle: str) -> Card:
        card = Card(parent)
        card.grid(row=row, column=0, sticky="ew", pady=(0, 16))
        card.grid_columnconfigure(0, weight=1)
        card._rows = 0  # type: ignore[attr-defined]
        label(card, title, font=t.FONT_SUBTITLE).grid(row=self._next(card), column=0, sticky="w", padx=20, pady=(18, 2))
        muted(card, subtitle, wraplength=760).grid(row=self._next(card), column=0, sticky="w", padx=20)
        return card

    @staticmethod
    def _next(card) -> int:
        r = card._rows
        card._rows += 1
        return r

    def _field(self, card, title: str, widget, hint: str = "") -> None:
        label(card, title, font=(t.FONT_FAMILY, 12, "bold")).grid(row=self._next(card), column=0, sticky="w", padx=20, pady=(14, 4))
        widget.grid(row=self._next(card), column=0, sticky="ew", padx=20)
        if hint:
            muted(card, hint).grid(row=self._next(card), column=0, sticky="w", padx=20, pady=(3, 0))

    def _option(self, parent, col: int, title: str, values: list[str]) -> ctk.CTkOptionMenu:
        box = ctk.CTkFrame(parent, fg_color="transparent")
        box.grid(row=0, column=col, sticky="ew", padx=(0 if col == 0 else 6, 0))
        label(box, title, font=(t.FONT_FAMILY, 12, "bold")).pack(anchor="w", pady=(0, 4))
        menu = ctk.CTkOptionMenu(
            box, values=values, fg_color=t.SECONDARY, button_color=t.BORDER, button_hover_color=t.CARD_HOVER,
            dropdown_fg_color=t.CARD, dropdown_hover_color=t.CARD_HOVER, text_color=t.TEXT, height=36,
            corner_radius=10, font=t.FONT_BODY,
        )
        menu.pack(fill="x")
        return menu

    def _toggle_secret(self) -> None:
        hidden = self.client_secret.cget("show") == "•"
        self.client_secret.configure(show="" if hidden else "•")
        self.show_secret.configure(text="Ocultar" if hidden else "Mostrar")

    def _on_interval(self, value: float) -> None:
        seconds = int(value)
        self.interval_label.configure(text=f"{seconds} s" if seconds < 60 else f"{seconds // 60} min {seconds % 60:02d} s")

    def _browse(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.output_dir.get() or None, title="Escolha a pasta de saída")
        if folder:
            self._set_entry(self.output_dir, folder)

    @staticmethod
    def _set_entry(entry, value: str) -> None:
        entry.delete(0, "end")
        if value:
            entry.insert(0, value)

    # ------------------------------------------------------------ dados
    def refresh(self) -> None:
        s = self.ctx.settings_repo.load()
        self._set_entry(self.client_id, s.twitch_client_id)
        self._set_entry(self.client_secret, s.twitch_client_secret)
        interval = min(600, max(MIN_POLL_INTERVAL, s.poll_interval_seconds))
        self.interval.set(interval)
        self._on_interval(interval)
        self.autostart.select() if s.start_monitoring_on_launch else self.autostart.deselect()
        self._set_entry(self.output_dir, s.output_dir)
        self.whisper.set(s.whisper_model)
        self.clip_len.set(str(s.clip_duration_seconds))
        self.jobs.set(str(s.max_parallel_jobs))

    def _collect(self):
        current = self.ctx.settings_repo.load()
        return replace(
            current,
            twitch_client_id=self.client_id.get(),
            twitch_client_secret=self.client_secret.get(),
            poll_interval_seconds=int(self.interval.get()),
            start_monitoring_on_launch=bool(self.autostart.get()),
            output_dir=self.output_dir.get(),
            whisper_model=self.whisper.get(),
            clip_duration_seconds=int(self.clip_len.get()),
            max_parallel_jobs=int(self.jobs.get()),
        )

    def save(self) -> None:
        try:
            saved = self.ctx.settings_repo.save(self._collect())
            ensure_directories(saved.output_dir)
        except (OSError, ValueError) as exc:
            self.app.toast(f"Não foi possível salvar: {exc}", "error")
            return
        self.ctx.twitch.reset()
        self.ctx.monitor.trigger_now()
        self.app.toast("Configurações salvas.", "success")
        self.refresh()

    def test_connection(self) -> None:
        cid, secret = self.client_id.get(), self.client_secret.get()
        if not cid.strip() or not secret.strip():
            self.test_status.configure(text="Preencha Client ID e Client Secret.", text_color=t.WARNING)
            return
        self.test_btn.configure(state="disabled", text="Testando…")
        self.test_status.configure(text="")

        def ok(msg: str) -> None:
            self.test_btn.configure(state="normal", text="Testar conexão")
            self.test_status.configure(text=f"✓ {msg}", text_color=t.ACCENT)

        def fail(exc: BaseException) -> None:
            self.test_btn.configure(state="normal", text="Testar conexão")
            self.test_status.configure(text=f"✕ {exc}", text_color=t.DANGER)

        self.app.runner.submit(lambda: self.ctx.twitch.test_credentials(cid, secret), ok, fail)
