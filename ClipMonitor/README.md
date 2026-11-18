# ClipMonitor

Personal Windows desktop app that monitors **authorized** Twitch streamers and (in later phases)
turns their best moments into vertical 9:16 clips with Portuguese subtitles.
Local, single-user, free/open-source stack. UI is in Brazilian Portuguese.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Project structure, SQLite, desktop UI, streamer management, Twitch auth + live status | ✅ done |
| 2 — Monitoring | Background monitoring worker, stream start/end events, per-streamer intervals, capture/processing status indicators, persistent job queue | ✅ done |
| 3 — Capture | Streamlink capture handler (subscribes to `ONLINE` events), EventSub via WebSocket | planned |
| 4 — Detection | FFmpeg audio extraction, Silero VAD, moment scoring | planned |
| 5 — Clips | Faster-Whisper (CPU int8) PT-BR subtitles, 9:16 render, clip library + approval | planned |

## Setup (Windows 11, Python 3.11)

```powershell
cd ClipMonitor
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Then in **Configurações**:

1. Create an app at <https://dev.twitch.tv/console/apps> (OAuth Redirect URL `http://localhost`,
   category *Application Integration*, client type *Confidential*).
2. Paste the **Client ID** and **Client Secret**, click **Testar conexão**, then **Salvar alterações**.
3. Add streamers in **Streamers**. A channel can only be monitored after you tick
   *"Tenho autorização deste streamer…"*.
4. Click **Iniciar monitoramento** in the sidebar (or enable auto-start in settings).

Run the tests with `pytest` from the `ClipMonitor` folder.

## Architecture

```
main.py            entry point (logging, DPI awareness, builds context, opens UI)
config/            paths, AppSettings dataclass, theme palette
database/          SQLite connection (per-thread, WAL), versioned migrations, repositories
models/            plain dataclasses (Streamer, LiveSession, StreamInfo, …)
services/          business rules (StreamerService, TwitchService) + DI container
twitch/            TwitchAuth (client-credentials, cached/auto-refreshed token), HelixClient
monitoring/        stream_tracker (pure start/end state machine), LiveStatusChecker (one pass,
                   per-streamer scheduling), EventBus (ONLINE/OFFLINE/TITLE/GAME events)
workers/           MonitoringWorker (daemon thread, status, backoff), JobWorker (persistent
                   queue with capture/processing lanes), TaskRunner + UiDispatcher
ui/                CustomTkinter app, views and reusable widgets
capture/ detection/ transcription/ video/   reserved for phases 3–5
output/{pending,approved,rejected,thumbnails}
data/clipmonitor.db, logs/clipmonitor.log   created at runtime (git-ignored)
```

Key decisions:

- **App access token (client credentials)** is all Helix `/streams` and `/users` need: no login
  window, no local callback server. The token is cached in SQLite and refreshed on expiry or 401.
  EventSub over WebSocket requires a *user* token, so it is deferred to Phase 2 (Device Code Flow).
- **Polling** checks up to 100 channels per Helix request. Each streamer has its own due time
  (global interval, default 60 s, or a per-streamer override, min 30 s); channels due within the
  next 10 s are grouped into one request. Errors back off exponentially (max 15 min) and `429`
  honours `Ratelimit-Reset`. Changing the interval wakes the worker immediately.
- **Start/end detection** is a pure state machine (`monitoring/stream_tracker.py`). A stream is only
  declared ended after N consecutive misses (default 2, configurable) because Helix occasionally
  omits a live channel; the end time is the last time it was seen live. A new `stream_id` while live
  is treated as end + new start. Events are stored in `stream_events` and published on the
  `EventBus` after being committed — Phase 3 capture subscribes to `ONLINE` there.
- **Job queue** lives in SQLite, so it survives restarts (jobs running at shutdown become
  *Interrompida* and can be retried). Captures (I/O-bound) and processing (CPU-bound) have separate
  concurrency limits so an hours-long recording never blocks transcription. A partial unique index
  prevents duplicate active jobs (e.g. two captures of the same stream).
- **Secrets at rest**: the Client Secret and token are encrypted with Windows DPAPI (bound to your
  Windows account), without extra dependencies.
- **Threading**: Tkinter is touched only on the main thread; workers post callbacks to a queue
  drained every 80 ms.
- **Authorization gate**: monitoring is refused (in the service layer, not only the UI) for channels
  without the explicit authorization confirmation.
