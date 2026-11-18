"""Verificação de status ao vivo de todos os streamers monitorados."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Callable

from database.repositories import ActivityRepository, LiveSessionRepository, StreamerRepository
from models.live_status import LiveCheckResult
from twitch.client import HelixClient
from utils.timeutils import utcnow

log = logging.getLogger(__name__)


class LiveStatusChecker:
    def __init__(
        self,
        streamers: StreamerRepository,
        sessions: LiveSessionRepository,
        activity: ActivityRepository,
        clock: Callable[[], datetime] = utcnow,
    ):
        self.streamers = streamers
        self.sessions = sessions
        self.activity = activity
        self.clock = clock

    def check(self, helix: HelixClient) -> LiveCheckResult:
        targets = self.streamers.list_monitorable()
        if not targets:
            return LiveCheckResult(checked=0, live=0)

        # Preenche o user_id/nome de quem ainda não foi verificado na Twitch.
        missing = [s for s in targets if not s.twitch_user_id]
        if missing:
            users = {u.login.lower(): u for u in helix.get_users(s.login for s in missing)}
            for s in missing:
                u = users.get(s.login.lower())
                if u:
                    self.streamers.update_twitch_identity(
                        s.id, u.id, s.display_name or u.display_name, u.profile_image_url
                    )
            targets = self.streamers.list_monitorable()

        live = helix.get_live_streams(s.login for s in targets)
        now = self.clock()
        online, offline = [], []
        for s in targets:
            info = live.get(s.login.lower())
            if info:
                if not s.is_live or s.stream_id != info.stream_id:
                    online.append(s.name)
                    self.sessions.open_session(s.id, info)
                    self.activity.add(
                        f"{s.name} entrou ao vivo: {info.title or 'sem título'}", "live", s.id
                    )
                else:
                    self.sessions.touch(s.id, info)
                self.streamers.set_live(s.id, info, now)
            else:
                if s.is_live:
                    offline.append(s.name)
                    self.sessions.close_open_sessions(s.id, now)
                    self.activity.add(f"{s.name} encerrou a transmissão.", "info", s.id)
                self.streamers.set_offline(s.id, now)

        log.info("Verificação concluída: %d canais, %d ao vivo", len(targets), len(live))
        return LiveCheckResult(
            checked=len(targets), live=len(live),
            went_online=tuple(online), went_offline=tuple(offline),
        )
