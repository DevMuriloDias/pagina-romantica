from datetime import datetime, timedelta, timezone

from config.settings import AppSettings
from utils import secrets
from utils.timeutils import format_duration, format_relative, format_viewers, from_iso, to_iso
from workers.task_runner import TaskRunner, UiDispatcher


def test_secret_roundtrip():
    assert secrets.unprotect(secrets.protect("abc123")) == "abc123"
    assert secrets.protect("") == "" and secrets.unprotect("") == ""


def test_iso_roundtrip():
    dt = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    assert from_iso(to_iso(dt)) == dt
    assert from_iso("2026-01-02T03:04:05Z") == dt


def test_formatters():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    assert format_relative(None) == "nunca"
    assert format_relative(now - timedelta(minutes=5), now) == "há 5 min"
    assert format_duration(3725) == "1h 02min"
    assert format_viewers(15300) == "15,3 mil"
    assert format_viewers(None) == "—"


def test_settings_normalized_limits():
    s = AppSettings(poll_interval_seconds=999999, max_parallel_jobs=10, clip_duration_seconds=1).normalized()
    assert (s.poll_interval_seconds, s.max_parallel_jobs, s.clip_duration_seconds) == (3600, 4, 10)


def test_task_runner_posts_results_to_dispatcher():
    dispatcher = UiDispatcher()
    runner = TaskRunner(dispatcher)
    out = []
    runner.submit(lambda: 42, on_success=out.append).result()
    fut = runner.submit(lambda: (_ for _ in ()).throw(ValueError("x")), on_error=lambda e: out.append(str(e)))
    try:
        fut.result()
    except ValueError:
        pass
    runner.shutdown()
    # Callbacks só rodam quando o thread da UI drena a fila.
    import time
    deadline = time.time() + 2
    while len(out) < 2 and time.time() < deadline:
        dispatcher.pump()
    assert sorted(map(str, out)) == ["42", "x"]
