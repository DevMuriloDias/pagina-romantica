import pytest

from models.live_status import TwitchUser
from models.streamer import Streamer
from services.streamer_service import StreamerService, ValidationError, normalize_login
from twitch.errors import TwitchNetworkError


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Gaules", "gaules"),
        ("  @Casimiro  ", "casimiro"),
        ("https://www.twitch.tv/LOUD_Coringa", "loud_coringa"),
        ("twitch.tv/baiano?sr=a", "baiano"),
        ("https://m.twitch.tv/xqc/", "xqc"),
    ],
)
def test_normalize_login(raw, expected):
    assert normalize_login(raw) == expected


@pytest.mark.parametrize("raw", ["", "  ", "ab", "nome com espaço", "a" * 26, "ação"])
def test_normalize_login_rejects_invalid(raw):
    with pytest.raises(ValidationError):
        normalize_login(raw)


class FakeHelix:
    def __init__(self, users=None, error=None):
        self.users = users or {}
        self.error = error

    def get_user(self, login):
        if self.error:
            raise self.error
        return self.users.get(login)


def make_service(repos, helix=None):
    return StreamerService(repos["streamers"], repos["activity"], helix_provider=lambda: helix)


def test_add_requires_authorization_to_monitor(repos):
    svc = make_service(repos)
    with pytest.raises(ValidationError):
        svc.add(Streamer(login="canal_x", authorized=False, monitoring_enabled=True))
    s = svc.add(Streamer(login="canal_x", authorized=False, monitoring_enabled=False))
    assert not s.is_monitorable


def test_add_enriches_from_twitch(repos):
    helix = FakeHelix({"canal_x": TwitchUser("123", "canal_x", "Canal_X", "http://img")})
    s = make_service(repos, helix).add(Streamer(login="twitch.tv/Canal_X", authorized=True))
    assert (s.login, s.twitch_user_id, s.display_name) == ("canal_x", "123", "Canal_X")
    assert repos["activity"].recent()[0]["message"].startswith("Streamer Canal_X adicionado")


def test_add_unknown_channel_fails_when_verifying(repos):
    with pytest.raises(ValidationError, match="não foi encontrado"):
        make_service(repos, FakeHelix()).add(Streamer(login="nao_existe", authorized=True))


def test_add_works_offline_when_twitch_unreachable(repos):
    helix = FakeHelix(error=TwitchNetworkError("offline"))
    s = make_service(repos, helix).add(Streamer(login="sem_rede", authorized=True))
    assert s.id and s.twitch_user_id is None


def test_update_changing_login_reverifies(repos):
    helix = FakeHelix({
        "antigo": TwitchUser("1", "antigo", "Antigo"),
        "novo_nome": TwitchUser("2", "novo_nome", "NovoNome"),
    })
    svc = make_service(repos, helix)
    s = svc.add(Streamer(login="antigo", authorized=True))
    s.login = "novo_nome"
    s.display_name = ""
    updated = svc.update(s)
    assert updated.twitch_user_id == "2"


def test_set_monitoring_blocked_without_authorization(repos):
    svc = make_service(repos)
    s = svc.add(Streamer(login="pausado", authorized=False, monitoring_enabled=False))
    with pytest.raises(ValidationError):
        svc.set_monitoring(s.id, True)


def test_remove(repos):
    svc = make_service(repos)
    s = svc.add(Streamer(login="tchau", authorized=True))
    svc.remove(s.id)
    assert svc.get(s.id) is None
