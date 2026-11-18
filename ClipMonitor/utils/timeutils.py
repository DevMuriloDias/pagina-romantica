"""Datas em UTC (ISO 8601) e formatação amigável em pt-BR."""
from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def from_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def format_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes = rem // 60
    if hours:
        return f"{hours}h {minutes:02d}min"
    return f"{minutes}min"


def format_relative(dt: datetime | None, now: datetime | None = None) -> str:
    if dt is None:
        return "nunca"
    now = now or utcnow()
    delta = (now - dt).total_seconds()
    if delta < 10:
        return "agora mesmo"
    if delta < 60:
        return f"há {int(delta)} s"
    if delta < 3600:
        return f"há {int(delta // 60)} min"
    if delta < 86400:
        return f"há {int(delta // 3600)} h"
    return dt.astimezone().strftime("%d/%m/%Y %H:%M")


def format_viewers(count: int | None) -> str:
    if count is None:
        return "—"
    if count >= 1000:
        return f"{count / 1000:.1f} mil".replace(".", ",")
    return str(count)
