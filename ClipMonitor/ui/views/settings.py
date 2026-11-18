"""Configurações da aplicação."""
from __future__ import annotations

import webbrowser
from dataclasses import replace
from tkinter import filedialog

import customtkinter as ctk

from config import theme as t
from config.settings import MAX_POLL_INTERVAL, MIN_POLL_INTERVAL, QUALITY_PRESETS, WHISPER_MODELS, ensure_directories
from ui.components.widgets import Card, Entry, GhostButton, PageHeader, PrimaryButton, Switch, label, muted
from ui.views.base import BaseView

TWITCH_CONSOLE_URL = "https://dev.twitch.tv/console/apps"
DISK_OPTIONS = {"5 GB": 5, "10 GB": 10, "20 GB": 20, "50 GB": 50}
RETENTION_OPTIONS = {"12 horas": 12, "24 horas": 24, "48 horas": 48, "7 dias": 168}
PER_HOUR_OPTIONS = {"3 por hora": 3, "6 por hora": 6, "10 por hora": 10, "15 por hora": 15}
GAP_OPTIONS = {"Sem folga": 0, "10 s": 10, "15 s": 15, "30 s": 30, "60 s": 60}
from video.layout import LAYOUTS
from video.renderer import ENCODE_PRESETS

LAYOUT_OPTIONS = {label: key for key, label in LAYOUTS.items()}
QUALITY_OPTIONS = {label: key for key, (_p, _c, label) in ENCODE_PRESETS.items()}
FPS_OPTIONS = {"30 fps (recomendado)": 30, "60 fps (mais lento)": 60}
GRACE_OPTIONS = {
    "Imediata (1 verificação)": 1,
    "2 verificações seguidas (recomendado)": 2,
    "3 verificações seguidas": 3,
    "5 verificações seguidas": 5,
}


class SettingsView(BaseView):
    def __init__(self, master, app):
        super().__init__(master, app)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        header = PageHeader(self, "Configurações", "Credenciais, monitoramento e preferências de processamento.")
        header.grid(row=0, column=0, sticky="ew", pady=(0, t.PAD))
        PrimaryButton(header.actions, "Salvar alterações", self.save, width=170).pack(side="right")

        scroll = self.scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
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
        grace_row = ctk.CTkFrame(mon, fg_color="transparent")
        grace_row.grid_columnconfigure(1, weight=1)
        self.grace = self._menu(grace_row, list(GRACE_OPTIONS))
        self.grace.grid(row=0, column=0, sticky="w")
        self._field(mon, "Confirmação de fim da live", grace_row,
                    "A Twitch às vezes omite um canal por instantes. Exigir mais de uma verificação "
                    "evita registrar um falso fim de transmissão.")
        muted(mon, "Cada streamer pode ter um intervalo próprio (Streamers → Editar).").grid(
            row=self._next(mon), column=0, sticky="w", padx=20, pady=(10, 0))
        self.autostart = Switch(mon, "Iniciar monitoramento ao abrir o ClipMonitor")
        self.autostart.grid(row=self._next(mon), column=0, sticky="w", padx=20, pady=(14, 18))

        # ---- Processamento
        proc = self._section(scroll, 2, "Processamento de clipes",
                             "Usado pela fila de captura e processamento.")
        out_row = ctk.CTkFrame(proc, fg_color="transparent")
        out_row.grid_columnconfigure(0, weight=1)
        self.output_dir = Entry(out_row, "Pasta de saída")
        self.output_dir.grid(row=0, column=0, sticky="ew")
        GhostButton(out_row, "Procurar…", self._browse, width=100).grid(row=0, column=1, padx=(8, 0))
        self._field(proc, "Pasta de saída", out_row, "Subpastas: pending, approved, rejected e thumbnails.")

        grid = ctk.CTkFrame(proc, fg_color="transparent")
        grid.grid(row=self._next(proc), column=0, sticky="ew", padx=20, pady=(14, 18))
        for i in range(4):
            grid.grid_columnconfigure(i, weight=1, uniform="p")
        self.whisper = self._option(grid, 0, "Modelo Whisper", list(WHISPER_MODELS))
        self.clip_len = self._option(grid, 1, "Duração do clipe (s)", ["30", "45", "60", "90"])
        self.jobs = self._option(grid, 2, "Processamentos simultâneos", ["1", "2"])
        self.captures = self._option(grid, 3, "Capturas simultâneas", ["1", "2", "3", "4"])
        muted(proc, "Para o i3-10100F recomendamos o modelo 'small' (int8) e 1 processamento por vez. "
                    "Capturas usam pouca CPU e rodam em paralelo ao processamento.", wraplength=760).grid(
            row=self._next(proc), column=0, sticky="w", padx=20, pady=(0, 18))

        # ---- Captura e detecção
        det = self._section(scroll, 3, "Captura e detecção de momentos",
                            "Gravação das lives autorizadas e critérios para escolher os melhores trechos.")
        self.auto_capture = Switch(det, "Gravar automaticamente quando um streamer autorizado entrar ao vivo")
        self.auto_capture.grid(row=self._next(det), column=0, sticky="w", padx=20, pady=(14, 0))
        cap = ctk.CTkFrame(det, fg_color="transparent")
        cap.grid(row=self._next(det), column=0, sticky="ew", padx=20, pady=(14, 0))
        for i in range(3):
            cap.grid_columnconfigure(i, weight=1, uniform="cap")
        self.quality = self._option(cap, 0, "Qualidade da gravação", list(QUALITY_PRESETS))
        self.min_disk = self._option(cap, 1, "Espaço livre mínimo", list(DISK_OPTIONS))
        self.retention = self._option(cap, 2, "Manter gravações por", list(RETENTION_OPTIONS))
        muted(det, "A gravação copia o vídeo sem recodificar (quase não usa CPU). Trechos com momentos "
                   "pendentes ou aprovados nunca são apagados pela retenção.", wraplength=760).grid(
            row=self._next(det), column=0, sticky="w", padx=20, pady=(6, 0))

        score_row = ctk.CTkFrame(det, fg_color="transparent")
        score_row.grid_columnconfigure(0, weight=1)
        self.min_score_label = label(score_row, "", font=(t.FONT_FAMILY, 13, "bold"), color=t.ACCENT, width=50)
        self.min_score = ctk.CTkSlider(
            score_row, from_=30, to=90, number_of_steps=12, command=self._on_min_score,
            progress_color=t.ACCENT, button_color=t.ACCENT, button_hover_color=t.ACCENT_HOVER, fg_color=t.BORDER)
        self.min_score.grid(row=0, column=0, sticky="ew")
        self.min_score_label.grid(row=0, column=1, padx=(12, 0))
        self._field(det, "Nota mínima de um momento", score_row,
                    "Notas de 0 a 100 combinam volume acima do normal, explosões de intensidade, gritos, "
                    "presença de voz e (com transcrição) palavras de empolgação e risadas.")

        sel = ctk.CTkFrame(det, fg_color="transparent")
        sel.grid(row=self._next(det), column=0, sticky="ew", padx=20, pady=(14, 0))
        for i in range(2):
            sel.grid_columnconfigure(i, weight=1, uniform="sel")
        self.per_hour = self._option(sel, 0, "Máximo de momentos", list(PER_HOUR_OPTIONS))
        self.gap = self._option(sel, 1, "Folga mínima entre momentos", list(GAP_OPTIONS))
        muted(det, "Momentos nunca se sobrepõem: se dois trechos colidem, fica o de maior nota.",
              wraplength=760).grid(row=self._next(det), column=0, sticky="w", padx=20, pady=(6, 0))

        self.transcribe = Switch(det, "Transcrever os momentos localmente (Whisper) para refinar a nota")
        self.transcribe.grid(row=self._next(det), column=0, sticky="w", padx=20, pady=(16, 0))
        self.keywords = Entry(det, "ex.: bordão do canal, nome do mascote, grito de vitória")
        self._field(det, "Palavras-chave extras", self.keywords,
                    "Separe por vírgulas. Somam pontos quando aparecem na transcrição, além do vocabulário padrão.")
        ctk.CTkFrame(det, fg_color="transparent", height=18).grid(row=self._next(det), column=0)

        # ---- Vídeo
        vid = self._section(scroll, 4, "Vídeos verticais",
                            "Clipes 1080x1920 (9:16) para TikTok, Reels e Shorts, salvos em <pasta de saída>/pending.")
        self.auto_render = Switch(vid, "Gerar o vídeo automaticamente para cada momento acima da nota mínima")
        self.auto_render.grid(row=self._next(vid), column=0, sticky="w", padx=20, pady=(14, 0))
        vgrid = ctk.CTkFrame(vid, fg_color="transparent")
        vgrid.grid(row=self._next(vid), column=0, sticky="ew", padx=20, pady=(14, 0))
        for i in range(3):
            vgrid.grid_columnconfigure(i, weight=1, uniform="vid")
        self.layout = self._option(vgrid, 0, "Enquadramento", list(LAYOUT_OPTIONS))
        self.encode = self._option(vgrid, 1, "Qualidade do vídeo", list(QUALITY_OPTIONS))
        self.fps = self._option(vgrid, 2, "Quadros por segundo", list(FPS_OPTIONS))
        self.burn_subs = Switch(vid, "Legendas em português sincronizadas palavra por palavra")
        self.burn_subs.grid(row=self._next(vid), column=0, sticky="w", padx=20, pady=(16, 0))
        self.upper_subs = Switch(vid, "Legendas em LETRAS MAIÚSCULAS")
        self.upper_subs.grid(row=self._next(vid), column=0, sticky="w", padx=20, pady=(10, 0))
        muted(vid, "As legendas dependem da transcrição local. Um arquivo .srt também é salvo ao lado de "
                   "cada vídeo. Renderizar usa bastante CPU: com 1 processamento por vez, um clipe de 45 s "
                   "leva cerca de 1 minuto no i3-10100F.", wraplength=760).grid(
            row=self._next(vid), column=0, sticky="w", padx=20, pady=(8, 18))

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

    @staticmethod
    def _menu(parent, values: list[str]) -> ctk.CTkOptionMenu:
        return ctk.CTkOptionMenu(
            parent, values=values, width=320, fg_color=t.SECONDARY, button_color=t.BORDER,
            button_hover_color=t.CARD_HOVER, dropdown_fg_color=t.CARD, dropdown_hover_color=t.CARD_HOVER,
            text_color=t.TEXT, height=36, corner_radius=10, font=t.FONT_BODY,
        )

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

    def _on_min_score(self, value: float) -> None:
        self.min_score_label.configure(text=str(int(value)))

    @staticmethod
    def _label_for(options: dict, value, fallback: str) -> str:
        return next((k for k, v in options.items() if v == value), fallback)

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
        grace_labels = {v: k for k, v in GRACE_OPTIONS.items()}
        self.grace.set(grace_labels.get(s.offline_grace_checks, f"{s.offline_grace_checks} verificações seguidas"))
        self._set_entry(self.output_dir, s.output_dir)
        self.whisper.set(s.whisper_model)
        self.clip_len.set(str(s.clip_duration_seconds))
        self.jobs.set(str(s.max_parallel_jobs))
        self.captures.set(str(s.max_concurrent_captures))
        self.auto_capture.select() if s.auto_capture else self.auto_capture.deselect()
        self.quality.set(self._label_for(QUALITY_PRESETS, s.capture_quality, s.capture_quality))
        self.min_disk.set(self._label_for(DISK_OPTIONS, s.min_free_disk_gb, f"{s.min_free_disk_gb} GB"))
        self.retention.set(self._label_for(RETENTION_OPTIONS, s.recording_retention_hours,
                                           f"{s.recording_retention_hours} horas"))
        self.min_score.set(s.min_moment_score)
        self._on_min_score(s.min_moment_score)
        self.per_hour.set(self._label_for(PER_HOUR_OPTIONS, s.max_moments_per_hour, f"{s.max_moments_per_hour} por hora"))
        self.gap.set(self._label_for(GAP_OPTIONS, s.min_gap_between_moments, f"{s.min_gap_between_moments} s"))
        self.transcribe.select() if s.transcribe_moments else self.transcribe.deselect()
        self._set_entry(self.keywords, s.custom_keywords)
        self.auto_render.select() if s.auto_render else self.auto_render.deselect()
        self.layout.set(LAYOUTS.get(s.clip_layout, LAYOUTS["blur"]))
        self.encode.set(ENCODE_PRESETS.get(s.video_quality, ENCODE_PRESETS["equilibrado"])[2])
        self.fps.set(self._label_for(FPS_OPTIONS, s.clip_fps, "30 fps (recomendado)"))
        self.burn_subs.select() if s.burn_subtitles else self.burn_subs.deselect()
        self.upper_subs.select() if s.subtitle_uppercase else self.upper_subs.deselect()

    def _collect(self):
        current = self.ctx.settings_repo.load()
        return replace(
            current,
            twitch_client_id=self.client_id.get(),
            twitch_client_secret=self.client_secret.get(),
            poll_interval_seconds=int(self.interval.get()),
            start_monitoring_on_launch=bool(self.autostart.get()),
            offline_grace_checks=GRACE_OPTIONS.get(self.grace.get(), current.offline_grace_checks),
            output_dir=self.output_dir.get(),
            whisper_model=self.whisper.get(),
            clip_duration_seconds=int(self.clip_len.get()),
            max_parallel_jobs=int(self.jobs.get()),
            max_concurrent_captures=int(self.captures.get()),
            auto_capture=bool(self.auto_capture.get()),
            capture_quality=QUALITY_PRESETS.get(self.quality.get(), current.capture_quality),
            min_free_disk_gb=DISK_OPTIONS.get(self.min_disk.get(), current.min_free_disk_gb),
            recording_retention_hours=RETENTION_OPTIONS.get(self.retention.get(), current.recording_retention_hours),
            min_moment_score=int(self.min_score.get()),
            max_moments_per_hour=PER_HOUR_OPTIONS.get(self.per_hour.get(), current.max_moments_per_hour),
            min_gap_between_moments=GAP_OPTIONS.get(self.gap.get(), current.min_gap_between_moments),
            transcribe_moments=bool(self.transcribe.get()),
            custom_keywords=self.keywords.get(),
            auto_render=bool(self.auto_render.get()),
            clip_layout=LAYOUT_OPTIONS.get(self.layout.get(), current.clip_layout),
            video_quality=QUALITY_OPTIONS.get(self.encode.get(), current.video_quality),
            clip_fps=FPS_OPTIONS.get(self.fps.get(), current.clip_fps),
            burn_subtitles=bool(self.burn_subs.get()),
            subtitle_uppercase=bool(self.upper_subs.get()),
        )

    def save(self) -> None:
        try:
            saved = self.ctx.settings_repo.save(self._collect())
            ensure_directories(saved.output_dir)
        except (OSError, ValueError) as exc:
            self.app.toast(f"Não foi possível salvar: {exc}", "error")
            return
        self.ctx.twitch.reset()
        self.ctx.monitor.trigger_now()  # aplica o novo intervalo imediatamente
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
