import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { requireEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";
import { countUsage, PlanLimitsSchema, planViolations } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

/** "Remover recursos Premium": oculta os módulos que o plano escolhido não inclui. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const { planId } = await parseBody(req, z.object({ planId: z.string().max(40) }));
  const plan = await db.plan.findFirst({ where: { id: planId, active: true } });
  if (!plan) throw new ApiError(404, "Plano não encontrado.", "not_found");
  const limits = PlanLimitsSchema.parse(plan.limits);
  const { content } = pageView(page);
  if (limits.sections !== "all") {
    const allowed = new Set(limits.sections);
    content.sections = content.sections.map((s) => (allowed.has(s.type) ? s : { ...s, visible: false }));
  }
  await db.page.update({ where: { id }, data: { content: content as unknown as Prisma.InputJsonValue } });
  const remaining = planViolations(plan.limits, countUsage(content));
  return json({ ok: remaining.length === 0, remaining });
});
