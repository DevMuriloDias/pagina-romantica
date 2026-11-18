"""Conexão SQLite e migrações de esquema.

Cada thread obtém sua própria conexão (``sqlite3`` não deve compartilhar
conexões entre threads). WAL permite leitura na UI enquanto o worker grava.
"""
from __future__ import annotations

import logging
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from database.schema import MIGRATIONS

log = logging.getLogger(__name__)


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        self._local = threading.local()
        self._write_lock = threading.RLock()
        self._all_connections: list[sqlite3.Connection] = []
        self._registry_lock = threading.Lock()
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ conexão
    def _connect(self) -> sqlite3.Connection:
        # isolation_level=None: autocommit; escritas usam transaction() explicitamente.
        conn = sqlite3.connect(self.path, timeout=10, check_same_thread=False, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        if self.path != ":memory:":
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
        with self._registry_lock:
            self._all_connections.append(conn)
        return conn

    @property
    def conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = self._connect()
            self._local.conn = conn
        return conn

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._write_lock:
            conn = self.conn
            try:
                conn.execute("BEGIN IMMEDIATE")
                yield conn
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise

    def query(self, sql: str, params: tuple | dict = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def query_one(self, sql: str, params: tuple | dict = ()) -> sqlite3.Row | None:
        return self.conn.execute(sql, params).fetchone()

    def close(self) -> None:
        with self._registry_lock:
            for conn in self._all_connections:
                try:
                    conn.close()
                except sqlite3.Error:
                    pass
            self._all_connections.clear()
        self._local = threading.local()

    # ---------------------------------------------------------------- migrações
    def migrate(self) -> int:
        conn = self.conn
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            " version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        current = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").fetchone()[0]
        for version, statements in MIGRATIONS:
            if version <= current:
                continue
            log.info("Aplicando migração %s", version)
            with self.transaction() as tx:
                for stmt in statements:
                    tx.execute(stmt)
                tx.execute("INSERT INTO schema_migrations (version) VALUES (?)", (version,))
            current = version
        return current


def open_database(path: Path | str) -> Database:
    db = Database(path)
    db.migrate()
    return db
