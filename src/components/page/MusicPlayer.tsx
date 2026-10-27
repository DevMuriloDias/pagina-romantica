"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MusicConfig } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

export interface MusicHandle {
  /** Deve ser chamado dentro de um gesto do usuário (clique na tela de entrada). */
  play: () => void;
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * Player de música flutuante.
 * - YouTube: IFrame Player API; toca após o clique na tela de entrada (o clique libera o autoplay com som).
 * - Spotify: embed oficial. O Spotify NÃO permite autoplay e, para quem não está logado,
 *   toca apenas uma prévia de 30s — por isso o editor recomenda YouTube quando o autoplay importa.
 */
export const MusicPlayer = forwardRef<MusicHandle, { music: MusicConfig; contained?: boolean }>(function MusicPlayer({ music, contained }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YT.Player | null>(null);
  const ready = useRef(false);
  const pending = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [volumeHint, setVolumeHint] = useState(false);
  const hintShown = useRef(false);

  const isYT = music.provider === "youtube" && Boolean(music.mediaId);

  useEffect(() => {
    if (!isYT || !host.current) return;
    let disposed = false;
    const el = document.createElement("div");
    host.current.appendChild(el);
    loadYouTubeApi().then(() => {
      if (disposed || !window.YT) return;
      player.current = new window.YT.Player(el, {
        videoId: music.mediaId,
        width: 200,
        height: 200,
        playerVars: {
          autoplay: 0,
          controls: 0,
          playsinline: 1,
          rel: 0,
          start: music.startAt || 0,
          loop: music.loop ? 1 : 0,
          ...(music.loop ? { playlist: music.mediaId } : {}),
        },
        events: {
          onReady: () => {
            ready.current = true;
            if (pending.current) {
              pending.current = false;
              player.current?.unMute();
              player.current?.playVideo();
              // se o navegador bloquear, mostramos o botão de play
              setTimeout(() => player.current && player.current.getPlayerState() !== 1 && setBlocked(true), 1500);
            }
          },
          onStateChange: (e) => {
            setPlaying(e.data === 1);
            if (e.data === 1) {
              setBlocked(false);
              // lembrete de volume na primeira vez que a música começa
              if (!hintShown.current) {
                hintShown.current = true;
                setVolumeHint(true);
                setTimeout(() => setVolumeHint(false), 6000);
              }
            }
            if (e.data === 0 && music.loop) {
              player.current?.seekTo(music.startAt || 0, true);
              player.current?.playVideo();
            }
          },
        },
      });
    });
    return () => {
      disposed = true;
      ready.current = false;
      player.current?.destroy();
      player.current = null;
      el.remove();
    };
  }, [isYT, music.mediaId, music.startAt, music.loop]);

  const play = useCallback(() => {
    if (!isYT) return;
    if (ready.current && player.current) {
      player.current.unMute();
      player.current.playVideo();
      setMuted(false);
    } else pending.current = true;
  }, [isYT]);

  useImperativeHandle(ref, () => ({ play }), [play]);

  if (music.provider === "none" || !music.mediaId) return null;

  // respeita o entalhe/área segura de celulares (e a moldura do preview)
  const barTop = { top: contained ? 44 : "max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))" };

  // Barra fixa no topo da página (sticky, sem empurrar o conteúdo): a pessoa vê tudo enquanto a música toca.
  if (music.provider === "spotify") {
    return (
      <div className="pointer-events-none sticky top-0 z-[50] h-0">
        <div className="absolute inset-x-0 flex flex-col items-center gap-2 px-3" style={barTop}>
          <button
            type="button"
            onClick={() => setSpotifyOpen((o) => !o)}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
            aria-expanded={spotifyOpen}
          >
            <span aria-hidden>🎵</span> {spotifyOpen ? "Esconder música" : `Ouvir: ${music.title || "nossa música"}`}
          </button>
          {spotifyOpen ? (
            <iframe
              title="Música no Spotify"
              src={`https://open.spotify.com/embed/${music.spotifyType}/${music.mediaId}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              className="pointer-events-auto max-w-sm rounded-xl shadow-2xl"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none sticky top-0 z-[50] h-0">
      {/* player real, invisível (controlado pela API) */}
      <div ref={host} className="absolute left-0 top-0 size-px overflow-hidden opacity-0" aria-hidden />
      <div className="absolute inset-x-0 flex flex-col items-center gap-2 px-3" style={barTop}>
        <div className={cn("pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-black/70 p-1 pl-3 text-white shadow-lg backdrop-blur", blocked && "ring-2 ring-white/80 motion-safe:animate-pulse")}>
          <Equalizer playing={playing} />
          <span className="ml-1 max-w-40 truncate text-xs opacity-90">{blocked ? "Toque para ouvir a música" : music.title || "Nossa música"}</span>
          <button
            type="button"
            onClick={() => {
              if (playing) player.current?.pauseVideo();
              else play();
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
            aria-label={playing ? "Pausar música" : "Tocar música"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!player.current) return;
              if (muted) player.current.unMute();
              else player.current.mute();
              setMuted(!muted);
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
        {volumeHint ? (
          <div role="status" className="pointer-events-auto rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-800 shadow-md motion-safe:animate-bounce">
            🔊 Aumente o volume para ouvir a nossa música
          </div>
        ) : null}
      </div>
    </div>
  );
});

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white"
          style={{
            height: playing ? undefined : "30%",
            animation: playing ? `eq 0.${8 + i}s ease-in-out ${i * 0.15}s infinite alternate` : undefined,
          }}
        />
      ))}
    </span>
  );
}
