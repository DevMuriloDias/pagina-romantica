import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from database.connection import open_database  # noqa: E402
from database.repositories import (  # noqa: E402
    ActivityRepository, JobRepository, LiveSessionRepository, SettingsRepository, StreamerRepository,
    StreamEventRepository,
)


class FakeResponse:
    def __init__(self, status_code=200, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}
        self.text = str(self._payload)

    def json(self):
        return self._payload


class FakeSession:
    """Substitui ``requests.Session``: responde por (método, url) com fila de respostas."""

    def __init__(self):
        self.routes: dict[tuple[str, str], list] = {}
        self.calls: list[dict] = []

    def add(self, method, url, *responses):
        self.routes.setdefault((method, url), []).extend(responses)

    def _respond(self, method, url, **kw):
        self.calls.append({"method": method, "url": url, **kw})
        queue = self.routes.get((method, url))
        if not queue:
            raise AssertionError(f"Requisição inesperada: {method} {url}")
        resp = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(resp, Exception):
            raise resp
        if callable(resp):
            return resp(**kw)
        return resp

    def get(self, url, **kw):
        return self._respond("GET", url, **kw)

    def post(self, url, **kw):
        return self._respond("POST", url, **kw)


@pytest.fixture
def db(tmp_path):
    database = open_database(tmp_path / "test.db")
    yield database
    database.close()


@pytest.fixture
def repos(db):
    return {
        "streamers": StreamerRepository(db),
        "sessions": LiveSessionRepository(db),
        "activity": ActivityRepository(db),
        "settings": SettingsRepository(db),
        "events": StreamEventRepository(db),
        "jobs": JobRepository(db),
    }


@pytest.fixture
def fake_session():
    return FakeSession()
