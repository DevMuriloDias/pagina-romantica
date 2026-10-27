import "server-only";
import type { Coupon, Page, Plan } from "@prisma/client";
import { db } from "../db";
import { pageView } from "../pages/service";
import { applyCoupon, countUsage, minimumPlan, planFeatureList, planViolations, type PlanViolation } from "../plans";

export interface Quote {
  plans: { id: string; slug: string; name: string; description: string; priceCents: number; highlight: boolean; features: string[] }[];
  selectedPlanId: string;
  requiredPlanId: string;
  violations: PlanViolation[];
  originalCents: number;
  discountCents: number;
  totalCents: number;
  coupon: { code: string; ok: boolean; message: string } | null;
  plan: Plan;
  couponRecord: Coupon | null;
}

/** Preço SEMPRE recalculado no servidor a partir do banco (planos e cupons editáveis no admin). */
export async function quoteFor(page: Page, opts: { planId?: string | null; couponCode?: string | null; wantsCustomSlug?: boolean }): Promise<Quote> {
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }] });
  if (!plans.length) throw new Error("Nenhum plano ativo cadastrado. Rode o seed ou cadastre no admin.");
  const { content } = pageView(page);
  const usage = countUsage(content, opts.wantsCustomSlug ?? false);
  const required = minimumPlan(plans, usage) ?? plans[0]!;
  const requested = opts.planId ? plans.find((p) => p.id === opts.planId) : null;
  // O plano escolhido nunca pode ser inferior ao necessário (o preço do mínimo prevalece).
  const plan = requested && requested.priceCents >= required.priceCents ? requested : required;
  const violations = planViolations(plan.limits, usage);

  let coupon: Quote["coupon"] = null;
  let couponRecord: Coupon | null = null;
  let discountCents = 0;
  const code = opts.couponCode?.trim().toUpperCase();
  if (code) {
    couponRecord = await db.coupon.findUnique({ where: { code } });
    const check = applyCoupon(plan.priceCents, couponRecord);
    if (check.ok) {
      discountCents = check.discountCents;
      coupon = { code, ok: true, message: "Cupom aplicado! 🎉" };
    } else {
      couponRecord = null;
      coupon = { code, ok: false, message: check.reason };
    }
  }

  return {
    plans: plans.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, priceCents: p.priceCents, highlight: p.highlight, features: planFeatureList(p.limits) })),
    selectedPlanId: plan.id,
    requiredPlanId: required.id,
    violations,
    originalCents: plan.priceCents,
    discountCents,
    totalCents: plan.priceCents - discountCents,
    coupon,
    plan,
    couponRecord,
  };
}

export function publicQuote(q: Quote) {
  const { plan: _plan, couponRecord: _c, ...rest } = q;
  return rest;
}
