export type ParsedMusic =
  | { provider: "youtube"; mediaId: string; startAt?: number }
  | { provider: "spotify"; mediaId: string; spotifyType: "track" | "album" | "playlist" | "episode" };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

function parseTime(t: string | null): number | undefined {
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Valida links do YouTube e do Spotify e extrai o ID. Retorna null se inválido. */
export function parseMusicUrl(raw: string): ParsedMusic | null {
  const input = raw.trim();
  if (!input) return null;

  const spotifyUri = input.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]{22})$/);
  if (spotifyUri) return { provider: "spotify", spotifyType: spotifyUri[1] as "track", mediaId: spotifyUri[2]! };

  let url: URL;
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return YT_ID.test(id) ? { provider: "youtube", mediaId: id, startAt: parseTime(url.searchParams.get("t")) } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = url.searchParams.get("v") ?? "";
    const path = url.pathname.split("/").filter(Boolean);
    if (!id && ["embed", "shorts", "live", "v"].includes(path[0] ?? "")) id = path[1] ?? "";
    if (!YT_ID.test(id)) return null;
    return { provider: "youtube", mediaId: id, startAt: parseTime(url.searchParams.get("t") ?? url.searchParams.get("start")) };
  }
  if (host === "open.spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    // aceita /intl-pt/track/ID e /embed/track/ID
    const idx = parts.findIndex((p) => ["track", "album", "playlist", "episode"].includes(p));
    const type = parts[idx] as "track" | "album" | "playlist" | "episode" | undefined;
    const id = parts[idx + 1] ?? "";
    if (idx === -1 || !type || !SPOTIFY_ID.test(id)) return null;
    return { provider: "spotify", spotifyType: type, mediaId: id };
  }
  return null;
}

/** Vídeos (seção Vídeo) aceitam apenas YouTube. */
export function parseYouTubeId(raw: string): string | null {
  const p = parseMusicUrl(raw);
  return p?.provider === "youtube" ? p.mediaId : null;
}
