"""Migrações versionadas. Nunca edite uma migração já publicada: adicione outra."""

MIGRATIONS: list[tuple[int, list[str]]] = [
    (
        1,
        [
            """
            CREATE TABLE streamers (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                login               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
                display_name        TEXT    NOT NULL DEFAULT '',
                twitch_user_id      TEXT    UNIQUE,
                profile_image_url   TEXT,
                authorized          INTEGER NOT NULL DEFAULT 0,
                authorization_note  TEXT    NOT NULL DEFAULT '',
                monitoring_enabled  INTEGER NOT NULL DEFAULT 1,
                notes               TEXT    NOT NULL DEFAULT '',
                is_live             INTEGER NOT NULL DEFAULT 0,
                stream_id           TEXT,
                stream_title        TEXT,
                game_name           TEXT,
                viewer_count        INTEGER,
                live_since          TEXT,
                last_checked_at     TEXT,
                created_at          TEXT    NOT NULL,
                updated_at          TEXT    NOT NULL
            )
            """,
            """
            CREATE TABLE settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE live_sessions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                streamer_id  INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
                stream_id    TEXT    NOT NULL,
                title        TEXT    NOT NULL DEFAULT '',
                game_name    TEXT    NOT NULL DEFAULT '',
                started_at   TEXT,
                ended_at     TEXT,
                peak_viewers INTEGER NOT NULL DEFAULT 0,
                UNIQUE (streamer_id, stream_id)
            )
            """,
            "CREATE INDEX idx_live_sessions_open ON live_sessions (streamer_id) WHERE ended_at IS NULL",
            """
            CREATE TABLE activity_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT NOT NULL,
                level       TEXT NOT NULL DEFAULT 'info',
                message     TEXT NOT NULL,
                streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL
            )
            """,
            "CREATE INDEX idx_activity_created ON activity_log (created_at DESC)",
        ],
    ),
]

MIGRATIONS.append(
    (
        2,
        [
            # Fase 2 — monitoramento
            "ALTER TABLE streamers ADD COLUMN check_interval_seconds INTEGER",
            "ALTER TABLE streamers ADD COLUMN offline_misses INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE streamers ADD COLUMN last_seen_live_at TEXT",
            """
            CREATE TABLE stream_events (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                streamer_id       INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
                event_type        TEXT    NOT NULL,
                stream_id         TEXT,
                title             TEXT    NOT NULL DEFAULT '',
                game_name         TEXT    NOT NULL DEFAULT '',
                viewer_count      INTEGER,
                stream_started_at TEXT,
                detected_at       TEXT    NOT NULL
            )
            """,
            "CREATE INDEX idx_stream_events_streamer ON stream_events (streamer_id, id DESC)",
            """
            CREATE TABLE jobs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                job_type     TEXT    NOT NULL,
                status       TEXT    NOT NULL DEFAULT 'queued',
                streamer_id  INTEGER REFERENCES streamers(id) ON DELETE SET NULL,
                priority     INTEGER NOT NULL DEFAULT 0,
                progress     REAL    NOT NULL DEFAULT 0,
                message      TEXT    NOT NULL DEFAULT '',
                error        TEXT,
                payload      TEXT    NOT NULL DEFAULT '{}',
                dedupe_key   TEXT,
                attempts     INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT    NOT NULL,
                started_at   TEXT,
                finished_at  TEXT,
                updated_at   TEXT    NOT NULL
            )
            """,
            "CREATE INDEX idx_jobs_status ON jobs (status, priority DESC, id)",
            # Impede duas tarefas ativas iguais (ex.: duas capturas da mesma live).
            "CREATE UNIQUE INDEX idx_jobs_dedupe_active ON jobs (dedupe_key) "
            "WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running')",
        ],
    )
)
