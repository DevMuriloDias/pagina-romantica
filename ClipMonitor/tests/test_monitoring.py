import threading
from datetime import datetime, timezone

from models.live_status import StreamInfo, TwitchUser
from models.streamer import Streamer
from monitoring.live_checker import LiveStatusChecker
from monitoring.monitor import MonitorService
from twitch.errors import TwitchNetworkError

NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)


class FakeHelix:
    def __init__(self):
        self.live: dict[str, StreamInfo] = {}
        self.users_called = 0

    def get_users(self, logins):
        self.users_called += 1
        return [TwitchUser(f"id_{l}", l, l.upper()) for l in logins]

    def get_live_streams(self, logins):
        return {l: self.live[l] for l in logins if l in self.live}


def info(login, sid="100", viewers=50):
    return StreamInfo(sid, f"id_{login}", login, login.upper(), "Título", "Just Chatting", viewers, NOW)


def make_checker(repos):
    return LiveStatusChecker(repos["streamers"], repos["sessions"], repos["activity"], clock=lambda: NOW)


def test_checker_transitions(repos):
    repo = repos["streamers"]
    a = repo.add(Streamer(login="alpha", authorized=True))
    repo.add(Streamer(login="beta", authorized=True))
    repo.add(Streamer(login="gamma", authorized=False, monitoring_enabled=False))
    helix = FakeHelix()
    checker = make_checker(repos)

    helix.live["alpha"] = info("alpha")
    r1 = checker.check(helix)
    assert (r1.checked, r1.live, r1.went_online) == (2, 1, ("ALPHA",))
    alpha = repo.get(a.id)
    assert alpha.is_live and alpha.twitch_user_id == "id_alpha" and alpha.last_checked_at == NOW

    helix.live["alpha"] = info("alpha", viewers=500)
    r2 = checker.check(helix)
    assert r2.went_online == ()
    assert helix.users_called == 1  # identidade já resolvida
    assert repos["sessions"].list_for_streamer(a.id)[0].peak_viewers == 500

    helix.live.clear()
    r3 = checker.check(helix)
    assert r3.went_offline == ("ALPHA",)
    assert not repo.get(a.id).is_live
    session = repos["sessions"].list_for_streamer(a.id)[0]
    assert session.ended_at == NOW


def test_checker_new_stream_id_counts_as_new_session(repos):
    a = repos["streamers"].add(Streamer(login="alpha", authorized=True))
    helix = FakeHelix()
    checker = make_checker(repos)
    helix.live["alpha"] = info("alpha", sid="1")
    checker.check(helix)
    helix.live["alpha"] = info("alpha", sid="2")
    assert checker.check(helix).went_online == ("ALPHA",)
    assert len(repos["sessions"].list_for_streamer(a.id)) == 2


def test_checker_no_targets(repos):
    assert make_checker(repos).check(FakeHelix()).checked == 0


def test_monitor_loop_runs_and_stops(repos):
    repos["streamers"].add(Streamer(login="alpha", authorized=True))
    results, got = [], threading.Event()

    def on_result(r):
        results.append(r)
        got.set()

    states = []
    monitor = MonitorService(make_checker(repos), lambda: FakeHelix(), lambda: 3600,
                             on_result=on_result, on_state=states.append)
    monitor.start()
    assert got.wait(5)
    monitor.stop()
    assert not monitor.running
    assert results[0].checked == 1 and results[0].error is None
    assert states == [True, False]


def test_monitor_reports_errors_without_dying(repos):
    class Broken:
        def get_users(self, logins):
            raise TwitchNetworkError("sem internet")

        get_live_streams = get_users

    repos["streamers"].add(Streamer(login="alpha", authorized=True))
    got = threading.Event()
    results = []
    monitor = MonitorService(make_checker(repos), lambda: Broken(), lambda: 3600,
                             on_result=lambda r: (results.append(r), got.set()))
    monitor.start()
    assert got.wait(5)
    assert monitor.running
    monitor.stop()
    assert results[0].error == "sem internet"


def test_check_once_without_credentials(repos):
    import pytest

    from twitch.errors import TwitchAuthError

    monitor = MonitorService(make_checker(repos), lambda: None, lambda: 60)
    with pytest.raises(TwitchAuthError):
        monitor.check_once()
