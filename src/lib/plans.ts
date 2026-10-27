import { z } from "zod";
import { SECTION_TYPES, type PageContent, type SectionType } from "./content/schema";

export const PlanLimitsSchema = z.object({
  maxPhotos: z.number().int().min(0),
  /** null = ilimitado */
  maxLetters: z.number().int().min(0).nullable(),
  /** Seções permitidas; "all" libera todas. */
  sections: z.union([z.literal("all"), z.array(z.string())]),
  /** null = vitalícia */
  durationDays: z.number().int().positive().nullable(),
  customSlug: z.boolean(),
  music: z.boolean().default(true),
  removeBranding: z.boolean().default(false),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

export interface PlanLike {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  limits: unknown;
  sortOrder: number;
}

export interface UsageReport {
  photos: number;
  letters: number;
  sections: SectionType[];
  wantsCustomSlug: boolean;
}

export function countUsage(content: PageContent, wantsCustomSlug = false): UsageReport {
  let photos = 0;
  let letters = 0;
  const sections = new Set<SectionType>();
  for (const s of content.sections) {
    if (!s.visible) continue;
    sections.add(s.type);
    if (s.type === "photos") photos += s.data.photos.length;
    if (s.type === "letters") letters += s.data.letters.length;
    if (s.type === "hero" && s.data.photo) photos += 1;
    if (s.type === "timeline") photos += s.data.events.filter((e) => e.image).length;
    if (s.type === "places") photos += s.data.places.filter((p) => p.image).length;
    if (s.type === "scratch" && s.data.hiddenType === "image" && s.data.hiddenImage) photos += 1;
  }
  return { photos, letters, sections: [...sections], wantsCustomSlug };
}

export interface PlanViolation {
  kind: "photos" | "letters" | "section" | "customSlug";
  message: string;
  section?: SectionType;
}

export function planViolations(limitsRaw: unknown, usage: UsageReport): PlanViolation[] {
  const limits = PlanLimitsSchema.parse(limitsRaw);
  const out: PlanViolation[] = [];
  if (usage.photos > limits.maxPhotos) {
    out.push({ kind: "photos", message: `Este plano permite até ${limits.maxPhotos} fotos (você usou ${usage.photos}).` });
  }
  if (limits.maxLetters !== null && usage.letters > limits.maxLetters) {
    out.push({ kind: "letters", message: `Este plano permite até ${limits.maxLetters} cartas (você usou ${usage.letters}).` });
  }
  if (limits.sections !== "all") {
    for (const s of usage.sections) {
      if (!limits.sections.includes(s)) out.push({ kind: "section", section: s, message: `O módulo "${s}" não está incluso neste plano.` });
    }
  }
  if (usage.wantsCustomSlug && !limits.customSlug) {
    out.push({ kind: "customSlug", message: "Endereço personalizado não está incluso neste plano." });
  }
  return out;
}

/** Plano mais barato que comporta o conteúdo (ou o mais completo, se nenhum comportar). */
export function minimumPlan<P extends PlanLike>(plans: P[], usage: UsageReport): P | null {
  const sorted = [...plans].sort((a, b) => a.priceCents - b.priceCents || a.sortOrder - b.sortOrder);
  return sorted.find((p) => planViolations(p.limits, usage).length === 0) ?? sorted.at(-1) ?? null;
}

/** Seções que exigem plano superior ao mais barato (para o selo "Premium" no editor). */
export function premiumSections<P extends PlanLike>(plans: P[]): Set<string> {
  const cheapest = [...plans].sort((a, b) => a.priceCents - b.priceCents)[0];
  if (!cheapest) return new Set();
  const limits = PlanLimitsSchema.parse(cheapest.limits);
  if (limits.sections === "all") return new Set();
  const allowed = new Set(limits.sections);
  const out = new Set<string>();
  for (const p of plans) {
    const l = PlanLimitsSchema.parse(p.limits);
    const sections = l.sections === "all" ? SECTION_TYPES : l.sections;
    sections.forEach((s) => !allowed.has(s) && out.add(s));
  }
  return out;
}

export interface CouponLike {
  type: "PERCENT" | "FIXED";
  value: number;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  uses: number;
}

export type CouponCheck = { ok: true; discountCents: number } | { ok: false; reason: string };

export function applyCoupon(priceCents: number, coupon: CouponLike | null, now = new Date()): CouponCheck {
  if (!coupon) return { ok: false, reason: "Cupom não encontrado." };
  if (!coupon.active) return { ok: false, reason: "Este cupom não está mais ativo." };
  if (coupon.validFrom && now < coupon.validFrom) return { ok: false, reason: "Este cupom ainda não está valendo." };
  if (coupon.validUntil && now > coupon.validUntil) return { ok: false, reason: "Este cupom expirou." };
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) return { ok: false, reason: "Este cupom já atingiu o limite de usos." };
  const raw = coupon.type === "PERCENT" ? Math.round((priceCents * Math.min(100, coupon.value)) / 100) : coupon.value;
  // Mercado Pago exige valor mínimo; nunca deixamos o total abaixo de R$ 1,00.
  const discountCents = Math.max(0, Math.min(raw, priceCents - 100));
  return { ok: true, discountCents };
}

export function planFeatureList(limitsRaw: unknown): string[] {
  const l = PlanLimitsSchema.parse(limitsRaw);
  return [
    `Até ${l.maxPhotos} fotos`,
    l.maxLetters === null ? "Cartas ilimitadas" : `Até ${l.maxLetters} cartas`,
    l.sections === "all" ? "Todos os módulos (quiz, céu estrelado, raspadinha, pedido...)" : "Módulos essenciais",
    l.durationDays === null ? "Página vitalícia" : `Página ativa por ${Math.round(l.durationDays / 365) >= 1 ? `${Math.round(l.durationDays / 365)} ano(s)` : `${l.durationDays} dias`}`,
    ...(l.customSlug ? ["Endereço personalizado (/p/joao-e-maria)"] : []),
    "Música, tela de entrada protegida e QR Code",
  ];
}
