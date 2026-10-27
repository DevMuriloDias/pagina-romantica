// Tipos mínimos da YouTube IFrame Player API.
declare namespace YT {
  interface PlayerOptions {
    videoId: string;
    width?: number | string;
    height?: number | string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (e: { target: Player }) => void;
      onStateChange?: (e: { data: number; target: Player }) => void;
      onError?: (e: { data: number }) => void;
    };
  }
  class Player {
    constructor(el: HTMLElement | string, opts: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): number;
    destroy(): void;
  }
}
interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
