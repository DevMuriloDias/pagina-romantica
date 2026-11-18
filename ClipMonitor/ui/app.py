"""Janela principal do ClipMonitor."""
from __future__ import annotations

import logging

import customtkinter as ctk

from config import theme as t
from config.settings import APP_NAME, APP_VERSION
from models.events import StreamEvent, StreamEventType
from models.live_status import LiveCheckResult
from models.status import MonitorState, MonitorStatus, PipelineStatus
from services.container import AppContext
from ui.components.widgets import STATE_COLORS, Toast, label, muted
from ui.views.dashboard import DashboardView
from ui.views.library import LibraryView
from ui.views.moments import MomentsView
from ui.views.queue import QueueView
from ui.views.settings import SettingsView
from ui.views.streamers import StreamersView
from utils.errors import friendly, install_global_handlers
from utils.timeutils import format_countdown, utcnow
from workers.task_runner import TaskRunner, UiDispatcher

log = logging.getLogger(__name__)

NAV = [
    ("dashboard", "◉   Painel"),
    ("streamers", "◎   Streamers"),
    ("moments", "★   Momentos"),
    ("queue", "≡   Fila e capturas"),
    ("library", "▣   Biblioteca"),
    ("settings", "⚙   Configurações"),
]


class ClipMonitorApp(ctk.CTk):
    def __init__(self, ctx: AppContext, start_minimized: bool = False, allow_auto_monitor: bool = True):
        ctk.set_appearance_mode("dark")
        super().__init__(fg_color=t.BG)
        self.ctx = ctx
        self.dispatcher = UiDispatcher()
        self.runner = TaskRunner(self.dispatcher)
        self._checking = False
        self._refresh_scheduled = False
        self.pipeline = PipelineStatus()

        self.title(APP_NAME)
        self.geometry("1280x800")
        self.minsize(1000, 660)
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
            "moments": MomentsView(self.content, self),
            "queue": QueueView(self.content, self),
            "library": LibraryView(self.content, self),
            "settings": SettingsView(self.content, self),
        }
        self.current: str | None = None

        # Workers rodam em outras threads: só postam mensagens para a fila da UI.
        ctx.monitor.on_status = lambda st: self.dispatcher.post(self._on_monitor_status, st)
        ctx.monitor.on_result = lambda r: self.dispatcher.post(self._on_monitor_result, r)
        ctx.jobs.on_change = lambda: self.dispatcher.post(self.request_refresh)
        self._unsubscribe = ctx.bus.subscribe(
            lambda e: self.dispatcher.post(self._on_stream_event, e),
            StreamEventType.ONLINE, StreamEventType.OFFLINE,
        )

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        # Erros inesperados (UI e threads): registro completo no log + aviso curto na tela.
        install_global_handlers(lambda exc: self.dispatcher.post(self._report_error, exc))
        self.show("dashboard")
        self._pump()
        self._tick_fast()
        self._tick_slow()

        recovered = ctx.capture.recover()
        if recovered:
            ctx.activity_repo.add(f"{recovered} gravação(ões) interrompida(s) pelo fechamento do app.", "warn")
        ctx.jobs.start()
        self.refresh_tools()
        self._maintenance()
        settings = ctx.settings_repo.load()
        if allow_auto_monitor and settings.start_monitoring_on_launch and settings.has_twitch_credentials():
            ctx.monitor.start()
        self._on_monitor_status(ctx.monitor.status)
        if start_minimized or settings.start_minimized:
            # Antes do mainloop: o CTk registra o pedido e não exibe a janela "normal" primeiro.
            self.iconify()
        if not ctx.db.integrity_ok():
            self.toast("O banco de dados apresentou problemas de integridade. Veja Configurações → Diagnóstico.", "error")

    # ------------------------------------------------------------ layout
    def _build_sidebar(self) -> None:
        side = ctk.CTkFrame(self, fg_color=t.SECONDARY, corner_radius=0, width=256)
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
        self.queue_badge = ctk.CTkLabel(side, text="", fg_color=t.ACCENT, text_color=t.ACCENT_TEXT,
                                        corner_radius=8, font=(t.FONT_FAMILY, 10, "bold"), height=20)

        status = ctk.CTkFrame(side, fg_color=t.CARD, corner_radius=12, border_width=1, border_color=t.BORDER)
        status.grid(row=len(NAV) + 3, column=0, sticky="ew", padx=14, pady=18)
        status.grid_columnconfigure(1, weight=1)
        self.status_dot = ctk.CTkLabel(status, text="●", font=(t.FONT_FAMILY, 14), text_color=t.TEXT_DIM)
        self.status_dot.grid(row=0, column=0, padx=(14, 6), pady=(14, 0))
        self.status_text = label(status, "Monitoramento parado", font=(t.FONT_FAMILY, 12, "bold"))
        self.status_text.grid(row=0, column=1, sticky="w", pady=(14, 0))
        self.status_detail = muted(status, "", font=(t.FONT_FAMILY, 10), wraplength=200)
        self.status_detail.grid(row=1, column=0, columnspan=2, sticky="w", padx=14, pady=(2, 0))

        ind = ctk.CTkFrame(status, fg_color=t.SECONDARY, corner_radius=8)
        ind.grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=(10, 0))
        ind.grid_columnconfigure(1, weight=1)
        self.ind_capture = self._indicator(ind, 0, "Captura")
        self.ind_processing = self._indicator(ind, 1, "Processamento")

        self.monitor_btn = ctk.CTkButton(
            status, text="Iniciar monitoramento", height=36, corner_radius=10, fg_color=t.ACCENT,
            hover_color=t.ACCENT_HOVER, text_color=t.ACCENT_TEXT, font=(t.FONT_FAMILY, 12, "bold"),
            command=self.toggle_monitoring,
        )
        self.monitor_btn.grid(row=3, column=0, columnspan=2, sticky="ew", padx=14, pady=14)

    @staticmethod
    def _indicator(parent, row: int, title: str) -> tuple[ctk.CTkLabel, ctk.CTkLabel]:
        dot = ctk.CTkLabel(parent, text="●", font=(t.FONT_FAMILY, 10), text_color=t.TEXT_DIM, width=12)
        dot.grid(row=row, column=0, padx=(10, 6), pady=(6 if row == 0 else 0, 6))
        label(parent, title, font=(t.FONT_FAMILY, 11)).grid(row=row, column=1, sticky="w", pady=(6 if row == 0 else 0, 6))
        value = muted(parent, "ociosa", font=(t.FONT_FAMILY, 10))
        value.grid(row=row, column=2, sticky="e", padx=10, pady=(6 if row == 0 else 0, 6))
        return dot, value

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
        self.pipeline = self.ctx.status.pipeline()
        self._update_indicators()
        if self.current and self.current != "settings":
            self.views[self.current].refresh()

    def request_refresh(self) -> None:
        """Agrupa várias notificações (ex.: progresso de tarefas) em um só redesenho."""
        if self._refresh_scheduled:
            return
        self._refresh_scheduled = True

        def run():
            self._refresh_scheduled = False
            self.refresh_current()

        self.after(400, run)

    def toast(self, message: str, kind: str = "info") -> None:
        Toast(self, message, kind)

    def refresh_tools(self, notify: bool = False) -> None:
        def done(_tools) -> None:
            self.request_refresh()
            if notify:
                self.toast("Ferramentas verificadas.", "info")

        self.runner.submit(self.ctx.tools.refresh, on_success=done)

    # ------------------------------------------------------------ monitor
    def toggle_monitoring(self) -> None:
        if self.ctx.monitor.running:
            self.monitor_btn.configure(state="disabled")
            self.runner.submit(self.ctx.monitor.stop)
            return
        if not self.ctx.settings_repo.load().has_twitch_credentials():
            self.toast("Configure as credenciais da Twitch antes de iniciar.", "warn")
            self.show("settings")
            return
        if self.ctx.streamer_repo.counts()["monitored"] == 0:
            self.toast("Nenhum streamer autorizado com monitoramento ativo.", "warn")
        self.ctx.monitor.start()

    def check_now(self) -> None:
        if self.ctx.monitor.running:
            self.ctx.monitor.trigger_now(force=True)
            return
        if self._checking:
            return
        self._checking = True
        self.status_detail.configure(text="Verificando agora…", text_color=t.TEXT_MUTED)

        def done(result: LiveCheckResult) -> None:
            self._checking = False
            self._on_monitor_result(result)

        def fail(exc: BaseException) -> None:
            self._checking = False
            self._on_monitor_result(LiveCheckResult(0, 0, error=str(exc)))

        self.runner.submit(self.ctx.monitor.check_now, done, fail)

    def _on_monitor_status(self, st: MonitorStatus) -> None:
        color = STATE_COLORS[st.state.value]
        self.status_dot.configure(text_color=color)
        self.status_text.configure(text=st.state.label)
        if st.running:
            self.monitor_btn.configure(text="Parar monitoramento", fg_color="transparent", border_width=1,
                                       border_color=t.BORDER, text_color=t.TEXT, hover_color=t.CARD_HOVER,
                                       state="normal")
        else:
            self.monitor_btn.configure(text="Iniciar monitoramento", fg_color=t.ACCENT, border_width=0,
                                       text_color=t.ACCENT_TEXT, hover_color=t.ACCENT_HOVER, state="normal")
        self._update_status_detail()

    def _update_status_detail(self) -> None:
        if self._checking:
            return
        st = self.ctx.monitor.status
        if st.state in (MonitorState.ERROR, MonitorState.BACKOFF) and st.last_error:
            text, color = st.last_error, STATE_COLORS[st.state.value]
            if st.next_check_at:
                text += f"\nNova tentativa em {format_countdown((st.next_check_at - utcnow()).total_seconds())}"
        elif st.state is MonitorState.CHECKING:
            text, color = "Consultando a Twitch…", t.TEXT_MUTED
        elif st.running and st.next_check_at:
            remaining = (st.next_check_at - utcnow()).total_seconds()
            text = f"{st.last_live} ao vivo · próxima em {format_countdown(remaining)}"
            color = t.TEXT_MUTED
        elif st.last_error:
            text, color = st.last_error, t.DANGER
        else:
            text, color = "", t.TEXT_MUTED
        self.status_detail.configure(text=text, text_color=color)

    def _update_indicators(self) -> None:
        p = self.pipeline
        cap_dot, cap_val = self.ind_capture
        if p.capture_running:
            cap_dot.configure(text_color=t.LIVE)
            cap_val.configure(text=f"{p.capture_running} gravando")
        elif p.capture_queued:
            cap_dot.configure(text_color=t.WARNING)
            cap_val.configure(text=f"{p.capture_queued} na fila")
        else:
            cap_dot.configure(text_color=t.TEXT_DIM)
            cap_val.configure(text="ociosa")
        proc_dot, proc_val = self.ind_processing
        if p.processing_running:
            proc_dot.configure(text_color=t.ACCENT)
            extra = f" +{p.processing_queued}" if p.processing_queued else ""
            proc_val.configure(text=f"{p.processing_running} ativa{extra}")
        elif p.processing_queued:
            proc_dot.configure(text_color=t.WARNING)
            proc_val.configure(text=f"{p.processing_queued} na fila")
        elif p.failed:
            proc_dot.configure(text_color=t.DANGER)
            proc_val.configure(text=f"{p.failed} com falha")
        else:
            proc_dot.configure(text_color=t.TEXT_DIM)
            proc_val.configure(text="ociosa")
        active = p.capture_running + p.capture_queued + p.processing_running + p.processing_queued
        btn = self.nav_buttons["queue"]
        if active:
            self.queue_badge.configure(text=f" {active} ")
            self.queue_badge.place(in_=btn, relx=1.0, rely=0.5, x=-10, anchor="e")
        else:
            self.queue_badge.place_forget()

    def _on_monitor_result(self, r: LiveCheckResult) -> None:
        if r.error and not self.ctx.monitor.running:
            self.status_detail.configure(text=r.error, text_color=t.DANGER)
        if r.error:
            self.ctx.activity_repo.add(r.error, "error")
        self.refresh_current()

    def _on_stream_event(self, e: StreamEvent) -> None:
        if e.type is StreamEventType.ONLINE:
            self.toast(f"🔴 {e.streamer_name} entrou ao vivo!", "success")
        elif e.type is StreamEventType.OFFLINE:
            self.toast(f"{e.streamer_name} encerrou a transmissão.", "info")

    # ------------------------------------------------------------ loop
    def _pump(self) -> None:
        self.dispatcher.pump()
        self.after(80, self._pump)

    def _tick_fast(self) -> None:
        # Contagem regressiva da próxima verificação (sem IO).
        self._update_status_detail()
        if self.current in ("dashboard", "streamers", "queue", "moments"):
            self.views[self.current].tick()
        self.after(1000, self._tick_fast)

    def _tick_slow(self) -> None:
        # Atualiza textos relativos ("há 2 min") e indicadores sem consultar a Twitch.
        self.refresh_current()
        self.after(30_000, self._tick_slow)

    def report_callback_exception(self, exc_type, exc, tb) -> None:  # chamado pelo Tk
        log.error("Erro na interface", exc_info=(exc_type, exc, tb))
        self._report_error(exc)

    def _report_error(self, exc: BaseException) -> None:
        try:
            self.toast(f"Erro inesperado: {friendly(exc)} (detalhes em Configurações → Diagnóstico)", "error")
        except Exception:  # noqa: BLE001 - janela já fechando
            pass

    def _maintenance(self) -> None:
        """Retenção de gravações: a cada hora, em segundo plano."""
        self.runner.submit(self.ctx.capture.purge_expired)
        self.after(3_600_000, self._maintenance)

    def start_capture(self, streamer_id: int) -> None:
        try:
            self.ctx.capture.enqueue(streamer_id)
            self.toast("Gravação adicionada à fila.", "success")
        except ValueError as exc:
            self.toast(str(exc), "error")
        except RuntimeError as exc:
            self.toast(str(exc), "error")
        self.refresh_current()

    def stop_capture(self, streamer_id: int) -> None:
        job = self.ctx.job_repo.active_by_streamer().get(streamer_id)
        if job and job.job_type.is_capture and self.ctx.jobs.cancel(job.id):
            self.toast("Encerrando gravação… os segmentos gravados serão analisados.", "info")
        self.refresh_current()

    def _on_close(self) -> None:
        p = self.ctx.status.pipeline()
        if p.capture_running or p.processing_running:
            from ui.components.widgets import confirm

            parts = []
            if p.capture_running:
                parts.append(f"{p.capture_running} gravação(ões) em andamento serão encerradas (o que já foi "
                             "gravado será analisado na próxima abertura).")
            if p.processing_running:
                parts.append("O processamento em andamento será interrompido e poderá ser retomado depois.")
            if not confirm(self, "Fechar o ClipMonitor?", " ".join(parts), "Fechar mesmo assim", danger=True):
                return
        log.info("Encerrando aplicação")
        self._unsubscribe()
        self.runner.shutdown()
        self.ctx.monitor.on_status = lambda st: None
        self.ctx.monitor.on_result = lambda r: None
        self.ctx.jobs.on_change = lambda: None
        self.ctx.close()
        self.destroy()
