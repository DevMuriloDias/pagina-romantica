import "server-only";
import { db } from "./db";
import { log } from "./log";
import { parseTheme } from "./theme";
import { TEMPLATES, type TemplateDef } from "./theme/templates";

/** Templates ativos (ordem e ativação vêm do admin; cai para os oficiais se o banco não responder). */
export async function activeTemplates(): Promise<TemplateDef[]> {
  try {
    const rows = await db.template.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    if (!rows.length) return TEMPLATES;
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, theme: parseTheme(r.theme) }));
  } catch (err) {
    log.warn("catalog.templates_fallback", { err });
    return TEMPLATES;
  }
}

/** Preço do plano mais barato e quantos planos ativos existem (para o texto do FAQ). */
export async function pricingSummary(): Promise<{ cheapest: number | null; count: number }> {
  try {
    const plans = await db.plan.findMany({ where: { active: true }, select: { priceCents: true } });
    return { cheapest: plans.length ? Math.min(...plans.map((p) => p.priceCents)) : null, count: plans.length };
  } catch {
    return { cheapest: null, count: 0 };
  }
}
