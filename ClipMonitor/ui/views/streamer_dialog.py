"""Formulário modal de cadastro/edição de streamer."""
from __future__ import annotations

from dataclasses import replace

import customtkinter as ctk

from config import theme as t
from models.streamer import Streamer
from ui.components.widgets import Card, Entry, GhostButton, PrimaryButton, Switch, label, muted


class StreamerDialog(ctk.CTkToplevel):
    def __init__(self, app, streamer: Streamer | None = None):
        super().__init__(app)
        self.app = app
        self.streamer = streamer
        editing = streamer is not None
        self.title("Editar streamer" if editing else "Adicionar streamer")
        self.configure(fg_color=t.BG)
        self.geometry("540x720")
        self.minsize(480, 700)
        self.transient(app)

        card = Card(self)
        card.pack(fill="both", expand=True, padx=16, pady=16)
        card.grid_columnconfigure(0, weight=1)

        label(card, "Editar streamer" if editing else "Novo streamer", font=t.FONT_SUBTITLE).grid(
            row=0, column=0, sticky="w", padx=22, pady=(20, 2))
        muted(card, "Cole o nome do canal ou o link da Twitch.").grid(row=1, column=0, sticky="w", padx=22)

        r = 2
        def field(title: str, widget, hint: str = ""):
            nonlocal r
            label(card, title, font=(t.FONT_FAMILY, 12, "bold")).grid(row=r, column=0, sticky="w", padx=22, pady=(14, 4))
            widget.grid(row=r + 1, column=0, sticky="ew", padx=22)
            r += 2
            if hint:
                muted(card, hint).grid(row=r, column=0, sticky="w", padx=22, pady=(2, 0))
                r += 1

        self.login = Entry(card, "ex.: nomedocanal ou twitch.tv/nomedocanal")
        field("Canal *", self.login)
        self.display = Entry(card, "Preenchido automaticamente pela Twitch")
        field("Nome de exibição", self.display)

        self.authorized = ctk.BooleanVar(value=streamer.authorized if editing else False)
        auth_box = ctk.CTkCheckBox(
            card, text="Tenho autorização deste streamer para criar e publicar clipes",
            variable=self.authorized, fg_color=t.ACCENT, hover_color=t.ACCENT_HOVER,
            checkmark_color=t.ACCENT_TEXT, border_color=t.BORDER, text_color=t.TEXT, font=t.FONT_BODY,
            command=self._on_authorized,
        )
        auth_box.grid(row=r, column=0, sticky="w", padx=22, pady=(18, 0)); r += 1
        self.auth_note = Entry(card, "Como/quando a autorização foi dada (opcional)")
        field("Registro da autorização", self.auth_note)

        self.monitoring = Switch(card, "Monitorar este canal")
        self.monitoring.grid(row=r, column=0, sticky="w", padx=22, pady=(16, 0)); r += 1

        label(card, "Observações", font=(t.FONT_FAMILY, 12, "bold")).grid(row=r, column=0, sticky="w", padx=22, pady=(14, 4)); r += 1
        self.notes = ctk.CTkTextbox(card, height=70, fg_color=t.SECONDARY, border_color=t.BORDER, border_width=2,
                                    text_color=t.TEXT, corner_radius=10, font=t.FONT_BODY)
        self.notes.grid(row=r, column=0, sticky="ew", padx=22); r += 1

        self.error = ctk.CTkLabel(card, text="", text_color=t.DANGER, font=t.FONT_SMALL, wraplength=420, justify="left")
        self.error.grid(row=r, column=0, sticky="w", padx=22, pady=(10, 0)); r += 1
        card.grid_rowconfigure(r, weight=1); r += 1

        buttons = ctk.CTkFrame(card, fg_color="transparent")
        buttons.grid(row=r, column=0, sticky="ew", padx=22, pady=(10, 20))
        self.save_btn = PrimaryButton(buttons, "Salvar", self._save, width=130)
        self.save_btn.pack(side="right")
        GhostButton(buttons, "Cancelar", self.destroy, width=110).pack(side="right", padx=(0, 8))

        if editing:
            self.login.insert(0, streamer.login)
            if streamer.display_name:
                self.display.insert(0, streamer.display_name)
            self.auth_note.insert(0, streamer.authorization_note)
            self.notes.insert("1.0", streamer.notes)
            if streamer.monitoring_enabled:
                self.monitoring.select()
        else:
            self.monitoring.select()
        self._sync_monitoring()

        self.bind("<Return>", lambda _e: self._save())
        self.bind("<Escape>", lambda _e: self.destroy())
        self.after(80, self._focus)

    def _focus(self) -> None:
        try:
            self.grab_set()
        except Exception:  # janela ainda não visível em alguns WMs
            pass
        self.login.focus_set()

    def _on_authorized(self) -> None:
        self._sync_monitoring()
        if self.authorized.get():
            self.monitoring.select()

    def _sync_monitoring(self) -> None:
        if self.authorized.get():
            self.monitoring.configure(state="normal")
        else:
            self.monitoring.deselect()
            self.monitoring.configure(state="disabled")

    def _collect(self) -> Streamer:
        base = self.streamer or Streamer(login="")
        return replace(
            base,
            login=self.login.get(),
            display_name=self.display.get(),
            authorized=bool(self.authorized.get()),
            authorization_note=self.auth_note.get(),
            monitoring_enabled=bool(self.monitoring.get()),
            notes=self.notes.get("1.0", "end").strip(),
        )

    def _save(self) -> None:
        data = self._collect()
        self.error.configure(text="")
        self.save_btn.configure(state="disabled", text="Salvando…")
        svc = self.app.ctx.streamers
        fn = (lambda: svc.update(data)) if data.id else (lambda: svc.add(data))
        self.app.runner.submit(fn, on_success=self._saved, on_error=self._failed)

    def _saved(self, s: Streamer) -> None:
        self.app.toast(f"{s.name} salvo com sucesso.", "success")
        self.app.refresh_current()
        if self.winfo_exists():
            self.destroy()

    def _failed(self, exc: BaseException) -> None:
        if not self.winfo_exists():
            return
        self.save_btn.configure(state="normal", text="Salvar")
        self.error.configure(text=str(exc) if isinstance(exc, ValueError) else f"Erro ao salvar: {exc}")
