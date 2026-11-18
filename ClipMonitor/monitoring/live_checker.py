"""Uma rodada de verificação de status ao vivo.

Cada streamer tem seu próprio vencimento (``last_checked_at`` + intervalo próprio
ou global). A cada rodada consultamos, em lote, apenas quem venceu — mais quem
vence nos próximos segundos (janela de agrupamento), para não fragmentar as
requisições à Helix.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Callable

from database.repositories import (
    ActivityRepository, LiveSessionRepository, StreamEventRepository, StreamerRepository,
)
from models.events import StreamEventType
from models.live_status import LiveCheckResult
from models.streamer import Streamer
from monitoring.events import EventBus
from monitoring.stream_tracker import observe
from twitch.client import HelixClient
from utils.timeutils import utcnow

log = logging.getLogger(__name__)

COALESCE_WINDOW = timedelta(seconds=10)


class LiveStatusChecker:
    def __init__(
        self,
        streamers: StreamerRepository,
        sessions: LiveSessionRepository,
        activity: ActivityRepository,
        events: StreamEventRepository,
        bus: EventBus | None = None,
        default_interval: Callable[[], int] = lambda: 60,
        grace_checks: Callable[[], int] = lambda: 2,
        clock: Callable[[], datetime] = utcnow,
    ):
        self.streamers = streamers
        self.sessions = sessions
        self.activity = activity
        self.events = events
        self.bus = bus or EventBus()
        self.default_interval = default_interval
        self.grace_checks = grace_checks
        self.clock = clock

    # ------------------------------------------------------------ agendamento
    def interval_for(self, s: Streamer, default: int | None = None) -> int:
        return s.check_interval_seconds or default or self.default_interval()

    def due_at(self, s: Streamer, default: int | None = None) -> datetime | None:
        """Momento da próxima verificação (``None`` = imediatamente)."""
        if s.last_checked_at is None:
            return None
        return s.last_checked_at + timedelta(seconds=self.interval_for(s, default))

    def next_due(self, now: datetime | None = None) -> datetime | None:
        """Próximo vencimento entre os streamers monitorados (``None`` se não há nenhum)."""
        now = now or self.clock()
        targets = self.streamers.list_monitorable()
        if not targets:
            return None
        default = self.default_interval()
        return min((self.due_at(s, default) or now) for s in targets)

    def _due(self, targets: list[Streamer], now: datetime) -> list[Streamer]:
        horizon = now + COALESCE_WINDOW
        default = self.default_interval()
        return [s for s in targets if (self.due_at(s, default) or now) <= horizon]

    # ------------------------------------------------------------ verificação
    def check(self, helix: HelixClient, force: bool = False) -> LiveCheckResult:
        targets = self.streamers.list_monitorable()
        now = self.clock()
        if not force:
            targets = self._due(targets, now)
        if not targets:
            return LiveCheckResult(checked=0, live=self._live_count())

        self._resolve_identities(helix, targets)
        live = helix.get_live_streams(s.login for s in targets)
        now = self.clock()
        grace = self.grace_checks()

        all_events = []
        for s in targets:
            obs = observe(s, live.get(s.login.lower()), now, grace)
            for action in obs.actions:
                if action.kind == "open":
                    self.sessions.open_session(s.id, action.info)
                elif action.kind == "touch":
                    self.sessions.touch(s.id, action.info)
                elif action.kind == "close":
                    self.sessions.close_open_sessions(s.id, action.ended_at)
            self.streamers.save_live_state(obs.state, now)
            all_events.extend(obs.events)

        saved = self.events.add_many(all_events)
        for e in saved:
            if e.type is StreamEventType.ONLINE:
                self.activity.add(f"{e.streamer_name} entrou ao vivo: {e.title or 'sem título'}", "live", e.streamer_id)
            elif e.type is StreamEventType.OFFLINE:
                self.activity.add(f"{e.streamer_name} encerrou a transmissão.", "info", e.streamer_id)
        for e in saved:
            self.bus.publish(e)

        log.info("Verificação: %d canais consultados, %d ao vivo, %d eventos", len(targets), len(live), len(saved))
        return LiveCheckResult(
            checked=len(targets),
            live=self._live_count(),
            went_online=tuple(e.streamer_name for e in saved if e.type is StreamEventType.ONLINE),
            went_offline=tuple(e.streamer_name for e in saved if e.type is StreamEventType.OFFLINE),
            events=tuple(saved),
        )

    def _live_count(self) -> int:
        return self.streamers.counts()["live"]

    def _resolve_identities(self, helix: HelixClient, targets: list[Streamer]) -> None:
        missing = [s for s in targets if not s.twitch_user_id]
        if not missing:
            return
        users = {u.login.lower(): u for u in helix.get_users(s.login for s in missing)}
        for s in missing:
            u = users.get(s.login.lower())
            if u:
                s.display_name = s.display_name or u.display_name
                s.twitch_user_id = u.id
                self.streamers.update_twitch_identity(s.id, u.id, s.display_name, u.profile_image_url)
