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
