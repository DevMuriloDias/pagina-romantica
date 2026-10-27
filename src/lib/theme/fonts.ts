/** Lista curada de Google Fonts. Todas carregadas com display=swap. */
export type FontCategory = "heading" | "body" | "script";

export interface FontDef {
  id: string;
  family: string;
  category: FontCategory;
  /** Eixo de pesos para a URL do Google Fonts (css2). */
  axis: string;
  fallback: string;
}

export const FONTS = [
  { id: "playfair", family: "Playfair Display", category: "heading", axis: "wght@400;600;700", fallback: "serif" },
  { id: "cormorant", family: "Cormorant Garamond", category: "heading", axis: "wght@400;600;700", fallback: "serif" },
  { id: "dm-serif", family: "DM Serif Display", category: "heading", axis: "wght@400", fallback: "serif" },
  { id: "abril", family: "Abril Fatface", category: "heading", axis: "wght@400", fallback: "serif" },
  { id: "cinzel", family: "Cinzel", category: "heading", axis: "wght@400;600;700", fallback: "serif" },
  { id: "josefin", family: "Josefin Sans", category: "heading", axis: "wght@300;400;600;700", fallback: "sans-serif" },
  { id: "montserrat", family: "Montserrat", category: "heading", axis: "wght@300;400;600;700", fallback: "sans-serif" },
  { id: "fredoka", family: "Fredoka", category: "heading", axis: "wght@400;500;600;700", fallback: "sans-serif" },
  { id: "inter", family: "Inter", category: "body", axis: "wght@300;400;500;600;700", fallback: "sans-serif" },
  { id: "nunito", family: "Nunito", category: "body", axis: "wght@300;400;600;700", fallback: "sans-serif" },
  { id: "lato", family: "Lato", category: "body", axis: "wght@300;400;700", fallback: "sans-serif" },
  { id: "raleway", family: "Raleway", category: "body", axis: "wght@300;400;500;700", fallback: "sans-serif" },
  { id: "quicksand", family: "Quicksand", category: "body", axis: "wght@300;400;500;700", fallback: "sans-serif" },
  { id: "lora", family: "Lora", category: "body", axis: "wght@400;500;700", fallback: "serif" },
  { id: "libre-baskerville", family: "Libre Baskerville", category: "body", axis: "wght@400;700", fallback: "serif" },
  { id: "dancing", family: "Dancing Script", category: "script", axis: "wght@400;600;700", fallback: "cursive" },
  { id: "great-vibes", family: "Great Vibes", category: "script", axis: "wght@400", fallback: "cursive" },
  { id: "caveat", family: "Caveat", category: "script", axis: "wght@400;600;700", fallback: "cursive" },
  { id: "parisienne", family: "Parisienne", category: "script", axis: "wght@400", fallback: "cursive" },
  { id: "sacramento", family: "Sacramento", category: "script", axis: "wght@400", fallback: "cursive" },
  { id: "homemade-apple", family: "Homemade Apple", category: "script", axis: "wght@400", fallback: "cursive" },
  { id: "pacifico", family: "Pacifico", category: "script", axis: "wght@400", fallback: "cursive" },
] as const satisfies readonly FontDef[];

export type FontId = (typeof FONTS)[number]["id"];
export const FONT_IDS = FONTS.map((f) => f.id) as [FontId, ...FontId[]];

const byId = new Map<string, FontDef>(FONTS.map((f) => [f.id, f]));

export function getFont(id: string): FontDef {
  return byId.get(id) ?? FONTS[8];
}

export function fontStack(id: string): string {
  const f = getFont(id);
  return `"${f.family}", ${f.fallback}`;
}

export function googleFontsUrl(ids: Iterable<string>): string | null {
  const unique = [...new Set(ids)].map((id) => byId.get(id)).filter((f): f is FontDef => Boolean(f));
  if (unique.length === 0) return null;
  const families = unique.map((f) => `family=${f.family.replace(/ /g, "+")}:${f.axis}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
