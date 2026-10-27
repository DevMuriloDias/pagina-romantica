import type { PageContent } from "./content/schema";
import { sectionRegistry } from "./sections/registry";
import { parseLocalDateTime } from "./time";

export interface CheckItem {
  ok: boolean;
  level: "ok" | "warn" | "info";
  text: string;
}

/** Checklist da revisão final: o que foi preenchido e o que merece atenção. */
export function reviewChecklist(c: PageContent): CheckItem[] {
  const items: CheckItem[] = [];
  const visible = c.sections.filter((s) => s.visible);
  const photos = visible.reduce((n, s) => n + (s.type === "photos" ? s.data.photos.length : 0), 0);
  const letters = visible.flatMap((s) => (s.type === "letters" ? s.data.letters : []));
  const hero = visible.find((s) => s.type === "hero");

  items.push(c.meta.recipientName ? { ok: true, level: "ok", text: `Página para ${c.meta.recipientName}` } : { ok: false, level: "warn", text: "Você ainda não disse o nome do seu amor (aparece na capa e na entrada)." });
  items.push(hero && hero.type === "hero" && hero.data.title.trim() ? { ok: true, level: "ok", text: "Capa com título" } : { ok: false, level: "warn", text: "A capa está sem título." });
  items.push(letters.some((l) => l.body.trim()) ? { ok: true, level: "ok", text: `${letters.length} carta(s)` } : { ok: false, level: "warn", text: "Nenhuma carta escrita ainda — é a parte que mais emociona 💌" });
  if (letters.some((l) => !l.body.trim())) items.push({ ok: false, level: "warn", text: "Há carta(s) sem texto." });
  items.push(photos > 0 ? { ok: true, level: "ok", text: `${photos} foto(s)` } : { ok: false, level: "warn", text: "Você ainda não adicionou fotos." });
  items.push(c.music.provider !== "none" && c.music.mediaId ? { ok: true, level: "ok", text: `Música: ${c.music.title || (c.music.provider === "youtube" ? "YouTube" : "Spotify")}` } : { ok: false, level: "info", text: "Sem música. Uma trilha sonora deixa tudo mais emocionante 🎵" });
  if (c.gate.mode !== "none") {
    items.push(c.gate.answersCount > 0 ? { ok: true, level: "ok", text: `Tela de entrada protegida (${c.gate.mode === "password" ? "senha" : "pergunta secreta"})` } : { ok: false, level: "warn", text: "Você escolheu proteger a página, mas não salvou nenhuma resposta." });
  } else {
    items.push({ ok: true, level: "info", text: "Página sem senha (abre com um botão “Abrir 💌”)." });
  }

  for (const s of visible) {
    const label = sectionRegistry[s.type].label;
    const empty =
      (s.type === "photos" && !s.data.photos.length) ||
      (s.type === "letters" && !s.data.letters.length) ||
      (s.type === "timeline" && !s.data.events.length) ||
      (s.type === "places" && !s.data.places.length) ||
      (s.type === "reasons" && !s.data.reasons.some((r) => r.trim())) ||
      (s.type === "quiz" && !s.data.questions.length) ||
      (s.type === "coupons" && !s.data.coupons.length) ||
      (s.type === "counter" && !parseLocalDateTime(s.data.startDate)) ||
      (s.type === "countdown" && !parseLocalDateTime(s.data.targetDate)) ||
      (s.type === "sky" && (!s.data.date || s.data.lat === null)) ||
      (s.type === "video" && !s.data.url);
    if (empty) items.push({ ok: false, level: "warn", text: `A seção “${label}” está vazia e não vai aparecer na página.` });
    if (s.type === "places" && s.data.places.some((p) => p.lat === null)) items.push({ ok: false, level: "warn", text: "Algum lugar está sem localização no mapa." });
  }
  return items;
}
