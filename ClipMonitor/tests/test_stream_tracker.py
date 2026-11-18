from datetime import datetime, timedelta, timezone

from models.events import StreamEventType
from models.live_status import StreamInfo
from models.streamer import Streamer
from monitoring.stream_tracker import observe

T0 = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)


def info(sid="s1", title="Título", game="Valorant", viewers=10, started=T0 - timedelta(minutes=5)):
    return StreamInfo(sid, "u1", "canal", "Canal", title, game, viewers, started)


def offline_streamer():
    return Streamer(id=1, login="canal", display_name="Canal", authorized=True)


def types(obs):
    return [e.type for e in obs.events]


def test_offline_to_online():
    obs = observe(offline_streamer(), info(), T0)
    assert types(obs) == [StreamEventType.ONLINE]
    assert obs.state.is_live and obs.state.stream_id == "s1"
    assert obs.state.live_since == T0 - timedelta(minutes=5)  # início real informado pela Twitch
    assert obs.state.last_seen_live_at == T0
    assert [a.kind for a in obs.actions] == ["open"]


def test_offline_stays_offline_without_events():
    obs = observe(offline_streamer(), None, T0)
    assert obs.events == [] and obs.actions == [] and not obs.state.is_live


def test_grace_period_before_offline():
    live = observe(offline_streamer(), info(), T0).state
    miss1 = observe(live, None, T0 + timedelta(minutes=1), grace=2)
    assert miss1.events == [] and miss1.state.is_live and miss1.state.offline_misses == 1
    miss2 = observe(miss1.state, None, T0 + timedelta(minutes=2), grace=2)
    assert types(miss2) == [StreamEventType.OFFLINE]
    assert not miss2.state.is_live and miss2.state.offline_misses == 0
    # Fim datado pela última vez em que a live foi vista, não pela confirmação.
    assert miss2.actions[0].kind == "close" and miss2.actions[0].ended_at == T0


def test_blip_recovers_without_events():
    live = observe(offline_streamer(), info(), T0).state
    miss = observe(live, None, T0 + timedelta(minutes=1), grace=3).state
    back = observe(miss, info(), T0 + timedelta(minutes=2), grace=3)
    assert back.events == [] and back.state.offline_misses == 0
    assert [a.kind for a in back.actions] == ["touch"]


def test_grace_one_is_immediate():
    live = observe(offline_streamer(), info(), T0).state
    assert types(observe(live, None, T0, grace=1)) == [StreamEventType.OFFLINE]


def test_title_and_game_changes():
    live = observe(offline_streamer(), info(), T0).state
    obs = observe(live, info(title="Novo título", game="Just Chatting"), T0 + timedelta(minutes=1))
    assert types(obs) == [StreamEventType.TITLE_CHANGED, StreamEventType.GAME_CHANGED]
    assert obs.events[1].game_name == "Just Chatting"


def test_new_stream_id_is_restart():
    live = observe(offline_streamer(), info(sid="a"), T0).state
    obs = observe(live, info(sid="b", started=T0 + timedelta(minutes=3)), T0 + timedelta(minutes=4))
    assert types(obs) == [StreamEventType.OFFLINE, StreamEventType.ONLINE]
    assert obs.events[0].stream_id == "a" and obs.events[1].stream_id == "b"
    assert [a.kind for a in obs.actions] == ["close", "open"]
    assert obs.state.live_since == T0 + timedelta(minutes=3)
