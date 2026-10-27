import type { Theme } from "./schema";

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  theme: Theme;
}

const base = {
  baseSize: 16,
  bodyWeight: 400,
  radius: 16,
  shadow: "soft",
  cardStyle: "solid",
  animation: { entrance: "fade", speed: "normal" },
  effects: { type: "hearts", intensity: 4 },
  heartCursor: false,
} satisfies Partial<Theme>;

function bg(
  type: Theme["background"]["type"],
  colors: [string, string, ...string[]],
  angle = 160,
  pattern: Theme["background"]["pattern"] = "hearts",
): Theme["background"] {
  return {
    type,
    gradient: { colors, angle },
    image: { url: "", overlayColor: "#000000", overlayOpacity: 0.35 },
    pattern,
    animatedPattern: false,
  };
}

/** 8 templates oficiais. O seed copia estes valores para a tabela Template (editável no admin). */
export const TEMPLATES: TemplateDef[] = [
  {
    id: "classico",
    name: "Clássico Romântico",
    description: "Vermelho profundo, serifas elegantes e corações delicados.",
    theme: {
      ...base,
      templateId: "classico",
      colors: { primary: "#b3123b", secondary: "#f6c1cc", accent: "#d4a373", background: "#fff6f4", surface: "#ffffff", text: "#3a1520" },
      background: bg("gradient", ["#fff6f4", "#ffe3e6"], 170),
      fonts: { heading: "playfair", body: "lora", script: "great-vibes" },
    },
  },
  {
    id: "minimalista",
    name: "Minimalista",
    description: "Muito respiro, tipografia limpa e um toque de cor.",
    theme: {
      ...base,
      templateId: "minimalista",
      colors: { primary: "#111111", secondary: "#e9e4df", accent: "#e2574c", background: "#faf9f7", surface: "#ffffff", text: "#1b1b1b" },
      background: bg("solid", ["#faf9f7", "#ffffff"]),
      fonts: { heading: "josefin", body: "inter", script: "caveat" },
      radius: 6,
      shadow: "none",
      cardStyle: "outline",
      effects: { type: "none", intensity: 3 },
    },
  },
  {
    id: "vintage",
    name: "Vintage / Carta antiga",
    description: "Papel envelhecido, tons de sépia e caligrafia.",
    theme: {
      ...base,
      templateId: "vintage",
      colors: { primary: "#7a4b2a", secondary: "#e8d8b9", accent: "#a63d40", background: "#f3e9d2", surface: "#fbf4e4", text: "#3b2a1a" },
      background: bg("pattern", ["#f3e9d2", "#e8d8b9"], 180, "dots"),
      fonts: { heading: "cinzel", body: "libre-baskerville", script: "homemade-apple" },
      radius: 4,
      cardStyle: "paper",
      effects: { type: "petals", intensity: 3 },
    },
  },
  {
    id: "noite-estrelada",
    name: "Noite Estrelada",
    description: "Azul profundo, estrelas cintilantes e brilho dourado.",
    theme: {
      ...base,
      templateId: "noite-estrelada",
      colors: { primary: "#f4d58d", secondary: "#2a3a6b", accent: "#e98fa8", background: "#0b1026", surface: "#141c3d", text: "#eef1ff" },
      background: bg("gradient", ["#0b1026", "#1b2452", "#2b1b4a"], 180),
      fonts: { heading: "cormorant", body: "raleway", script: "parisienne" },
      cardStyle: "glass",
      effects: { type: "stars", intensity: 6 },
    },
  },
  {
    id: "floral",
    name: "Floral Aquarela",
    description: "Tons de aquarela, flores suaves e leveza.",
    theme: {
      ...base,
      templateId: "floral",
      colors: { primary: "#c75b7a", secondary: "#b8d8c8", accent: "#e8a87c", background: "#fdf7f2", surface: "#ffffff", text: "#40303a" },
      background: bg("gradient", ["#fdf7f2", "#f6e6ee", "#e6f2ec"], 135),
      fonts: { heading: "dm-serif", body: "nunito", script: "dancing" },
      radius: 24,
      effects: { type: "petals", intensity: 5 },
    },
  },
  {
    id: "neon",
    name: "Neon / Moderno",
    description: "Fundo escuro, cores vibrantes e brilho neon.",
    theme: {
      ...base,
      templateId: "neon",
      colors: { primary: "#ff2e88", secondary: "#7b2ff7", accent: "#00e5ff", background: "#0d0d14", surface: "#171724", text: "#f5f5ff" },
      background: bg("gradient", ["#0d0d14", "#1a0f2e"], 200),
      fonts: { heading: "montserrat", body: "inter", script: "pacifico" },
      radius: 12,
      shadow: "strong",
      cardStyle: "glass",
      animation: { entrance: "zoom", speed: "fast" },
      effects: { type: "particles", intensity: 5 },
    },
  },
  {
    id: "praia",
    name: "Praia / Pôr do sol",
    description: "Laranja, coral e azul do mar ao entardecer.",
    theme: {
      ...base,
      templateId: "praia",
      colors: { primary: "#e8603c", secondary: "#ffd29d", accent: "#2a9d8f", background: "#fff4e6", surface: "#ffffff", text: "#3d2618" },
      background: bg("gradient", ["#ffd29d", "#ff9e7a", "#f08a8a"], 180),
      fonts: { heading: "abril", body: "quicksand", script: "sacramento" },
      radius: 20,
      animation: { entrance: "slide", speed: "normal" },
      effects: { type: "bubbles", intensity: 3 },
    },
  },
  {
    id: "fofo",
    name: "Fofo / Pastel",
    description: "Rosa bebê, lilás, bordas redondinhas e muita fofura.",
    theme: {
      ...base,
      templateId: "fofo",
      colors: { primary: "#ff7eb6", secondary: "#c9b6ff", accent: "#7ad7c4", background: "#fff5fb", surface: "#ffffff", text: "#4a3550" },
      background: bg("pattern", ["#fff5fb", "#f3ecff"], 160, "hearts"),
      fonts: { heading: "fredoka", body: "quicksand", script: "caveat" },
      radius: 28,
      animation: { entrance: "zoom", speed: "normal" },
      effects: { type: "hearts", intensity: 6 },
      heartCursor: true,
    },
  },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0]!;

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}

/** Paletas sugeridas no editor de cores. */
export const SUGGESTED_PALETTES: { name: string; colors: Theme["colors"] }[] = TEMPLATES.map((t) => ({
  name: t.name,
  colors: t.theme.colors,
})).concat([
  { name: "Lavanda", colors: { primary: "#7c5cbf", secondary: "#e4dbff", accent: "#f2a7c3", background: "#f8f5ff", surface: "#ffffff", text: "#2e2442" } },
  { name: "Verde oliva", colors: { primary: "#5b6f3a", secondary: "#e3e8d0", accent: "#c97b4a", background: "#f7f6ef", surface: "#ffffff", text: "#2b2f20" } },
  { name: "Vinho", colors: { primary: "#6d1a36", secondary: "#e8c4cf", accent: "#c9a227", background: "#fbf3f5", surface: "#ffffff", text: "#2e0f19" } },
]);
