"""Acesso a dados (padrão repositório). Nenhuma lógica de UI aqui."""
from __future__ import annotations

import sqlite3
from dataclasses import fields
from datetime import datetime

from config.settings import AppSettings
from database.connection import Database
from models.live_status import StreamInfo
from models.streamer import LiveSession, Streamer
from utils import secrets
from utils.timeutils import from_iso, to_iso, utcnow


class DuplicateStreamerError(ValueError):
    pass


def _row_to_streamer(row: sqlite3.Row) -> Streamer:
    return Streamer(
        id=row["id"],
        login=row["login"],
        display_name=row["display_name"],
        twitch_user_id=row["twitch_user_id"],
        profile_image_url=row["profile_image_url"],
        authorized=bool(row["authorized"]),
        authorization_note=row["authorization_note"],
        monitoring_enabled=bool(row["monitoring_enabled"]),
        notes=row["notes"],
        is_live=bool(row["is_live"]),
        stream_id=row["stream_id"],
        stream_title=row["stream_title"],
        game_name=row["game_name"],
        viewer_count=row["viewer_count"],
        live_since=from_iso(row["live_since"]),
        last_checked_at=from_iso(row["last_checked_at"]),
        created_at=from_iso(row["created_at"]),
        updated_at=from_iso(row["updated_at"]),
    )


class StreamerRepository:
    def __init__(self, db: Database):
        self.db = db

    def list_all(self) -> list[Streamer]:
        rows = self.db.query(
            "SELECT * FROM streamers ORDER BY is_live DESC, LOWER(COALESCE(NULLIF(display_name,''), login))"
        )
        return [_row_to_streamer(r) for r in rows]

    def list_monitorable(self) -> list[Streamer]:
        rows = self.db.query(
            "SELECT * FROM streamers WHERE authorized = 1 AND monitoring_enabled = 1 ORDER BY login"
        )
        return [_row_to_streamer(r) for r in rows]

    def get(self, streamer_id: int) -> Streamer | None:
        row = self.db.query_one("SELECT * FROM streamers WHERE id = ?", (streamer_id,))
        return _row_to_streamer(row) if row else None

    def get_by_login(self, login: str) -> Streamer | None:
        row = self.db.query_one("SELECT * FROM streamers WHERE login = ?", (login,))
        return _row_to_streamer(row) if row else None

    def add(self, s: Streamer) -> Streamer:
        now = to_iso(utcnow())
        try:
            with self.db.transaction() as tx:
                cur = tx.execute(
                    """INSERT INTO streamers (login, display_name, twitch_user_id, profile_image_url,
                           authorized, authorization_note, monitoring_enabled, notes, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        s.login, s.display_name, s.twitch_user_id, s.profile_image_url,
                        int(s.authorized), s.authorization_note, int(s.monitoring_enabled),
                        s.notes, now, now,
                    ),
                )
                new_id = cur.lastrowid
        except sqlite3.IntegrityError as exc:
            raise DuplicateStreamerError(f"O canal '{s.login}' já está cadastrado.") from exc
        result = self.get(new_id)
        assert result is not None
        return result

    def update(self, s: Streamer) -> Streamer:
        if s.id is None:
            raise ValueError("Streamer sem id")
        try:
            with self.db.transaction() as tx:
                tx.execute(
                    """UPDATE streamers SET login=?, display_name=?, twitch_user_id=?, profile_image_url=?,
                           authorized=?, authorization_note=?, monitoring_enabled=?, notes=?, updated_at=?
                       WHERE id=?""",
                    (
                        s.login, s.display_name, s.twitch_user_id, s.profile_image_url,
                        int(s.authorized), s.authorization_note, int(s.monitoring_enabled),
                        s.notes, to_iso(utcnow()), s.id,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise DuplicateStreamerError(f"O canal '{s.login}' já está cadastrado.") from exc
        result = self.get(s.id)
        assert result is not None
        return result

    def set_monitoring(self, streamer_id: int, enabled: bool) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                "UPDATE streamers SET monitoring_enabled=?, updated_at=? WHERE id=?",
                (int(enabled), to_iso(utcnow()), streamer_id),
            )

    def delete(self, streamer_id: int) -> bool:
        with self.db.transaction() as tx:
            cur = tx.execute("DELETE FROM streamers WHERE id=?", (streamer_id,))
            return cur.rowcount > 0

    def update_twitch_identity(self, streamer_id: int, user_id: str, display_name: str, image: str) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                "UPDATE streamers SET twitch_user_id=?, display_name=?, profile_image_url=?, updated_at=? WHERE id=?",
                (user_id, display_name, image, to_iso(utcnow()), streamer_id),
            )

    def set_live(self, streamer_id: int, info: StreamInfo, checked_at: datetime) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                """UPDATE streamers SET is_live=1, stream_id=?, stream_title=?, game_name=?,
                       viewer_count=?, live_since=?, last_checked_at=? WHERE id=?""",
                (info.stream_id, info.title, info.game_name, info.viewer_count,
                 to_iso(info.started_at), to_iso(checked_at), streamer_id),
            )

    def set_offline(self, streamer_id: int, checked_at: datetime) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                """UPDATE streamers SET is_live=0, stream_id=NULL, stream_title=NULL, game_name=NULL,
                       viewer_count=NULL, live_since=NULL, last_checked_at=? WHERE id=?""",
                (to_iso(checked_at), streamer_id),
            )

    def counts(self) -> dict[str, int]:
        row = self.db.query_one(
            """SELECT COUNT(*) AS total,
                      COALESCE(SUM(is_live), 0) AS live,
                      COALESCE(SUM(authorized = 1 AND monitoring_enabled = 1), 0) AS monitored
               FROM streamers"""
        )
        return {"total": row["total"], "live": row["live"], "monitored": row["monitored"]}


class LiveSessionRepository:
    def __init__(self, db: Database):
        self.db = db

    def open_session(self, streamer_id: int, info: StreamInfo) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                """INSERT INTO live_sessions (streamer_id, stream_id, title, game_name, started_at, peak_viewers)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT (streamer_id, stream_id) DO UPDATE SET
                       ended_at = NULL,
                       title = excluded.title,
                       game_name = excluded.game_name,
                       peak_viewers = MAX(peak_viewers, excluded.peak_viewers)""",
                (streamer_id, info.stream_id, info.title, info.game_name,
                 to_iso(info.started_at), info.viewer_count),
            )

    def touch(self, streamer_id: int, info: StreamInfo) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                """UPDATE live_sessions SET peak_viewers = MAX(peak_viewers, ?), title = ?, game_name = ?
                   WHERE streamer_id = ? AND stream_id = ?""",
                (info.viewer_count, info.title, info.game_name, streamer_id, info.stream_id),
            )

    def close_open_sessions(self, streamer_id: int, ended_at: datetime) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                "UPDATE live_sessions SET ended_at=? WHERE streamer_id=? AND ended_at IS NULL",
                (to_iso(ended_at), streamer_id),
            )

    def list_for_streamer(self, streamer_id: int) -> list[LiveSession]:
        rows = self.db.query(
            "SELECT * FROM live_sessions WHERE streamer_id=? ORDER BY started_at DESC", (streamer_id,)
        )
        return [
            LiveSession(
                id=r["id"], streamer_id=r["streamer_id"], stream_id=r["stream_id"],
                title=r["title"], game_name=r["game_name"], started_at=from_iso(r["started_at"]),
                ended_at=from_iso(r["ended_at"]), peak_viewers=r["peak_viewers"],
            )
            for r in rows
        ]


class ActivityRepository:
    def __init__(self, db: Database, keep: int = 500):
        self.db = db
        self.keep = keep

    def add(self, message: str, level: str = "info", streamer_id: int | None = None) -> None:
        with self.db.transaction() as tx:
            tx.execute(
                "INSERT INTO activity_log (created_at, level, message, streamer_id) VALUES (?, ?, ?, ?)",
                (to_iso(utcnow()), level, message, streamer_id),
            )
            tx.execute(
                "DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY id DESC LIMIT ?)",
                (self.keep,),
            )

    def recent(self, limit: int = 30) -> list[dict]:
        rows = self.db.query("SELECT * FROM activity_log ORDER BY id DESC LIMIT ?", (limit,))
        return [
            {"created_at": from_iso(r["created_at"]), "level": r["level"], "message": r["message"]}
            for r in rows
        ]


class SettingsRepository:
    """Armazena ``AppSettings`` como chave/valor. Segredos são protegidos (DPAPI)."""

    TOKEN_KEY = "_twitch_app_token"
    TOKEN_EXPIRY_KEY = "_twitch_app_token_expires_at"

    def __init__(self, db: Database):
        self.db = db

    def get_raw(self, key: str) -> str | None:
        row = self.db.query_one("SELECT value FROM settings WHERE key=?", (key,))
        return row["value"] if row else None

    def set_raw(self, values: dict[str, str]) -> None:
        with self.db.transaction() as tx:
            tx.executemany(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                list(values.items()),
            )

    def delete_raw(self, *keys: str) -> None:
        with self.db.transaction() as tx:
            tx.executemany("DELETE FROM settings WHERE key=?", [(k,) for k in keys])

    def load(self) -> AppSettings:
        defaults = AppSettings()
        data: dict = {}
        stored = {r["key"]: r["value"] for r in self.db.query("SELECT key, value FROM settings")}
        for f in fields(AppSettings):
            if f.name not in stored:
                continue
            raw = stored[f.name]
            if f.name in AppSettings.SECRET_FIELDS:
                raw = secrets.unprotect(raw)
            default = getattr(defaults, f.name)
            try:
                if isinstance(default, bool):
                    data[f.name] = raw in ("1", "true", "True")
                elif isinstance(default, int):
                    data[f.name] = int(raw)
                else:
                    data[f.name] = raw
            except ValueError:
                continue
        return AppSettings(**data)

    def save(self, settings: AppSettings) -> AppSettings:
        settings = settings.normalized()
        previous = self.load()
        values: dict[str, str] = {}
        for f in fields(AppSettings):
            value = getattr(settings, f.name)
            if isinstance(value, bool):
                values[f.name] = "1" if value else "0"
            elif f.name in AppSettings.SECRET_FIELDS:
                values[f.name] = secrets.protect(str(value))
            else:
                values[f.name] = str(value)
        self.set_raw(values)
        if (previous.twitch_client_id, previous.twitch_client_secret) != (
            settings.twitch_client_id, settings.twitch_client_secret,
        ):
            self.clear_cached_token()
        return settings

    # ---- cache do app access token da Twitch
    def load_cached_token(self) -> tuple[str, datetime] | None:
        token = self.get_raw(self.TOKEN_KEY)
        expires = from_iso(self.get_raw(self.TOKEN_EXPIRY_KEY))
        if not token or not expires:
            return None
        return secrets.unprotect(token), expires

    def save_cached_token(self, token: str, expires_at: datetime) -> None:
        self.set_raw({self.TOKEN_KEY: secrets.protect(token), self.TOKEN_EXPIRY_KEY: to_iso(expires_at) or ""})

    def clear_cached_token(self) -> None:
        self.delete_raw(self.TOKEN_KEY, self.TOKEN_EXPIRY_KEY)
