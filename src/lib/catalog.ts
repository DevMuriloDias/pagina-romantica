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

export async function cheapestPriceCents(): Promise<number | null> {
  try {
    const p = await db.plan.findFirst({ where: { active: true }, orderBy: { priceCents: "asc" }, select: { priceCents: true } });
    return p?.priceCents ?? null;
  } catch {
    return null;
  }
}
