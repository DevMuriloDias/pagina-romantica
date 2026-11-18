"""Máquina de estados de uma transmissão (sem IO: fácil de testar).

Regras:
- offline → visto ao vivo                → ONLINE
- ao vivo → mesmo stream_id              → atualiza; TITLE_CHANGED / GAME_CHANGED se mudou
- ao vivo → stream_id diferente          → OFFLINE (antiga) + ONLINE (nova)  [reinício rápido]
- ao vivo → não encontrado               → conta uma "falta"; só após ``grace`` faltas
                                           seguidas emite OFFLINE (a Helix às vezes omite
                                           canais por alguns segundos).
O fim da live é datado pela última vez em que ela foi vista, não pelo momento da
confirmação, para não inflar a duração com o período de tolerância.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime

from models.events import StreamEvent, StreamEventType
from models.live_status import StreamInfo
from models.streamer import Streamer


@dataclass(frozen=True)
class SessionAction:
    kind: str  # "open" | "touch" | "close"
    info: StreamInfo | None = None
    ended_at: datetime | None = None


@dataclass(frozen=True)
class Observation:
    state: Streamer
    events: list[StreamEvent] = field(default_factory=list)
    actions: list[SessionAction] = field(default_factory=list)


def _event(kind: StreamEventType, s: Streamer, now: datetime, info: StreamInfo | None = None) -> StreamEvent:
    if info is not None:
        return StreamEvent(kind, s.id, s.name, now, info.stream_id, info.title, info.game_name,
                           info.viewer_count, info.started_at)
    return StreamEvent(kind, s.id, s.name, now, s.stream_id, s.stream_title or "", s.game_name or "",
                       s.viewer_count, s.live_since)


def _went_live(s: Streamer, info: StreamInfo, now: datetime) -> Streamer:
    return replace(
        s, is_live=True, stream_id=info.stream_id, stream_title=info.title, game_name=info.game_name,
        viewer_count=info.viewer_count, live_since=info.started_at or now, last_seen_live_at=now,
        offline_misses=0, last_checked_at=now,
    )


def _went_offline(s: Streamer, now: datetime) -> Streamer:
    return replace(
        s, is_live=False, stream_id=None, stream_title=None, game_name=None, viewer_count=None,
        live_since=None, offline_misses=0, last_checked_at=now,
    )


def observe(s: Streamer, info: StreamInfo | None, now: datetime, grace: int = 2) -> Observation:
    grace = max(1, grace)
    if info is not None:
        if not s.is_live:
            return Observation(
                _went_live(s, info, now),
                [_event(StreamEventType.ONLINE, s, now, info)],
                [SessionAction("open", info)],
            )
        if s.stream_id and s.stream_id != info.stream_id:
            ended = s.last_seen_live_at or now
            return Observation(
                _went_live(s, info, now),
                [_event(StreamEventType.OFFLINE, s, now), _event(StreamEventType.ONLINE, s, now, info)],
                [SessionAction("close", ended_at=ended), SessionAction("open", info)],
            )
        events = []
        if s.stream_title is not None and info.title != s.stream_title:
            events.append(_event(StreamEventType.TITLE_CHANGED, s, now, info))
        if s.game_name is not None and info.game_name != s.game_name:
            events.append(_event(StreamEventType.GAME_CHANGED, s, now, info))
        state = replace(
            s, stream_id=info.stream_id, stream_title=info.title, game_name=info.game_name,
            viewer_count=info.viewer_count, live_since=s.live_since or info.started_at or now,
            last_seen_live_at=now, offline_misses=0, last_checked_at=now,
        )
        return Observation(state, events, [SessionAction("touch", info)])

    if not s.is_live:
        return Observation(replace(s, offline_misses=0, last_checked_at=now))

    misses = s.offline_misses + 1
    if misses < grace:
        return Observation(replace(s, offline_misses=misses, last_checked_at=now))
    ended = s.last_seen_live_at or now
    return Observation(
        _went_offline(s, now),
        [_event(StreamEventType.OFFLINE, s, now)],
        [SessionAction("close", ended_at=ended)],
    )
