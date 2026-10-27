import { describe, expect, it } from "vitest";
import { parseMusicUrl, parseYouTubeId } from "@/lib/music";

describe("parseMusicUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=43", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=x", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ?start=10", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("YouTube: %s", (url, id) => {
    const r = parseMusicUrl(url);
    expect(r?.provider).toBe("youtube");
    expect(r?.mediaId).toBe(id);
  });

  it("extrai o segundo inicial do YouTube", () => {
    expect(parseMusicUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toMatchObject({ startAt: 90 });
    expect(parseMusicUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43")).toMatchObject({ startAt: 43 });
  });

  it.each([
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "track"],
    ["https://open.spotify.com/intl-pt/track/4cOdK2wGLETKBW3PvgPWqT?si=abc", "track"],
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "playlist"],
    ["spotify:album:4aawyAB9vmqN3uQ7FjRGTy", "album"],
  ])("Spotify: %s", (url, type) => {
    const r = parseMusicUrl(url);
    expect(r?.provider).toBe("spotify");
    expect(r && r.provider === "spotify" ? r.spotifyType : null).toBe(type);
  });

  it.each(["", "https://vimeo.com/123", "https://www.youtube.com/watch?v=curto", "javascript:alert(1)", "https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT", "https://evil.com/?v=dQw4w9WgXcQ"])("rejeita %s", (url) => {
    expect(parseMusicUrl(url)).toBeNull();
  });

  it("parseYouTubeId só aceita YouTube", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")).toBeNull();
  });
});
