import threading

import pytest

from config.settings import AppSettings
from database.connection import open_database
from database.repositories import DuplicateStreamerError
from database.schema import MIGRATIONS
from models.streamer import Streamer


def test_migrations_are_idempotent(tmp_path):
    path = tmp_path / "a.db"
    db = open_database(path)
    v1 = db.migrate()
    db.close()
    db2 = open_database(path)
    assert db2.migrate() == v1 == MIGRATIONS[-1][0]
    tables = {r["name"] for r in db2.query("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"streamers", "settings", "live_sessions", "activity_log"} <= tables
    db2.close()


def test_add_and_get_streamer(repos):
    repo = repos["streamers"]
    s = repo.add(Streamer(login="gaules", authorized=True))
    assert s.id is not None
    assert s.created_at is not None
    assert repo.get_by_login("GAULES").id == s.id  # COLLATE NOCASE


def test_duplicate_login_raises(repos):
    repo = repos["streamers"]
    repo.add(Streamer(login="alanzoka"))
    with pytest.raises(DuplicateStreamerError):
        repo.add(Streamer(login="Alanzoka"))


def test_list_monitorable_requires_authorization(repos):
    repo = repos["streamers"]
    repo.add(Streamer(login="aaa_ok", authorized=True, monitoring_enabled=True))
    repo.add(Streamer(login="bbb_noauth", authorized=False, monitoring_enabled=True))
    repo.add(Streamer(login="ccc_paused", authorized=True, monitoring_enabled=False))
    assert [s.login for s in repo.list_monitorable()] == ["aaa_ok"]
    assert repo.counts() == {"total": 3, "live": 0, "monitored": 1}


def test_delete_cascades_sessions(repos):
    from models.live_status import StreamInfo

    s = repos["streamers"].add(Streamer(login="cascade", authorized=True))
    info = StreamInfo("1", "u", "cascade", "Cascade", "t", "g", 10, None)
    repos["sessions"].open_session(s.id, info)
    assert len(repos["sessions"].list_for_streamer(s.id)) == 1
    assert repos["streamers"].delete(s.id)
    assert repos["sessions"].list_for_streamer(s.id) == []


def test_transaction_rolls_back(db, repos):
    with pytest.raises(RuntimeError):
        with db.transaction() as tx:
            tx.execute(
                "INSERT INTO settings (key, value) VALUES ('x', '1')"
            )
            raise RuntimeError("boom")
    assert repos["settings"].get_raw("x") is None


def test_settings_roundtrip_and_secret_not_plaintext(repos):
    repo = repos["settings"]
    saved = repo.save(AppSettings(twitch_client_id=" abc ", twitch_client_secret="s3cr3t",
                                  poll_interval_seconds=5, start_monitoring_on_launch=True))
    assert saved.twitch_client_id == "abc"
    assert saved.poll_interval_seconds == 30  # limitado ao mínimo
    loaded = repo.load()
    assert loaded.twitch_client_secret == "s3cr3t"
    assert loaded.start_monitoring_on_launch is True
    assert repo.get_raw("twitch_client_secret") != "s3cr3t"


def test_changing_credentials_clears_cached_token(repos):
    from datetime import datetime, timezone

    repo = repos["settings"]
    repo.save(AppSettings(twitch_client_id="a", twitch_client_secret="b"))
    repo.save_cached_token("tok", datetime(2030, 1, 1, tzinfo=timezone.utc))
    repo.save(AppSettings(twitch_client_id="a", twitch_client_secret="b", poll_interval_seconds=90))
    assert repo.load_cached_token() is not None  # mesmas credenciais: mantém
    repo.save(AppSettings(twitch_client_id="a", twitch_client_secret="c"))
    assert repo.load_cached_token() is None


def test_concurrent_writes_from_threads(repos):
    repo = repos["activity"]
    errors = []

    def work(n):
        try:
            for i in range(20):
                repo.add(f"t{n}-{i}")
        except Exception as exc:  # pragma: no cover
            errors.append(exc)

    threads = [threading.Thread(target=work, args=(n,)) for n in range(4)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    assert not errors
    assert len(repo.recent(200)) == 80


def test_upgrade_from_phase1_database(tmp_path, monkeypatch):
    import database.connection as conn_mod

    path = tmp_path / "v1.db"
    monkeypatch.setattr(conn_mod, "MIGRATIONS", MIGRATIONS[:1])
    db = open_database(path)
    with db.transaction() as tx:
        tx.execute(
            "INSERT INTO streamers (login, authorized, created_at, updated_at) VALUES ('antigo', 1, '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')"
        )
    db.close()
    monkeypatch.setattr(conn_mod, "MIGRATIONS", MIGRATIONS)
    db = open_database(path)
    from database.repositories import StreamerRepository

    s = StreamerRepository(db).get_by_login("antigo")
    assert s.check_interval_seconds is None and s.offline_misses == 0
    assert db.migrate() == MIGRATIONS[-1][0]
    db.close()
