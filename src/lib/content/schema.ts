import { z } from "zod";
import { FONT_IDS } from "../theme/fonts";
import { ENTRANCES, GradientSchema, hex } from "../theme/schema";

/**
 * Schema versionado do conteúdo da página.
 * Ao mudar a estrutura: incremente CONTENT_SCHEMA_VERSION e adicione uma migração em migrations.ts.
 */
export const CONTENT_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().max(max).default("");
const id = z.string().min(1).max(40);
/** Data de calendário AAAA-MM-DD (ou vazio). */
const dateStr = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default("");
/** Data e hora local AAAA-MM-DDTHH:mm (ou vazio). */
const dateTimeStr = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)]).default("");

export const ImageRefSchema = z.object({
  assetId: z.string().max(40).optional(),
  url: z.string().max(1000),
  alt: text(200),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ImageRef = z.infer<typeof ImageRefSchema>;

export const SectionStyleSchema = z.object({
  bgType: z.enum(["inherit", "solid", "gradient", "transparent"]).default("inherit"),
  bgColor: hex.optional(),
  bgGradient: GradientSchema.optional(),
  textColor: hex.optional(),
  accentColor: hex.optional(),
  headingFont: z.enum(FONT_IDS).optional(),
  spacing: z.enum(["compact", "normal", "spacious"]).default("normal"),
  animation: z.enum(["inherit", ...ENTRANCES]).default("inherit"),
});
export type SectionStyle = z.infer<typeof SectionStyleSchema>;

// ───────────────────────── Dados de cada módulo ─────────────────────────

export const PAPERS = ["lined", "kraft", "vintage", "plain"] as const;

export const LetterSchema = z.object({
  id,
  kind: z.enum(["normal", "open_when"]).default("normal"),
  openWhen: text(80),
  title: text(120),
  body: text(6000),
  signature: text(80),
  paper: z.enum(PAPERS).default("lined"),
  font: z.enum(FONT_IDS).default("dancing"),
  envelopeColor: hex.optional(),
  lockedUntil: dateStr,
});
export type Letter = z.infer<typeof LetterSchema>;

export const PhotoSchema = z.object({ id, image: ImageRefSchema, caption: text(200) });
export type Photo = z.infer<typeof PhotoSchema>;
export const PHOTO_LAYOUTS = ["polaroid", "carousel", "grid", "slideshow", "film", "flipbook"] as const;

export const TimelineEventSchema = z.object({
  id,
  date: dateStr,
  title: text(120),
  description: text(1000),
  emoji: text(16),
  image: ImageRefSchema.optional(),
});

export const PlaceSchema = z.object({
  id,
  name: text(120),
  address: text(200),
  date: dateStr,
  story: text(1000),
  image: ImageRefSchema.optional(),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
});

export const QuizQuestionSchema = z.object({
  id,
  question: text(200),
  options: z.array(z.string().max(120)).min(2).max(4),
  correctIndex: z.number().int().min(0).max(3),
});

export const LoveCouponSchema = z.object({ id, title: text(80), description: text(200), emoji: text(16) });

export const SECTION_DATA = {
  hero: z.object({
    title: text(120),
    subtitle: text(240),
    layout: z.enum(["centered", "photo"]).default("centered"),
    photo: ImageRefSchema.optional(),
  }),
  letters: z.object({ title: text(120), letters: z.array(LetterSchema).max(50) }),
  photos: z.object({
    title: text(120),
    layout: z.enum(PHOTO_LAYOUTS).default("polaroid"),
    photos: z.array(PhotoSchema).max(200),
  }),
  timeline: z.object({
    title: text(120),
    layout: z.enum(["vertical", "horizontal"]).default("vertical"),
    events: z.array(TimelineEventSchema).max(60),
  }),
  places: z.object({
    title: text(120),
    layout: z.enum(["map", "passport"]).default("map"),
    places: z.array(PlaceSchema).max(40),
  }),
  counter: z.object({
    title: text(120),
    startDate: dateTimeStr,
    style: z.enum(["flip", "minimal", "hearts"]).default("flip"),
  }),
  countdown: z.object({
    title: text(120),
    eventName: text(120),
    targetDate: dateTimeStr,
    style: z.enum(["flip", "minimal", "hearts"]).default("minimal"),
    doneMessage: text(200),
  }),
  reasons: z.object({
    title: text(120),
    layout: z.enum(["flip", "jar"]).default("flip"),
    reasons: z.array(z.string().max(240)).max(100),
  }),
  sky: z.object({
    title: text(120),
    date: dateStr,
    time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]).default("21:00"),
    city: text(120),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    caption: text(240),
    showConstellations: z.boolean().default(true),
  }),
  quiz: z.object({
    title: text(120),
    questions: z.array(QuizQuestionSchema).max(20),
    resultHigh: text(240),
    resultMid: text(240),
    resultLow: text(240),
  }),
  scratch: z.object({
    title: text(120),
    instructions: text(160),
    hiddenType: z.enum(["text", "image"]).default("text"),
    hiddenText: text(300),
    hiddenImage: ImageRefSchema.optional(),
  }),
  coupons: z.object({ title: text(120), coupons: z.array(LoveCouponSchema).max(30) }),
  proposal: z.object({
    kind: z.enum(["namoro", "casamento", "outro"]).default("namoro"),
    question: text(200),
    yesLabel: text(40),
    noLabel: text(40),
    yesMessage: text(400),
  }),
  video: z.object({ title: text(120), url: text(300), caption: text(240) }),
  finale: z.object({ phrase: text(400), signature: text(60) }),
  guestbook: z.object({ title: text(120), prompt: text(240) }),
} as const;

export type SectionType = keyof typeof SECTION_DATA;
export const SECTION_TYPES = Object.keys(SECTION_DATA) as SectionType[];
export type SectionData<T extends SectionType> = z.infer<(typeof SECTION_DATA)[T]>;

function sectionVariant<T extends SectionType>(type: T) {
  return z.object({
    id,
    type: z.literal(type),
    visible: z.boolean().default(true),
    style: SectionStyleSchema.default({}),
    data: SECTION_DATA[type],
  });
}

export const SectionSchema = z.discriminatedUnion("type", [
  sectionVariant("hero"),
  sectionVariant("letters"),
  sectionVariant("photos"),
  sectionVariant("timeline"),
  sectionVariant("places"),
  sectionVariant("counter"),
  sectionVariant("countdown"),
  sectionVariant("reasons"),
  sectionVariant("sky"),
  sectionVariant("quiz"),
  sectionVariant("scratch"),
  sectionVariant("coupons"),
  sectionVariant("proposal"),
  sectionVariant("video"),
  sectionVariant("finale"),
  sectionVariant("guestbook"),
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

// ───────────────────────── Globais ─────────────────────────

export const RELATIONSHIPS = [
  "namoro",
  "noivado",
  "casamento",
  "ficante",
  "pedido_namoro",
  "pedido_casamento",
  "aniversario_namoro",
  "reconciliacao",
  "amizade_colorida",
  "outro",
] as const;

export const OCCASIONS = [
  "aniversario",
  "dia_dos_namorados",
  "mesversario",
  "bodas",
  "so_porque_sim",
  "pedido",
] as const;

export const TONES = ["romantico", "poetico", "divertido", "fofo", "emocionante", "picante_leve"] as const;

export const GateSchema = z.object({
  mode: z.enum(["none", "password", "question"]).default("none"),
  question: text(200),
  /** Quantas respostas (hash) estão cadastradas — as respostas em si ficam em Page.gateHashes. */
  answersCount: z.number().int().min(0).max(10).default(0),
  hint: text(200),
  hintAfter: z.number().int().min(1).max(10).default(3),
  errorMessage: text(200),
  buttonLabel: text(40),
  welcomeText: text(200),
});
export type GateConfig = z.infer<typeof GateSchema>;

export const MusicSchema = z.object({
  provider: z.enum(["none", "youtube", "spotify"]).default("none"),
  url: text(400),
  /** ID extraído e validado no servidor. */
  mediaId: text(80),
  spotifyType: z.enum(["track", "album", "playlist", "episode"]).default("track"),
  startAt: z.number().int().min(0).max(36000).default(0),
  loop: z.boolean().default(true),
  title: text(120),
});
export type MusicConfig = z.infer<typeof MusicSchema>;

export const ContentSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  meta: z.object({
    senderName: text(60),
    recipientName: text(60),
    relationship: z.enum(RELATIONSHIPS).default("namoro"),
    occasion: z.enum(OCCASIONS).default("so_porque_sim"),
    tone: z.enum(TONES).default("romantico"),
    startDate: dateStr,
  }),
  gate: GateSchema.default({}),
  music: MusicSchema.default({}),
  settings: z
    .object({ notifyOnOpen: z.boolean().default(true) })
    .default({}),
  sections: z.array(SectionSchema).max(40),
});

export type PageContent = z.infer<typeof ContentSchema>;
