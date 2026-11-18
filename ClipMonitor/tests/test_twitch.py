from datetime import datetime, timedelta, timezone

import pytest
import requests

from tests.conftest import FakeResponse
from twitch.auth import TOKEN_URL, VALIDATE_URL, TwitchAuth
from twitch.client import HELIX_URL, HelixClient
from twitch.errors import TwitchAuthError, TwitchNetworkError, TwitchRateLimitError

NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)


def token_resp(token="tok1", expires=5000):
    return FakeResponse(200, {"access_token": token, "expires_in": expires, "token_type": "bearer"})


def make_auth(session, clock=lambda: NOW, store=None):
    return TwitchAuth("cid", "secret", session=session, clock=clock, store=store)


def test_auth_requires_credentials(fake_session):
    with pytest.raises(TwitchAuthError):
        TwitchAuth("", "", session=fake_session).get_token()


def test_token_is_cached_until_near_expiry(fake_session):
    fake_session.add("POST", TOKEN_URL, token_resp("a"), token_resp("b"))
    now = [NOW]
    auth = make_auth(fake_session, clock=lambda: now[0])
    assert auth.get_token() == "a"
    assert auth.get_token() == "a"
    assert len(fake_session.calls) == 1
    sent = fake_session.calls[0]["data"]
    assert sent["grant_type"] == "client_credentials" and sent["client_id"] == "cid"
    now[0] = NOW + timedelta(seconds=5000 - 60)  # dentro da margem de renovação
    assert auth.get_token() == "b"


def test_token_loaded_from_store(fake_session, repos):
    store = repos["settings"]
    store.save_cached_token("persisted", NOW + timedelta(days=30))
    assert make_auth(fake_session, store=store).get_token() == "persisted"
    assert fake_session.calls == []


def test_invalid_credentials(fake_session):
    fake_session.add("POST", TOKEN_URL, FakeResponse(403, {"message": "invalid client secret"}))
    with pytest.raises(TwitchAuthError, match="inválidos"):
        make_auth(fake_session).get_token()


def test_network_error(fake_session):
    fake_session.add("POST", TOKEN_URL, requests.ConnectionError("down"))
    with pytest.raises(TwitchNetworkError):
        make_auth(fake_session).get_token()


def test_validate(fake_session):
    fake_session.add("POST", TOKEN_URL, token_resp())
    fake_session.add("GET", VALIDATE_URL, FakeResponse(200, {"client_id": "cid", "expires_in": 5000}))
    assert make_auth(fake_session).validate()["client_id"] == "cid"
    assert fake_session.calls[-1]["headers"]["Authorization"] == "OAuth tok1"


def stream(login, sid="s1", viewers=100):
    return {
        "id": sid, "user_id": f"id_{login}", "user_login": login, "user_name": login.title(),
        "title": "Jogando", "game_name": "Valorant", "viewer_count": viewers,
        "started_at": "2026-11-18T10:00:00Z", "type": "live",
    }


def test_get_live_streams_batches_by_100(fake_session):
    fake_session.add("POST", TOKEN_URL, token_resp())
    fake_session.add("GET", f"{HELIX_URL}/streams", FakeResponse(200, {"data": [stream("canal_0")]}))
    client = HelixClient(make_auth(fake_session))
    logins = [f"canal_{i}" for i in range(150)]
    result = client.get_live_streams(logins)
    helix_calls = [c for c in fake_session.calls if c["url"].endswith("/streams")]
    assert len(helix_calls) == 2
    assert sum(1 for k, _ in helix_calls[0]["params"] if k == "user_login") == 100
    assert helix_calls[0]["headers"]["Client-Id"] == "cid"
    assert result["canal_0"].viewer_count == 100
    assert result["canal_0"].started_at == datetime(2026, 11, 18, 10, tzinfo=timezone.utc)


def test_401_triggers_single_token_refresh(fake_session):
    fake_session.add("POST", TOKEN_URL, token_resp("old"), token_resp("new"))
    fake_session.add("GET", f"{HELIX_URL}/users",
                     FakeResponse(401, {}),
                     FakeResponse(200, {"data": [{"id": "1", "login": "abc", "display_name": "ABC"}]}))
    users = HelixClient(make_auth(fake_session)).get_users(["ABC"])
    assert users[0].display_name == "ABC"
    user_calls = [c for c in fake_session.calls if c["url"].endswith("/users")]
    assert user_calls[1]["headers"]["Authorization"] == "Bearer new"


def test_rate_limit(fake_session):
    fake_session.add("POST", TOKEN_URL, token_resp())
    fake_session.add("GET", f"{HELIX_URL}/streams", FakeResponse(429, {}, {"Ratelimit-Reset": "1900000000"}))
    with pytest.raises(TwitchRateLimitError) as info:
        HelixClient(make_auth(fake_session)).get_live_streams(["abc"])
    assert info.value.reset_at == 1900000000.0
