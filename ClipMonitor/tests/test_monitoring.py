import threading
from datetime import datetime, timedelta, timezone

import pytest

from models.events import StreamEventType
from models.live_status import StreamInfo, TwitchUser
from models.status import MonitorState
from models.streamer import Streamer
from monitoring.events import EventBus
from monitoring.live_checker import LiveStatusChecker
from twitch.errors import TwitchAuthError, TwitchNetworkError
from workers.monitoring_worker import MonitoringWorker

NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)


class Clock:
    def __init__(self, t=NOW):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += timedelta(seconds=seconds)


class FakeHelix:
    def __init__(self):
        self.live: dict[str, StreamInfo] = {}
        self.users_called = 0
        self.stream_queries: list[list[str]] = []

    def get_users(self, logins):
        self.users_called += 1
        return [TwitchUser(f"id_{l}", l, l.upper()) for l in logins]

    def get_live_streams(self, logins):
        logins = list(logins)
        self.stream_queries.append(sorted(logins))
        return {l: self.live[l] for l in logins if l in self.live}


def info(login, sid="100", viewers=50, title="Título"):
    return StreamInfo(sid, f"id_{login}", login, login.upper(), title, "Just Chatting", viewers, NOW)


def make_checker(repos, clock=None, bus=None, interval=60, grace=1):
    return LiveStatusChecker(
        repos["streamers"], repos["sessions"], repos["activity"], repos["events"], bus or EventBus(),
        default_interval=lambda: interval, grace_checks=lambda: grace, clock=clock or Clock(),
    )


def test_checker_detects_start_and_end_and_persists_events(repos):
    repo = repos["streamers"]
    a = repo.add(Streamer(login="alpha", authorized=True))
    repo.add(Streamer(login="beta", authorized=True))
    repo.add(Streamer(login="gamma", authorized=False, monitoring_enabled=False))
    helix, bus, received = FakeHelix(), EventBus(), []
    bus.subscribe(received.append)
    checker = make_checker(repos, bus=bus)

    helix.live["alpha"] = info("alpha")
    r1 = checker.check(helix, force=True)
    assert (r1.checked, r1.live, r1.went_online) == (2, 1, ("ALPHA",))
    alpha = repo.get(a.id)
    assert alpha.is_live and alpha.twitch_user_id == "id_alpha" and alpha.last_checked_at == NOW
    assert [e.type for e in received] == [StreamEventType.ONLINE]
    assert received[0].id is not None  # publicado após persistir

    helix.live["alpha"] = info("alpha", viewers=500)
    assert checker.check(helix, force=True).went_online == ()
    assert helix.users_called == 1
    assert repos["sessions"].list_for_streamer(a.id)[0].peak_viewers == 500

    helix.live.clear()
    assert checker.check(helix, force=True).went_offline == ("ALPHA",)
    assert not repo.get(a.id).is_live
    assert repos["sessions"].list_for_streamer(a.id)[0].ended_at == NOW
    stored = repos["events"].recent()
    assert [e.type for e in stored] == [StreamEventType.OFFLINE, StreamEventType.ONLINE]
    assert stored[0].streamer_name == "ALPHA"


def test_grace_keeps_stream_live_through_blip(repos):
    a = repos["streamers"].add(Streamer(login="alpha", authorized=True))
    helix = FakeHelix()
    checker = make_checker(repos, grace=2)
    helix.live["alpha"] = info("alpha")
    checker.check(helix, force=True)
    helix.live.clear()
    r = checker.check(helix, force=True)
    assert r.went_offline == () and repos["streamers"].get(a.id).offline_misses == 1
    helix.live["alpha"] = info("alpha")
    checker.check(helix, force=True)
    assert repos["streamers"].get(a.id).offline_misses == 0
    assert len(repos["sessions"].list_for_streamer(a.id)) == 1


def test_scheduling_respects_per_streamer_intervals(repos):
    clock = Clock()
    repos["streamers"].add(Streamer(login="fast", authorized=True, check_interval_seconds=30))
    repos["streamers"].add(Streamer(login="slow", authorized=True, check_interval_seconds=300))
    repos["streamers"].add(Streamer(login="dflt", authorized=True))  # usa o global (60 s)
    helix = FakeHelix()
    checker = make_checker(repos, clock=clock, interval=60)

    assert checker.next_due() == NOW  # nunca verificados: vencidos já
    checker.check(helix)
    assert helix.stream_queries[-1] == ["dflt", "fast", "slow"]
    assert checker.next_due() == NOW + timedelta(seconds=30)

    clock.advance(30)
    checker.check(helix)
    assert helix.stream_queries[-1] == ["fast"]

    clock.advance(25)  # t=55: "dflt" e "fast" vencem em 5 s — agrupados numa só requisição
    checker.check(helix)
    assert helix.stream_queries[-1] == ["dflt", "fast"]

    clock.advance(1)  # nada vencido: nenhuma requisição
    n = len(helix.stream_queries)
    assert checker.check(helix).checked == 0
    assert len(helix.stream_queries) == n

    assert checker.check(helix, force=True).checked == 3


def test_new_stream_id_counts_as_new_session(repos):
    a = repos["streamers"].add(Streamer(login="alpha", authorized=True))
    helix = FakeHelix()
    checker = make_checker(repos)
    helix.live["alpha"] = info("alpha", sid="1")
    checker.check(helix, force=True)
    helix.live["alpha"] = info("alpha", sid="2")
    r = checker.check(helix, force=True)
    assert r.went_online == ("ALPHA",) and r.went_offline == ("ALPHA",)
    assert len(repos["sessions"].list_for_streamer(a.id)) == 2


def test_event_bus_isolates_failing_subscribers():
    bus = EventBus()
    got = []

    def bad(_e):
        raise RuntimeError("x")

    bus.subscribe(bad)
    unsubscribe = bus.subscribe(got.append, StreamEventType.ONLINE)
    from models.events import StreamEvent

    e_on = StreamEvent(StreamEventType.ONLINE, 1, "A", NOW)
    e_off = StreamEvent(StreamEventType.OFFLINE, 1, "A", NOW)
    bus.publish(e_on)
    bus.publish(e_off)
    assert got == [e_on]
    unsubscribe()
    bus.publish(e_on)
    assert got == [e_on]


# ---------------------------------------------------------------- worker

def wait_for(predicate, timeout=5.0):
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def test_worker_runs_reports_status_and_stops(repos):
    repos["streamers"].add(Streamer(login="alpha", authorized=True))
    results, statuses = [], []
    got = threading.Event()
    worker = MonitoringWorker(make_checker(repos, interval=3600), lambda: FakeHelix(),
                              on_status=statuses.append, on_result=lambda r: (results.append(r), got.set()))
    worker.start()
    assert got.wait(5)
    assert wait_for(lambda: worker.status.state is MonitorState.IDLE)
    st = worker.status
    assert st.checks_done == 1 and st.last_checked == 1 and st.next_check_at is not None
    worker.stop()
    assert not worker.running and worker.status.state is MonitorState.STOPPED
    assert MonitorState.CHECKING in [s.state for s in statuses]


def test_worker_trigger_now_force_checks_everything(repos):
    repos["streamers"].add(Streamer(login="alpha", authorized=True))
    helix = FakeHelix()
    count = []
    worker = MonitoringWorker(make_checker(repos, interval=3600), lambda: helix,
                              on_result=lambda r: count.append(r.checked))
    worker.start()
    assert wait_for(lambda: len(count) == 1)
    worker.trigger_now(force=True)
    assert wait_for(lambda: len(count) == 2)
    worker.stop()
    assert count == [1, 1]


def test_worker_backoff_on_network_error(repos):
    class Broken(FakeHelix):
        def get_users(self, logins):
            raise TwitchNetworkError("sem internet")

    repos["streamers"].add(Streamer(login="alpha", authorized=True))
    got = threading.Event()
    worker = MonitoringWorker(make_checker(repos, interval=60), lambda: Broken(), on_result=lambda r: got.set())
    worker.start()
    assert got.wait(5)
    assert wait_for(lambda: worker.status.state is MonitorState.BACKOFF)
    st = worker.status
    assert worker.running and st.last_error == "sem internet" and st.consecutive_failures == 1
    assert (st.next_check_at - datetime.now(timezone.utc)).total_seconds() > 100  # 60 s * 2
    worker.stop()


def test_worker_error_state_without_credentials(repos):
    got = threading.Event()
    worker = MonitoringWorker(make_checker(repos), lambda: None, on_result=lambda r: got.set())
    worker.start()
    assert got.wait(5)
    assert wait_for(lambda: worker.status.state is MonitorState.ERROR)
    worker.stop()
    with pytest.raises(TwitchAuthError):
        worker.check_now()
