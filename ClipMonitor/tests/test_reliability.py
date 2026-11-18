import logging
import sqlite3
import subprocess
import sys
import threading

import pytest

from database.connection import open_database
from database.schema import MIGRATIONS
from utils.errors import friendly, install_global_handlers
from utils.logging_setup import RedactingFilter, register_secret, setup_logging, tail
from utils.single_instance import AlreadyRunning, SingleInstance


def test_redaction_of_registered_secrets_and_patterns():
    register_secret("superSecretValue123")
    r = RedactingFilter.redact
    assert r("client secret is superSecretValue123!") == "client secret is ***!"
    assert r("headers={'Authorization': 'Bearer abc.def-ghi'}") == "headers={'Authorization': 'Bearer ***'}"
    assert r("POST access_token=xyz987&expires_in=3") == "POST access_token=***&expires_in=3"
    assert r('{"client_secret": "s3cr3t"}') == '{"client_secret": "***"}'
    register_secret("abc")  # curto demais: não é registrado (evita apagar palavras comuns)
    assert r("abc") == "abc"


def test_secret_never_reaches_log_file(tmp_path):
    path = setup_logging(tmp_path)  # pode já estar configurado por outro teste: usa um logger próprio
    handler = logging.FileHandler(tmp_path / "t.log", encoding="utf-8")
    handler.addFilter(RedactingFilter())
    log = logging.getLogger("teste.segredo")
    log.addHandler(handler)
    register_secret("tokenXYZ12345")
    try:
        raise ValueError("falhou com tokenXYZ12345")
    except ValueError:
        log.exception("erro usando %s", "tokenXYZ12345")
    handler.close()
    text = (tmp_path / "t.log").read_text(encoding="utf-8")
    assert "tokenXYZ12345" not in text and text.count("***") >= 2
    assert path.name == "clipmonitor.log"


def test_tail(tmp_path):
    f = tmp_path / "x.log"
    f.write_text("\n".join(str(i) for i in range(1000)), encoding="utf-8")
    assert [l.strip() for l in tail(f, 3)] == ["997", "998", "999"]
    assert tail(tmp_path / "nao_existe.log") == []


def test_thread_errors_are_logged_and_notified(caplog):
    seen = []
    old_hook = threading.excepthook
    install_global_handlers(seen.append)
    try:
        t = threading.Thread(target=lambda: 1 / 0, name="Quebra")
        t.start()
        t.join()
    finally:
        threading.excepthook = old_hook
        sys.excepthook = sys.__excepthook__
    assert isinstance(seen[0], ZeroDivisionError)
    assert any("Quebra" in r.getMessage() for r in caplog.records)


def test_friendly_messages():
    assert "Disco cheio" in friendly(OSError(28, "No space left on device"))
    assert "permissão" in friendly(PermissionError(13, "denied"))
    assert friendly(RuntimeError("Mensagem clara")) == "Mensagem clara"


def test_backup_before_migration(tmp_path, monkeypatch):
    import database.connection as conn_mod

    path = tmp_path / "app.db"
    monkeypatch.setattr(conn_mod, "MIGRATIONS", MIGRATIONS[:2])
    db = open_database(path)
    with db.transaction() as tx:
        tx.execute("INSERT INTO settings (key, value) VALUES ('marcador', '42')")
    db.close()
    monkeypatch.setattr(conn_mod, "MIGRATIONS", MIGRATIONS)
    db = open_database(path)
    backup = tmp_path / "app.antes-v3.bak"
    assert backup.exists()
    copy = sqlite3.connect(backup)
    assert copy.execute("SELECT value FROM settings WHERE key='marcador'").fetchone()[0] == "42"
    assert copy.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 2
    copy.close()
    assert db.integrity_ok()
    db.close()
    open_database(path).close()  # nada a migrar: nenhum backup novo
    assert len(list(tmp_path.glob("*.bak"))) == 1


def test_single_instance(tmp_path):
    lock = tmp_path / "app.lock"
    with SingleInstance(lock):
        # Outro processo não consegue o lock.
        code = subprocess.run([sys.executable, "-c",
                               "import sys; sys.path.insert(0, '.');"
                               "from utils.single_instance import SingleInstance, AlreadyRunning\n"
                               f"try:\n  SingleInstance(r'{lock}').acquire(); print('ok')\n"
                               "except AlreadyRunning: print('bloqueado')"],
                              capture_output=True, text=True).stdout.strip()
        assert code == "bloqueado"
    SingleInstance(lock).acquire().release()  # liberado ao sair
