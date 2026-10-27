import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { requireEditablePage } from "@/lib/pages/access";
import { validateCustomSlug } from "@/lib/slug";

export const POST = route(async (req: Request) => {
  const { pageId, slug } = await parseBody(req, z.object({ pageId: z.string().max(40), slug: z.string().max(60) }));
  await requireEditablePage(pageId);
  const check = validateCustomSlug(slug);
  if (!check.ok) return json({ ok: false, message: check.reason });
  const taken = await db.page.findFirst({ where: { slug: check.slug, NOT: { id: pageId } }, select: { id: true } });
  return json(taken ? { ok: false, message: "Este endereço já está em uso." } : { ok: true, slug: check.slug, message: "Endereço disponível! 🎉" });
});
