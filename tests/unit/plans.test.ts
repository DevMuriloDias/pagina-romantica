import { describe, expect, it } from "vitest";
import { buildContent } from "@/lib/content/defaults";
import { QuestionnaireSchema } from "@/lib/content/questionnaire";
import { applyCoupon, countUsage, minimumPlan, planViolations, premiumSections } from "@/lib/plans";
import { createSection } from "@/lib/sections/registry";

const essential = { id: "e", slug: "essencial", name: "Essencial", priceCents: 1990, sortOrder: 1, limits: { maxPhotos: 10, maxLetters: 3, sections: ["hero", "letters", "photos", "timeline", "places", "counter", "countdown", "reasons", "finale"], durationDays: 365, customSlug: false } };
const premium = { id: "p", slug: "premium", name: "Premium", priceCents: 3990, sortOrder: 2, limits: { maxPhotos: 50, maxLetters: null, sections: "all", durationDays: null, customSlug: true } };
const plans = [premium, essential];

const base = buildContent(QuestionnaireSchema.parse({ recipientName: "B", relationship: "namoro" }));

describe("planos", () => {
  it("conteúdo simples cabe no Essencial", () => {
    expect(minimumPlan(plans, countUsage(base))?.slug).toBe("essencial");
  });

  it("módulo premium exige Premium", () => {
    const c = { ...base, sections: [...base.sections, createSection("quiz")] };
    const usage = countUsage(c);
    expect(planViolations(essential.limits, usage).map((v) => v.kind)).toContain("section");
    expect(minimumPlan(plans, usage)?.slug).toBe("premium");
  });

  it("seções ocultas não contam", () => {
    const quiz = { ...createSection("quiz"), visible: false };
    expect(minimumPlan(plans, countUsage({ ...base, sections: [...base.sections, quiz] }))?.slug).toBe("essencial");
  });

  it("muitas fotos exigem Premium; endereço personalizado também", () => {
    const photos = createSection("photos", { photos: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, image: { url: "/api/uploads/x.webp", alt: "" }, caption: "" })) });
    expect(minimumPlan(plans, countUsage({ ...base, sections: [photos] }))?.slug).toBe("premium");
    expect(minimumPlan(plans, countUsage(base, true))?.slug).toBe("premium");
  });

  it("selo Premium: módulos fora do plano mais barato", () => {
    const set = premiumSections(plans);
    expect(set.has("quiz")).toBe(true);
    expect(set.has("letters")).toBe(false);
  });
});

describe("cupons", () => {
  const coupon = { type: "PERCENT" as const, value: 10, active: true, validFrom: null, validUntil: null, maxUses: 5, uses: 0 };
  it("percentual", () => expect(applyCoupon(3990, coupon)).toEqual({ ok: true, discountCents: 399 }));
  it("fixo nunca deixa o total abaixo de R$ 1,00", () => expect(applyCoupon(1990, { ...coupon, type: "FIXED", value: 5000 })).toEqual({ ok: true, discountCents: 1890 }));
  it("expirado, inativo, esgotado e não iniciado", () => {
    expect(applyCoupon(1000, { ...coupon, validUntil: new Date("2000-01-01") }).ok).toBe(false);
    expect(applyCoupon(1000, { ...coupon, active: false }).ok).toBe(false);
    expect(applyCoupon(1000, { ...coupon, uses: 5 }).ok).toBe(false);
    expect(applyCoupon(1000, { ...coupon, validFrom: new Date("2999-01-01") }).ok).toBe(false);
    expect(applyCoupon(1000, null).ok).toBe(false);
  });
});
