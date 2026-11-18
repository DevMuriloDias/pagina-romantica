# ClipMonitor

Personal Windows desktop app that monitors **authorized** Twitch streamers and (in later phases)
turns their best moments into vertical 9:16 clips with Portuguese subtitles.
Local, single-user, free/open-source stack. UI is in Brazilian Portuguese.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Project structure, SQLite, desktop UI, streamer management, Twitch auth + live status | ✅ done |
| 2 — Monitoring | Background monitoring worker, stream start/end events, per-streamer intervals, status indicators, persistent job queue | ✅ done |
| 3 — Detection | Authorized capture (Streamlink → FFmpeg segments), audio analysis, Silero VAD, intensity changes, local Whisper transcription, moment scoring, non-overlapping selection | ✅ done |
| 4 — Clips | 9:16 render, PT-BR burned-in subtitles (from the word timings already stored), clip library | planned |

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

You also need **FFmpeg** (full build, includes `ffplay` for previews): download from
<https://www.gyan.dev/ffmpeg/builds/>, extract, and add its `bin` folder to `PATH`. The **Fila e
capturas** screen shows whether FFmpeg and Streamlink were found. The Whisper model (default
`small`, ~250 MB) is downloaded automatically into `data/models` the first time a moment is
transcribed.

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
capture/           Recorder (Streamlink | FFmpeg segmenter), CaptureService (authorization checks,
                   auto-capture on ONLINE, disk guard, retention)
detection/         audio decode, VAD (Silero ONNX / energy fallback), intensity features,
                   scoring, overlap-free selection, analysis + transcription job handlers
transcription/     WhisperTranscriber (faster-whisper, CPU int8, lazy load / idle unload)
video/             reserved for phase 4
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

## Detection pipeline (phase 3)

```
ONLINE event ─► CAPTURE job ─ streamlink --stdout | ffmpeg -c copy -f segment (5-min .ts)
                    │  each finished segment
                    ▼
              ANALYSIS job (per segment, + last 45 s of the previous one as context)
                decode 16 kHz mono ─► Silero VAD ─► loudness vs 60-s rolling baseline,
                sudden rises, bursts, speech ratio ─► peaks ─► windows (peak at 60 %,
                edges snapped to speech) ─► audio score ─► atomic non-overlap insert
                    │  each accepted candidate
                    ▼
              TRANSCRIPTION job (only the ~45 s window, never the whole stream)
                faster-whisper small/int8, PT ─► text score (keywords, laughter, speech pace,
                "clipa isso") ─► trim to words ─► final score ─► overlap re-check
```

- **Authorization** is checked when a capture is queued, again when it starts (it may have been
  revoked), and recorded in each recording's `metadata.json`.
- **CPU budget (i3-10100F):** capture is a stream copy (≈0 % CPU); analysis decodes audio only;
  Whisper runs only on candidate windows with 4 threads and int8, and is unloaded after 10 idle
  minutes. Captures and processing use separate job lanes.
- **Scores** are 0–100 and keep a per-feature breakdown shown in the UI. Text can only *raise* the
  audio score (a scream with no words still counts); an explicit "clipa isso" adds 10.
- **Gain-independent:** loudness is measured against the streamer's own rolling baseline.
- **No overlapping clips:** candidates are inserted inside one locked transaction; a newcomer that
  overlaps (with a configurable gap) only wins if it scores higher than every conflict; approved
  moments are never replaced; a per-hour cap keeps the best N.
- **Segment boundaries:** a segment does not emit windows for peaks in its last 40 % of a clip
  length; the next segment covers them with its context, so moments are never cut at a file edge.
  A peak must also dominate its own window, so no window "borrows" a neighbouring event's score.
- **Retention:** finished recordings are deleted after N hours, except segments that contain
  pending or approved moments. Capture stops if free disk space drops below the configured minimum.
