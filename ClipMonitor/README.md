# ClipMonitor

Personal Windows desktop app that monitors **authorized** Twitch streamers and (in later phases)
turns their best moments into vertical 9:16 clips with Portuguese subtitles.
Local, single-user, free/open-source stack. UI is in Brazilian Portuguese.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Project structure, SQLite, desktop UI, streamer management, Twitch auth + live status, background polling | ✅ done |
| 2 — Capture | Streamlink capture, processing queue, EventSub (WebSocket + Device Code Flow) | planned |
| 3 — Detection | FFmpeg audio extraction, Silero VAD, loudness/chat-free moment scoring | planned |
| 4 — Clips | Faster-Whisper (CPU int8) PT-BR subtitles, 9:16 render, clip library + approval | planned |

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
monitoring/        LiveStatusChecker (one pass) + MonitorService (daemon thread, backoff)
workers/           TaskRunner + UiDispatcher (thread → Tk main-loop handoff)
ui/                CustomTkinter app, views and reusable widgets
capture/ detection/ transcription/ video/   reserved for phases 2–4
output/{pending,approved,rejected,thumbnails}
data/clipmonitor.db, logs/clipmonitor.log   created at runtime (git-ignored)
```

Key decisions:

- **App access token (client credentials)** is all Helix `/streams` and `/users` need: no login
  window, no local callback server. The token is cached in SQLite and refreshed on expiry or 401.
  EventSub over WebSocket requires a *user* token, so it is deferred to Phase 2 (Device Code Flow).
- **Polling** checks up to 100 channels per Helix request; default 60 s, min 30 s. Errors back off
  exponentially (max 15 min) and `429` honours `Ratelimit-Reset`.
- **Secrets at rest**: the Client Secret and token are encrypted with Windows DPAPI (bound to your
  Windows account), without extra dependencies.
- **Threading**: Tkinter is touched only on the main thread; workers post callbacks to a queue
  drained every 80 ms.
- **Authorization gate**: monitoring is refused (in the service layer, not only the UI) for channels
  without the explicit authorization confirmation.
