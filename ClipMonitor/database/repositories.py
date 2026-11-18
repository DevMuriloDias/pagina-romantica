"""Acesso a dados (padrão repositório). Nenhuma lógica de UI aqui."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import fields
from datetime import datetime

from config.settings import AppSettings
from database.connection import Database
from detection.selection import Decision, decide
from models.candidate import Candidate, CandidateStatus, TranscriptSegment, TranscriptWord
from models.events import StreamEvent, StreamEventType
from models.recording import Recording, RecordingStatus, Segment, SegmentStatus
from models.job import Job, JobStatus, JobType
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
        check_interval_seconds=row["check_interval_seconds"],
        offline_misses=row["offline_misses"],
        last_seen_live_at=from_iso(row["last_seen_live_at"]),
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
                           authorized, authorization_note, monitoring_enabled, notes, check_interval_seconds,
                           created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        s.login, s.display_name, s.twitch_user_id, s.profile_image_url,
                        int(s.authorized), s.authorization_note, int(s.monitoring_enabled),
                        s.notes, s.check_interval_seconds, now, now,
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
                           authorized=?, authorization_note=?, monitoring_enabled=?, notes=?,
                           check_interval_seconds=?, updated_at=?
                       WHERE id=?""",
                    (
                        s.login, s.display_name, s.twitch_user_id, s.profile_image_url,
                        int(s.authorized), s.authorization_note, int(s.monitoring_enabled),
                        s.notes, s.check_interval_seconds, to_iso(utcnow()), s.id,
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

    def save_live_state(self, s: Streamer, checked_at: datetime) -> None:
        """Persiste o estado ao vivo calculado pelo rastreador (``StreamTracker``)."""
        with self.db.transaction() as tx:
            tx.execute(
                """UPDATE streamers SET is_live=?, stream_id=?, stream_title=?, game_name=?, viewer_count=?,
                       live_since=?, last_seen_live_at=?, offline_misses=?, last_checked_at=? WHERE id=?""",
                (int(s.is_live), s.stream_id, s.stream_title, s.game_name, s.viewer_count,
                 to_iso(s.live_since), to_iso(s.last_seen_live_at), s.offline_misses,
                 to_iso(checked_at), s.id),
            )

    # Atalhos usados em testes/semeadura de dados.
    def set_live(self, streamer_id: int, info: StreamInfo, checked_at: datetime) -> None:
        s = self.get(streamer_id)
        assert s is not None
        s.is_live, s.stream_id, s.stream_title, s.game_name = True, info.stream_id, info.title, info.game_name
        s.viewer_count, s.live_since, s.last_seen_live_at, s.offline_misses = (
            info.viewer_count, info.started_at, checked_at, 0)
        self.save_live_state(s, checked_at)

    def set_offline(self, streamer_id: int, checked_at: datetime) -> None:
        s = self.get(streamer_id)
        assert s is not None
        s.is_live, s.stream_id, s.stream_title, s.game_name = False, None, None, None
        s.viewer_count, s.live_since, s.offline_misses = None, None, 0
        self.save_live_state(s, checked_at)

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


def _row_to_event(r: sqlite3.Row, name: str = "") -> StreamEvent:
    return StreamEvent(
        id=r["id"], type=StreamEventType(r["event_type"]), streamer_id=r["streamer_id"],
        streamer_name=name or (r["streamer_name"] if "streamer_name" in r.keys() else ""),
        detected_at=from_iso(r["detected_at"]), stream_id=r["stream_id"], title=r["title"],
        game_name=r["game_name"], viewer_count=r["viewer_count"],
        stream_started_at=from_iso(r["stream_started_at"]),
    )


class StreamEventRepository:
    def __init__(self, db: Database, keep: int = 5000):
        self.db = db
        self.keep = keep

    def add_many(self, events: list[StreamEvent]) -> list[StreamEvent]:
        if not events:
            return []
        saved = []
        with self.db.transaction() as tx:
            for e in events:
                cur = tx.execute(
                    """INSERT INTO stream_events (streamer_id, event_type, stream_id, title, game_name,
                           viewer_count, stream_started_at, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (e.streamer_id, e.type.value, e.stream_id, e.title, e.game_name, e.viewer_count,
                     to_iso(e.stream_started_at), to_iso(e.detected_at)),
                )
                saved.append(StreamEvent(**{**e.__dict__, "id": cur.lastrowid}))
            tx.execute(
                "DELETE FROM stream_events WHERE id <= (SELECT MAX(id) FROM stream_events) - ?", (self.keep,)
            )
        return saved

    def recent(self, limit: int = 50, streamer_id: int | None = None) -> list[StreamEvent]:
        sql = """SELECT e.*, COALESCE(NULLIF(s.display_name, ''), s.login) AS streamer_name
                 FROM stream_events e JOIN streamers s ON s.id = e.streamer_id"""
        params: tuple = ()
        if streamer_id is not None:
            sql += " WHERE e.streamer_id = ?"
            params = (streamer_id,)
        sql += " ORDER BY e.id DESC LIMIT ?"
        return [_row_to_event(r) for r in self.db.query(sql, params + (limit,))]


def _row_to_job(r: sqlite3.Row) -> Job:
    return Job(
        id=r["id"], job_type=JobType(r["job_type"]), status=JobStatus(r["status"]),
        streamer_id=r["streamer_id"], priority=r["priority"], progress=r["progress"],
        message=r["message"], error=r["error"], payload=json.loads(r["payload"] or "{}"),
        dedupe_key=r["dedupe_key"], attempts=r["attempts"],
        streamer_name=r["streamer_name"] if "streamer_name" in r.keys() else None,
        created_at=from_iso(r["created_at"]), started_at=from_iso(r["started_at"]),
        finished_at=from_iso(r["finished_at"]), updated_at=from_iso(r["updated_at"]),
    )


_JOB_SELECT = """SELECT j.*, COALESCE(NULLIF(s.display_name, ''), s.login) AS streamer_name
                 FROM jobs j LEFT JOIN streamers s ON s.id = j.streamer_id"""


class JobRepository:
    def __init__(self, db: Database):
        self.db = db

    def enqueue(self, job: Job) -> Job:
        """Enfileira; se já existir tarefa ativa com o mesmo ``dedupe_key``, retorna a existente."""
        now = to_iso(utcnow())
        try:
            with self.db.transaction() as tx:
                cur = tx.execute(
                    """INSERT INTO jobs (job_type, status, streamer_id, priority, message, payload,
                           dedupe_key, created_at, updated_at) VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?)""",
                    (job.job_type.value, job.streamer_id, job.priority, job.message,
                     json.dumps(job.payload), job.dedupe_key, now, now),
                )
                job_id = cur.lastrowid
        except sqlite3.IntegrityError:
            existing = self.db.query_one(
                f"{_JOB_SELECT} WHERE j.dedupe_key = ? AND j.status IN ('queued','running')",
                (job.dedupe_key,),
            )
            return _row_to_job(existing)
        return self.get(job_id)  # type: ignore[return-value]

    def get(self, job_id: int) -> Job | None:
        row = self.db.query_one(f"{_JOB_SELECT} WHERE j.id = ?", (job_id,))
        return _row_to_job(row) if row else None

    def list(self, statuses: tuple[JobStatus, ...] | None = None, limit: int = 200) -> list[Job]:
        sql, params = _JOB_SELECT, []
        if statuses:
            sql += f" WHERE j.status IN ({','.join('?' * len(statuses))})"
            params = [st.value for st in statuses]
        sql += " ORDER BY CASE j.status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, j.id DESC LIMIT ?"
        return [_row_to_job(r) for r in self.db.query(sql, tuple(params) + (limit,))]

    def claim_next(self, job_types: list[JobType]) -> Job | None:
        """Marca atomicamente a próxima tarefa da fila como ``running``."""
        if not job_types:
            return None
        now = to_iso(utcnow())
        with self.db.transaction() as tx:
            row = tx.execute(
                f"""SELECT id FROM jobs WHERE status='queued' AND job_type IN ({','.join('?' * len(job_types))})
                    ORDER BY priority DESC, id LIMIT 1""",
                tuple(t.value for t in job_types),
            ).fetchone()
            if row is None:
                return None
            tx.execute(
                """UPDATE jobs SET status='running', started_at=?, updated_at=?, attempts=attempts+1,
                       progress=0, error=NULL WHERE id=?""",
                (now, now, row["id"]),
            )
        return self.get(row["id"])

    def update_progress(self, job_id: int, progress: float, message: str | None = None) -> None:
        progress = max(0.0, min(1.0, float(progress)))
        with self.db.transaction() as tx:
            if message is None:
                tx.execute("UPDATE jobs SET progress=?, updated_at=? WHERE id=?", (progress, to_iso(utcnow()), job_id))
            else:
                tx.execute("UPDATE jobs SET progress=?, message=?, updated_at=? WHERE id=?",
                           (progress, message, to_iso(utcnow()), job_id))

    def finish(self, job_id: int, status: JobStatus, message: str = "", error: str | None = None) -> None:
        now = to_iso(utcnow())
        progress_sql = ", progress=1" if status is JobStatus.COMPLETED else ""
        with self.db.transaction() as tx:
            tx.execute(
                f"UPDATE jobs SET status=?, message=?, error=?, finished_at=?, updated_at=?{progress_sql} WHERE id=?",
                (status.value, message, error, now, now, job_id),
            )

    def cancel_if_queued(self, job_id: int) -> bool:
        now = to_iso(utcnow())
        with self.db.transaction() as tx:
            cur = tx.execute(
                "UPDATE jobs SET status='cancelled', message='Cancelada pelo usuário', finished_at=?, updated_at=? "
                "WHERE id=? AND status='queued'",
                (now, now, job_id),
            )
            return cur.rowcount > 0

    def requeue(self, job_id: int) -> bool:
        """Recoloca na fila uma tarefa que falhou/foi cancelada/interrompida."""
        retryable = tuple(s.value for s in JobStatus if s.is_retryable)
        try:
            with self.db.transaction() as tx:
                cur = tx.execute(
                    f"""UPDATE jobs SET status='queued', progress=0, error=NULL, message='Aguardando na fila',
                           started_at=NULL, finished_at=NULL, updated_at=?
                        WHERE id=? AND status IN ({','.join('?' * len(retryable))})""",
                    (to_iso(utcnow()), job_id, *retryable),
                )
                return cur.rowcount > 0
        except sqlite3.IntegrityError:
            return False  # já existe outra tarefa ativa equivalente

    def mark_running_as_interrupted(self) -> int:
        now = to_iso(utcnow())
        with self.db.transaction() as tx:
            cur = tx.execute(
                "UPDATE jobs SET status='interrupted', message='O ClipMonitor foi fechado durante a execução', "
                "finished_at=?, updated_at=? WHERE status='running'",
                (now, now),
            )
            return cur.rowcount

    def delete(self, job_id: int) -> bool:
        with self.db.transaction() as tx:
            cur = tx.execute("DELETE FROM jobs WHERE id=? AND status != 'running'", (job_id,))
            return cur.rowcount > 0

    def clear_finished(self) -> int:
        with self.db.transaction() as tx:
            cur = tx.execute("DELETE FROM jobs WHERE status IN ('completed', 'cancelled')")
            return cur.rowcount

    def counts(self) -> dict[tuple[JobType, JobStatus], int]:
        rows = self.db.query("SELECT job_type, status, COUNT(*) AS n FROM jobs GROUP BY job_type, status")
        return {(JobType(r["job_type"]), JobStatus(r["status"])): r["n"] for r in rows}

    def active_by_streamer(self) -> dict[int, Job]:
        """Tarefa ativa mais relevante por streamer (captura em andamento tem prioridade)."""
        rows = self.db.query(
            f"""{_JOB_SELECT} WHERE j.streamer_id IS NOT NULL AND j.status IN ('queued', 'running')
                ORDER BY CASE j.status WHEN 'running' THEN 0 ELSE 1 END,
                         CASE j.job_type WHEN 'capture' THEN 0 ELSE 1 END, j.id"""
        )
        out: dict[int, Job] = {}
        for r in rows:
            out.setdefault(r["streamer_id"], _row_to_job(r))
        return out


# ---------------------------------------------------------------- gravações

_REC_SELECT = """SELECT r.*, COALESCE(NULLIF(s.display_name, ''), s.login) AS streamer_name
                 FROM recordings r JOIN streamers s ON s.id = r.streamer_id"""


def _row_to_recording(r: sqlite3.Row) -> Recording:
    return Recording(
        id=r["id"], streamer_id=r["streamer_id"], stream_id=r["stream_id"], directory=r["directory"],
        status=RecordingStatus(r["status"]), quality=r["quality"], authorization_note=r["authorization_note"],
        job_id=r["job_id"], started_at=from_iso(r["started_at"]), ended_at=from_iso(r["ended_at"]),
        bytes=r["bytes"], segment_count=r["segment_count"],
        streamer_name=r["streamer_name"] if "streamer_name" in r.keys() else None,
    )


def _row_to_segment(r: sqlite3.Row) -> Segment:
    return Segment(
        id=r["id"], recording_id=r["recording_id"], index=r["idx"], path=r["path"],
        start_offset=r["start_offset"], duration=r["duration"], status=SegmentStatus(r["status"]),
        bytes=r["bytes"],
    )


class RecordingRepository:
    def __init__(self, db: Database):
        self.db = db

    def create(self, rec: Recording) -> Recording:
        with self.db.transaction() as tx:
            cur = tx.execute(
                """INSERT INTO recordings (streamer_id, stream_id, job_id, directory, status, quality,
                       authorization_note, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (rec.streamer_id, rec.stream_id, rec.job_id, rec.directory, rec.status.value, rec.quality,
                 rec.authorization_note, to_iso(rec.started_at or utcnow())),
            )
        return self.get(cur.lastrowid)  # type: ignore[return-value]

    def get(self, recording_id: int) -> Recording | None:
        row = self.db.query_one(f"{_REC_SELECT} WHERE r.id = ?", (recording_id,))
        return _row_to_recording(row) if row else None

    def list_recent(self, limit: int = 50) -> list[Recording]:
        return [_row_to_recording(r) for r in self.db.query(f"{_REC_SELECT} ORDER BY r.id DESC LIMIT ?", (limit,))]

    def set_directory(self, recording_id: int, directory: str) -> None:
        with self.db.transaction() as tx:
            tx.execute("UPDATE recordings SET directory=? WHERE id=?", (directory, recording_id))

    def finish(self, recording_id: int, status: RecordingStatus) -> None:
        with self.db.transaction() as tx:
            tx.execute("UPDATE recordings SET status=?, ended_at=? WHERE id=?",
                       (status.value, to_iso(utcnow()), recording_id))

    def update_stats(self, recording_id: int, total_bytes: int, segment_count: int) -> None:
        with self.db.transaction() as tx:
            tx.execute("UPDATE recordings SET bytes=?, segment_count=? WHERE id=?",
                       (total_bytes, segment_count, recording_id))

    def mark_running_as_failed(self) -> int:
        with self.db.transaction() as tx:
            cur = tx.execute("UPDATE recordings SET status='failed', ended_at=? WHERE status='recording'",
                             (to_iso(utcnow()),))
            return cur.rowcount

    def finished_before(self, cutoff: datetime) -> list[Recording]:
        rows = self.db.query(
            f"{_REC_SELECT} WHERE r.status IN ('completed','stopped','failed') AND r.ended_at IS NOT NULL "
            "AND r.ended_at < ? ORDER BY r.id",
            (to_iso(cutoff),),
        )
        return [_row_to_recording(r) for r in rows]

    # ---- segmentos
    def add_segment(self, seg: Segment) -> Segment:
        """Registra um segmento concluído (idempotente por índice)."""
        with self.db.transaction() as tx:
            tx.execute(
                """INSERT INTO recording_segments (recording_id, idx, path, start_offset, duration, bytes)
                   VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (recording_id, idx) DO NOTHING""",
                (seg.recording_id, seg.index, seg.path, seg.start_offset, seg.duration, seg.bytes),
            )
            row = tx.execute("SELECT * FROM recording_segments WHERE recording_id=? AND idx=?",
                             (seg.recording_id, seg.index)).fetchone()
        return _row_to_segment(row)

    def get_segment(self, segment_id: int) -> Segment | None:
        row = self.db.query_one("SELECT * FROM recording_segments WHERE id=?", (segment_id,))
        return _row_to_segment(row) if row else None

    def segments(self, recording_id: int) -> list[Segment]:
        rows = self.db.query("SELECT * FROM recording_segments WHERE recording_id=? ORDER BY idx", (recording_id,))
        return [_row_to_segment(r) for r in rows]

    def segments_covering(self, recording_id: int, start: float, end: float) -> list[Segment]:
        rows = self.db.query(
            """SELECT * FROM recording_segments WHERE recording_id=? AND status != 'deleted'
                   AND start_offset < ? AND start_offset + duration > ? ORDER BY idx""",
            (recording_id, end, start),
        )
        return [_row_to_segment(r) for r in rows]

    def set_segment_status(self, segment_id: int, status: SegmentStatus) -> None:
        analyzed = to_iso(utcnow()) if status is SegmentStatus.ANALYZED else None
        with self.db.transaction() as tx:
            tx.execute("UPDATE recording_segments SET status=?, analyzed_at=COALESCE(?, analyzed_at) WHERE id=?",
                       (status.value, analyzed, segment_id))

    def mark_purged(self, recording_id: int) -> None:
        with self.db.transaction() as tx:
            tx.execute("UPDATE recording_segments SET status='deleted' WHERE recording_id=?", (recording_id,))
            tx.execute("UPDATE recordings SET status='purged' WHERE id=?", (recording_id,))


# ---------------------------------------------------------------- candidatos

_CAND_SELECT = """SELECT c.*, COALESCE(NULLIF(s.display_name, ''), s.login) AS streamer_name
                  FROM candidates c JOIN streamers s ON s.id = c.streamer_id"""


def _transcript_to_json(segments: list[TranscriptSegment]) -> str:
    return json.dumps([
        {"start": s.start, "end": s.end, "text": s.text,
         "words": [[w.start, w.end, w.word, w.probability] for w in s.words]}
        for s in segments
    ], ensure_ascii=False)


def _transcript_from_json(raw: str) -> list[TranscriptSegment]:
    out = []
    for s in json.loads(raw or "[]"):
        words = [TranscriptWord(w[0], w[1], w[2], w[3]) for w in s.get("words", [])]
        out.append(TranscriptSegment(s["start"], s["end"], s["text"], words))
    return out


def _row_to_candidate(r: sqlite3.Row) -> Candidate:
    return Candidate(
        id=r["id"], recording_id=r["recording_id"], streamer_id=r["streamer_id"], start=r["start_offset"],
        end=r["end_offset"], peak=r["peak_offset"], score=r["score"], audio_score=r["audio_score"],
        text_score=r["text_score"], breakdown=json.loads(r["breakdown"] or "{}"),
        status=CandidateStatus(r["status"]), transcript=_transcript_from_json(r["transcript"]),
        language=r["language"], created_at=from_iso(r["created_at"]),
        streamer_name=r["streamer_name"] if "streamer_name" in r.keys() else None,
    )


class CandidateRepository:
    def __init__(self, db: Database):
        self.db = db

    def _existing(self, tx, recording_id: int) -> list[Candidate]:
        rows = tx.execute(f"{_CAND_SELECT} WHERE c.recording_id = ?", (recording_id,)).fetchall()
        return [_row_to_candidate(r) for r in rows]

    def _discard(self, tx, ids: list[int], now: str) -> None:
        for cid in ids:
            tx.execute("UPDATE candidates SET status='discarded', updated_at=? WHERE id=?", (now, cid))

    def insert_selected(self, cand: Candidate, gap: float, max_per_hour: int) -> tuple[Candidate | None, Decision]:
        """Insere respeitando as regras de sobreposição, de forma atômica."""
        now = to_iso(utcnow())
        with self.db.transaction() as tx:
            decision = decide(cand, self._existing(tx, cand.recording_id), gap, max_per_hour)
            if not decision.accept:
                return None, decision
            self._discard(tx, decision.replace, now)
            cur = tx.execute(
                """INSERT INTO candidates (recording_id, streamer_id, start_offset, end_offset, peak_offset, score,
                       audio_score, text_score, breakdown, status, transcript, language, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cand.recording_id, cand.streamer_id, cand.start, cand.end, cand.peak, cand.score,
                 cand.audio_score, cand.text_score, json.dumps(cand.breakdown), cand.status.value,
                 _transcript_to_json(cand.transcript), cand.language, now, now),
            )
            new_id = cur.lastrowid
        return self.get(new_id), decision

    def update_selected(self, cand: Candidate, gap: float, max_per_hour: int) -> Decision:
        """Atualiza após transcrição; se agora conflitar com um melhor, o candidato é descartado."""
        now = to_iso(utcnow())
        with self.db.transaction() as tx:
            decision = decide(cand, self._existing(tx, cand.recording_id), gap, max_per_hour)
            status = cand.status if decision.accept else CandidateStatus.DISCARDED
            if decision.accept:
                self._discard(tx, decision.replace, now)
            tx.execute(
                """UPDATE candidates SET start_offset=?, end_offset=?, peak_offset=?, score=?, audio_score=?,
                       text_score=?, breakdown=?, status=?, transcript=?, language=?, updated_at=? WHERE id=?""",
                (cand.start, cand.end, cand.peak, cand.score, cand.audio_score, cand.text_score,
                 json.dumps(cand.breakdown), status.value, _transcript_to_json(cand.transcript),
                 cand.language, now, cand.id),
            )
        return decision

    def set_status(self, candidate_id: int, status: CandidateStatus) -> None:
        with self.db.transaction() as tx:
            tx.execute("UPDATE candidates SET status=?, updated_at=? WHERE id=?",
                       (status.value, to_iso(utcnow()), candidate_id))

    def get(self, candidate_id: int) -> Candidate | None:
        row = self.db.query_one(f"{_CAND_SELECT} WHERE c.id = ?", (candidate_id,))
        return _row_to_candidate(row) if row else None

    def list(self, statuses: tuple[CandidateStatus, ...] | None = None, limit: int = 200) -> list[Candidate]:
        sql, params = _CAND_SELECT, []
        if statuses:
            sql += f" WHERE c.status IN ({','.join('?' * len(statuses))})"
            params = [s.value for s in statuses]
        sql += " ORDER BY c.id DESC LIMIT ?"
        return [_row_to_candidate(r) for r in self.db.query(sql, tuple(params) + (limit,))]

    def for_recording(self, recording_id: int) -> list[Candidate]:
        rows = self.db.query(f"{_CAND_SELECT} WHERE c.recording_id = ? ORDER BY c.start_offset", (recording_id,))
        return [_row_to_candidate(r) for r in rows]

    def counts(self) -> dict[CandidateStatus, int]:
        rows = self.db.query("SELECT status, COUNT(*) AS n FROM candidates GROUP BY status")
        return {CandidateStatus(r["status"]): r["n"] for r in rows}
