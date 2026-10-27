import { z } from "zod";
import { FONT_IDS } from "./fonts";

export const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)")
  .transform((v) => v.toLowerCase());

export const EFFECT_TYPES = ["none", "hearts", "petals", "stars", "confetti", "bubbles", "snow", "particles"] as const;
export const ENTRANCES = ["fade", "slide", "zoom", "none"] as const;
export const CARD_STYLES = ["glass", "paper", "solid", "outline"] as const;
export const PATTERNS = ["hearts", "dots", "stars", "waves"] as const;

export const ColorsSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  background: hex,
  surface: hex,
  text: hex,
});

export const GradientSchema = z.object({
  colors: z.array(hex).min(2).max(3),
  angle: z.number().int().min(0).max(360),
});

export const BackgroundSchema = z.object({
  type: z.enum(["solid", "gradient", "image", "pattern"]),
  gradient: GradientSchema,
  image: z.object({
    url: z.string().max(1000).default(""),
    overlayColor: hex,
    overlayOpacity: z.number().min(0).max(1),
  }),
  pattern: z.enum(PATTERNS),
  animatedPattern: z.boolean(),
});

export const ThemeSchema = z.object({
  templateId: z.string().max(40),
  colors: ColorsSchema,
  background: BackgroundSchema,
  fonts: z.object({
    heading: z.enum(FONT_IDS),
    body: z.enum(FONT_IDS),
    script: z.enum(FONT_IDS),
  }),
  baseSize: z.number().int().min(14).max(20),
  bodyWeight: z.union([z.literal(300), z.literal(400), z.literal(500)]),
  radius: z.number().int().min(0).max(32),
  shadow: z.enum(["none", "soft", "strong"]),
  cardStyle: z.enum(CARD_STYLES),
  animation: z.object({
    entrance: z.enum(ENTRANCES),
    speed: z.enum(["slow", "normal", "fast"]),
  }),
  effects: z.object({
    type: z.enum(EFFECT_TYPES),
    intensity: z.number().int().min(1).max(10),
  }),
  heartCursor: z.boolean(),
});

export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeColors = z.infer<typeof ColorsSchema>;
export type EffectType = (typeof EFFECT_TYPES)[number];
export type Entrance = (typeof ENTRANCES)[number];
