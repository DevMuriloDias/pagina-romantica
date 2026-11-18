"""Janela principal do ClipMonitor."""
from __future__ import annotations

import logging

import customtkinter as ctk

from config import theme as t
from config.settings import APP_NAME, APP_VERSION
from models.live_status import LiveCheckResult
from services.container import AppContext
from ui.components.widgets import Toast, label, muted
from ui.views.dashboard import DashboardView
from ui.views.placeholder import PlaceholderView
from ui.views.settings import SettingsView
from ui.views.streamers import StreamersView
from workers.task_runner import TaskRunner, UiDispatcher

log = logging.getLogger(__name__)

NAV = [
    ("dashboard", "◉   Painel"),
    ("streamers", "◎   Streamers"),
    ("library", "▣   Biblioteca"),
    ("queue", "≡   Fila de processamento"),
    ("settings", "⚙   Configurações"),
]


class ClipMonitorApp(ctk.CTk):
    def __init__(self, ctx: AppContext):
        ctk.set_appearance_mode("dark")
        super().__init__(fg_color=t.BG)
        self.ctx = ctx
        self.dispatcher = UiDispatcher()
        self.runner = TaskRunner(self.dispatcher)
        self._checking = False

        self.title(f"{APP_NAME}")
        self.geometry("1280x800")
        self.minsize(980, 640)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self.content = ctk.CTkFrame(self, fg_color=t.BG, corner_radius=0)
        self.content.grid(row=0, column=1, sticky="nsew", padx=28, pady=24)
        self.content.grid_columnconfigure(0, weight=1)
        self.content.grid_rowconfigure(0, weight=1)

        self.views = {
            "dashboard": DashboardView(self.content, self),
            "streamers": StreamersView(self.content, self),
            "library": PlaceholderView(
                self.content, self, "Biblioteca", "Seus clipes gerados, prontos para revisar e publicar.",
                "Fase 4", "Clipes verticais 9:16 com legendas em português aparecerão aqui para aprovação.",
            ),
            "queue": PlaceholderView(
                self.content, self, "Fila de processamento", "Capturas, transcrições e renderizações em andamento.",
                "Fase 2", "A fila mostrará o progresso de cada etapa: captura, análise, transcrição e exportação.",
            ),
            "settings": SettingsView(self.content, self),
        }
        self.current: str | None = None

        # O monitor roda em outra thread: só posta mensagens para a fila da UI.
        ctx.monitor.on_result = lambda r: self.dispatcher.post(self._on_monitor_result, r)
        ctx.monitor.on_state = lambda running: self.dispatcher.post(self._on_monitor_state, running)

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.show("dashboard")
        self._pump()
        self._tick()

        settings = ctx.settings_repo.load()
        if settings.start_monitoring_on_launch and settings.has_twitch_credentials():
            ctx.monitor.start()
        self._on_monitor_state(ctx.monitor.running)

    # ------------------------------------------------------------ layout
    def _build_sidebar(self) -> None:
        side = ctk.CTkFrame(self, fg_color=t.SECONDARY, corner_radius=0, width=250)
        side.grid(row=0, column=0, sticky="nsw")
        side.grid_propagate(False)
        side.grid_columnconfigure(0, weight=1)
        side.grid_rowconfigure(len(NAV) + 2, weight=1)

        brand = ctk.CTkFrame(side, fg_color="transparent")
        brand.grid(row=0, column=0, sticky="ew", padx=22, pady=(26, 28))
        ctk.CTkLabel(brand, text="▶", font=(t.FONT_FAMILY, 18, "bold"), text_color=t.ACCENT_TEXT,
                     fg_color=t.ACCENT, corner_radius=8, width=34, height=34).pack(side="left")
        names = ctk.CTkFrame(brand, fg_color="transparent")
        names.pack(side="left", padx=10)
        label(names, "ClipMonitor", font=(t.FONT_FAMILY, 17, "bold")).pack(anchor="w")
        muted(names, f"v{APP_VERSION} · uso pessoal", font=(t.FONT_FAMILY, 10)).pack(anchor="w")

        self.nav_buttons: dict[str, ctk.CTkButton] = {}
        for i, (key, text) in enumerate(NAV, start=1):
            btn = ctk.CTkButton(
                side, text=text, anchor="w", height=42, corner_radius=10, fg_color="transparent",
                hover_color=t.CARD, text_color=t.TEXT_MUTED, font=(t.FONT_FAMILY, 13),
                command=lambda k=key: self.show(k),
            )
            btn.grid(row=i, column=0, sticky="ew", padx=14, pady=2)
            self.nav_buttons[key] = btn

        status = ctk.CTkFrame(side, fg_color=t.CARD, corner_radius=12, border_width=1, border_color=t.BORDER)
        status.grid(row=len(NAV) + 3, column=0, sticky="ew", padx=14, pady=18)
        status.grid_columnconfigure(1, weight=1)
        self.status_dot = ctk.CTkLabel(status, text="●", font=(t.FONT_FAMILY, 14), text_color=t.TEXT_DIM)
        self.status_dot.grid(row=0, column=0, padx=(14, 6), pady=(14, 0))
        self.status_text = label(status, "Monitoramento parado", font=(t.FONT_FAMILY, 12, "bold"))
        self.status_text.grid(row=0, column=1, sticky="w", pady=(14, 0))
        self.status_detail = muted(status, "", font=(t.FONT_FAMILY, 10), wraplength=190)
        self.status_detail.grid(row=1, column=0, columnspan=2, sticky="w", padx=14)
        self.monitor_btn = ctk.CTkButton(
            status, text="Iniciar monitoramento", height=36, corner_radius=10, fg_color=t.ACCENT,
            hover_color=t.ACCENT_HOVER, text_color=t.ACCENT_TEXT, font=(t.FONT_FAMILY, 12, "bold"),
            command=self.toggle_monitoring,
        )
        self.monitor_btn.grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=14)

    def show(self, key: str) -> None:
        if self.current == key:
            self.views[key].refresh()
            return
        if self.current:
            self.views[self.current].grid_forget()
        self.current = key
        self.views[key].grid(row=0, column=0, sticky="nsew")
        self.views[key].on_show()
        for k, btn in self.nav_buttons.items():
            active = k == key
            btn.configure(fg_color=t.CARD if active else "transparent",
                          text_color=t.ACCENT if active else t.TEXT_MUTED)

    def refresh_current(self) -> None:
        if self.current and self.current != "settings":
            self.views[self.current].refresh()

    def toast(self, message: str, kind: str = "info") -> None:
        Toast(self, message, kind)

    # ------------------------------------------------------------ monitor
    def toggle_monitoring(self) -> None:
        if self.ctx.monitor.running:
            self.monitor_btn.configure(state="disabled")
            self.runner.submit(self.ctx.monitor.stop, on_success=lambda _r: self.monitor_btn.configure(state="normal"))
            return
        if not self.ctx.settings_repo.load().has_twitch_credentials():
            self.toast("Configure as credenciais da Twitch antes de iniciar.", "warn")
            self.show("settings")
            return
        if self.ctx.streamer_repo.counts()["monitored"] == 0:
            self.toast("Nenhum streamer autorizado com monitoramento ativo.", "warn")
        self.ctx.monitor.start()

    def check_now(self) -> None:
        if self._checking:
            return
        self._checking = True
        self.status_detail.configure(text="Verificando agora…")

        def done(result: LiveCheckResult) -> None:
            self._checking = False
            self._on_monitor_result(result)

        def fail(exc: BaseException) -> None:
            self._checking = False
            self._on_monitor_result(LiveCheckResult(0, 0, error=str(exc)))

        self.runner.submit(self.ctx.monitor.check_once, done, fail)

    def _on_monitor_state(self, running: bool) -> None:
        if running:
            self.status_dot.configure(text_color=t.ACCENT)
            self.status_text.configure(text="Monitorando")
            self.monitor_btn.configure(text="Parar monitoramento", fg_color="transparent", border_width=1,
                                       border_color=t.BORDER, text_color=t.TEXT, hover_color=t.CARD_HOVER,
                                       state="normal")
        else:
            self.status_dot.configure(text_color=t.TEXT_DIM)
            self.status_text.configure(text="Monitoramento parado")
            self.monitor_btn.configure(text="Iniciar monitoramento", fg_color=t.ACCENT, border_width=0,
                                       text_color=t.ACCENT_TEXT, hover_color=t.ACCENT_HOVER, state="normal")

    def _on_monitor_result(self, r: LiveCheckResult) -> None:
        if r.error:
            self.status_detail.configure(text=r.error, text_color=t.DANGER)
            self.ctx.activity_repo.add(r.error, "error")
        else:
            interval = self.ctx.settings_repo.load().poll_interval_seconds
            suffix = f" · a cada {interval} s" if self.ctx.monitor.running else ""
            self.status_detail.configure(text=f"{r.live} de {r.checked} ao vivo{suffix}", text_color=t.TEXT_MUTED)
            for name in r.went_online:
                self.toast(f"🔴 {name} entrou ao vivo!", "success")
        self.refresh_current()

    # ------------------------------------------------------------ loop
    def _pump(self) -> None:
        self.dispatcher.pump()
        self.after(80, self._pump)

    def _tick(self) -> None:
        # Atualiza textos relativos ("há 2 min") sem consultar a Twitch.
        if self.current == "dashboard":
            self.views["dashboard"].refresh()
        self.after(30_000, self._tick)

    def _on_close(self) -> None:
        log.info("Encerrando aplicação")
        self.runner.shutdown()
        self.ctx.monitor.on_result = lambda r: None
        self.ctx.monitor.on_state = lambda running: None
        self.ctx.close()
        self.destroy()
