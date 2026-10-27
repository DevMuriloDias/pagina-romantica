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
            if (e.data === 1) setBlocked(false);
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

  const pos = contained ? "absolute" : "fixed";

  if (music.provider === "spotify") {
    return (
      <div className={cn(pos, "bottom-4 right-4 z-50 flex flex-col items-end gap-2")}>
        {spotifyOpen ? (
          <iframe
            title="Música no Spotify"
            src={`https://open.spotify.com/embed/${music.spotifyType}/${music.mediaId}?utm_source=generator&theme=0`}
            width="300"
            height="152"
            className="rounded-xl shadow-2xl"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setSpotifyOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
          aria-expanded={spotifyOpen}
        >
          <span aria-hidden>🎵</span> {spotifyOpen ? "Esconder música" : "Ouvir nossa música"}
        </button>
      </div>
    );
  }

  return (
    <div className={cn(pos, "bottom-4 right-4 z-50")}>
      {/* player real, invisível (controlado pela API) */}
      <div ref={host} className="pointer-events-none absolute bottom-0 right-0 size-px overflow-hidden opacity-0" aria-hidden />
      <div className={cn("flex items-center gap-1 rounded-full bg-black/70 p-1 pl-3 text-white shadow-lg backdrop-blur", blocked && "animate-pulse")}>
        <span className={cn("mr-1 text-sm", playing && "motion-safe:animate-spin [animation-duration:3s]")} aria-hidden>
          ♫
        </span>
        <span className="max-w-28 truncate text-xs opacity-80">{music.title || "Nossa música"}</span>
        <button
          type="button"
          onClick={() => {
            if (playing) player.current?.pauseVideo();
            else play();
          }}
          className="flex size-8 items-center justify-center rounded-full hover:bg-white/15"
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
          className="flex size-8 items-center justify-center rounded-full hover:bg-white/15"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
});
