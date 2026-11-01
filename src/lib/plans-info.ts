import "server-only";
import { db } from "./db";
import { env } from "./env";
import { PlanLimitsSchema, premiumSections } from "./plans";

/** Informações de planos para o editor — SEM preços (o valor só aparece no checkout). */
export async function plansInfoForBuilder() {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { priceCents: "asc" } });
  const base = plans[0];
  const top = plans.at(-1);
  const baseLimits = base ? PlanLimitsSchema.parse(base.limits) : null;
  const topLimits = top ? PlanLimitsSchema.parse(top.limits) : null;
  return {
    premiumSections: [...premiumSections(plans)],
    basePlanName: base?.name ?? "Essencial",
    topPlanName: top?.name ?? "Premium",
    basePhotos: baseLimits?.maxPhotos ?? 10,
    topPhotos: topLimits?.maxPhotos ?? 50,
    baseLetters: baseLimits ? baseLimits.maxLetters : 3,
    singlePlan: plans.length === 1,
    aiEnabled: Boolean(env().ANTHROPIC_API_KEY),
  };
}
