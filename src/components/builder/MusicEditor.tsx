"use client";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { parseMusicUrl } from "@/lib/music";
import { useBuilder } from "@/stores/builder";
import { TextField } from "./fields";
import { ToggleRow } from "./editors/simple";

function toMMSS(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fromMMSS(v: string): number {
  const m = v.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Math.min(59, Number(m[2]));
  return /^\d+$/.test(v) ? Number(v) : 0;
}

export function MusicEditor() {
  const music = useBuilder((s) => s.content.music);
  const setContent = useBuilder((s) => s.setContent);
  const set = (patch: Partial<typeof music>, key?: string) => setContent((c) => ({ ...c, music: { ...c.music, ...patch } }), key);
  const parsed = music.url ? parseMusicUrl(music.url) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">A música de vocês 🎵</h2>
        <p className="text-xs text-ink-soft">Cole o link de uma música do YouTube ou do Spotify.</p>
      </div>
      <div className="space-y-1.5">
        <Input
          value={music.url}
          placeholder="https://www.youtube.com/watch?v=... ou https://open.spotify.com/track/..."
          aria-label="Link da música"
          onChange={(e) => {
            const p = parseMusicUrl(e.target.value);
            set(
              {
                url: e.target.value,
                provider: p?.provider ?? (e.target.value ? music.provider : "none"),
                mediaId: p?.mediaId ?? "",
                ...(p?.provider === "spotify" ? { spotifyType: p.spotifyType } : {}),
                ...(p?.provider === "youtube" && p.startAt ? { startAt: p.startAt } : {}),
              },
              "music-url",
            );
          }}
        />
        {music.url && !parsed ? <Alert tone="warning">Não reconhecemos esse link. Use um link de música/vídeo do YouTube ou de faixa/playlist do Spotify.</Alert> : null}
      </div>

      {parsed?.provider === "spotify" ? (
        <Alert tone="warning">
          <strong>Atenção com o Spotify:</strong> ele não deixa a música tocar sozinha — a pessoa precisa apertar o play. E, para quem não tem conta no Spotify logada, toca só uma prévia de 30 segundos. Se você quer que a música comece assim que a página abrir, <strong>prefira um link do YouTube</strong>.
        </Alert>
      ) : null}
      {parsed?.provider === "youtube" ? <Alert tone="success">✓ YouTube: a música começa assim que seu amor tocar em “Abrir 💌”.</Alert> : null}

      {parsed ? (
        <>
          <TextField label="Nome da música (aparece no player)" value={music.title} onChange={(v, k) => set({ title: v }, k)} placeholder="Ex.: Nossa canção" />
          {parsed.provider === "youtube" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Começar em (min:seg)</p>
                <Input defaultValue={toMMSS(music.startAt)} key={music.mediaId} onBlur={(e) => set({ startAt: fromMMSS(e.target.value) })} placeholder="0:45" aria-label="Começar em" />
              </div>
              <div className="flex items-end">
                <ToggleRow label="Repetir" checked={music.loop} onChange={(v) => set({ loop: v })} />
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Pré-escuta</p>
            {parsed.provider === "youtube" ? (
              <iframe
                key={`${parsed.mediaId}-${music.startAt}`}
                className="aspect-video w-full rounded-xl"
                src={`https://www.youtube-nocookie.com/embed/${parsed.mediaId}?start=${music.startAt}&rel=0`}
                title="Pré-escuta da música"
                allow="encrypted-media; picture-in-picture"
              />
            ) : (
              <iframe className="w-full rounded-xl" height="152" src={`https://open.spotify.com/embed/${parsed.spotifyType}/${parsed.mediaId}`} title="Pré-escuta no Spotify" allow="encrypted-media" loading="lazy" />
            )}
          </div>
          <button type="button" className="text-xs text-ink-soft underline" onClick={() => set({ url: "", provider: "none", mediaId: "", title: "" })}>
            Remover música
          </button>
        </>
      ) : null}
    </div>
  );
}
