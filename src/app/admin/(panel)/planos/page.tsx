import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { field } from "@/components/admin";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { SECTION_TYPES } from "@/lib/content/schema";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { PlanLimitsSchema } from "@/lib/plans";
import { sectionRegistry } from "@/lib/sections/registry";

function parseBRL(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "0").replace(/\./g, "").replace(",", "."));
  return Math.max(0, Math.round(n * 100));
}

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const allSections = formData.get("allSections") === "on";
  const limits = PlanLimitsSchema.parse({
    maxPhotos: Number(formData.get("maxPhotos") || 0),
    maxLetters: formData.get("maxLetters") ? Number(formData.get("maxLetters")) : null,
    sections: allSections ? "all" : formData.getAll("sections").map(String),
    durationDays: formData.get("durationDays") ? Number(formData.get("durationDays")) : null,
    customSlug: formData.get("customSlug") === "on",
    music: true,
    removeBranding: false,
  });
  const data = {
    slug: String(formData.get("slug")).trim().toLowerCase(),
    name: String(formData.get("name")).trim(),
    description: String(formData.get("description") ?? "").trim(),
    priceCents: parseBRL(formData.get("price")),
    sortOrder: Number(formData.get("sortOrder") || 0),
    active: formData.get("active") === "on",
    highlight: formData.get("highlight") === "on",
    limits: limits as unknown as Prisma.InputJsonValue,
  };
  if (id) await db.plan.update({ where: { id }, data });
  else await db.plan.create({ data });
  revalidatePath("/admin/planos");
}

export default async function Plans() {
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  const blank = { id: "", slug: "", name: "", description: "", priceCents: 0, sortOrder: plans.length + 1, active: true, highlight: false, limits: { maxPhotos: 10, maxLetters: 3, sections: "all", durationDays: 365, customSlug: false } };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Planos e preços</h1>
      <p className="text-sm text-ink-soft">O preço é sempre recalculado no servidor ao criar o pagamento. Alterações valem para novos pedidos.</p>
      {[...plans, blank].map((p) => {
        const l = PlanLimitsSchema.safeParse(p.limits).success ? PlanLimitsSchema.parse(p.limits) : PlanLimitsSchema.parse(blank.limits);
        return (
          <form key={p.id || "new"} action={save} className="space-y-3 rounded-2xl border border-line bg-white p-5">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">{p.id ? p.name : "Novo plano"}</h2>
              {p.id ? <Badge tone={p.active ? "success" : "muted"}>{p.active ? "ativo" : "inativo"}</Badge> : null}
              {p.id ? <span className="text-sm text-ink-soft">{formatBRL(p.priceCents)}</span> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs">Nome<input name="name" required defaultValue={p.name} className={`${field} w-full`} /></label>
              <label className="text-xs">Slug<input name="slug" required defaultValue={p.slug} className={`${field} w-full`} /></label>
              <label className="text-xs">Preço (R$)<input name="price" required defaultValue={(p.priceCents / 100).toFixed(2).replace(".", ",")} className={`${field} w-full`} /></label>
              <label className="text-xs">Ordem<input name="sortOrder" type="number" defaultValue={p.sortOrder} className={`${field} w-full`} /></label>
            </div>
            <label className="block text-xs">Descrição<input name="description" defaultValue={p.description} className={`${field} w-full`} /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs">Máx. fotos<input name="maxPhotos" type="number" min={0} defaultValue={l.maxPhotos} className={`${field} w-full`} /></label>
              <label className="text-xs">Máx. cartas (vazio = ilimitado)<input name="maxLetters" type="number" min={0} defaultValue={l.maxLetters ?? ""} className={`${field} w-full`} /></label>
              <label className="text-xs">Validade em dias (vazio = vitalícia)<input name="durationDays" type="number" min={1} defaultValue={l.durationDays ?? ""} className={`${field} w-full`} /></label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> Ativo</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="highlight" defaultChecked={p.highlight} /> Destaque</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="customSlug" defaultChecked={l.customSlug} /> Endereço personalizado</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="allSections" defaultChecked={l.sections === "all"} /> Todos os módulos</label>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-soft">Módulos incluídos (se não for “todos”)</summary>
              <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                {SECTION_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1"><input type="checkbox" name="sections" value={t} defaultChecked={l.sections === "all" || l.sections.includes(t)} /> {sectionRegistry[t].label}</label>
                ))}
              </div>
            </details>
            <button className="rounded-full bg-rose px-4 py-1.5 text-sm font-medium text-white">{p.id ? "Salvar" : "Criar plano"}</button>
          </form>
        );
      })}
    </div>
  );
}
