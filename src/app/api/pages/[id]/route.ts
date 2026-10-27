import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { clearPageCookie, requireEditablePage } from "@/lib/pages/access";
import { pageView, savePage, setPageStatus } from "@/lib/pages/service";
import { deletePrefix } from "@/lib/storage";
import { appUrl } from "@/lib/env";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const { content, theme } = pageView(page);
  return json({
    id: page.id,
    status: page.status,
    content,
    theme,
    slug: page.slug,
    publicUrl: page.slug && page.status === "PUBLISHED" ? appUrl(`/p/${page.slug}`) : null,
    planId: page.planId,
    updatedAt: page.updatedAt,
    aiGenerations: page.aiGenerations,
  });
});

const SaveSchema = z.object({ content: z.unknown().optional(), theme: z.unknown().optional() });

/** Autosave do editor (debounce no cliente). */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  if (page.status === "UNPUBLISHED") throw new ApiError(423, "Esta página está despublicada e não pode ser editada.", "locked");
  const body = await parseBody(req, SaveSchema);
  const saved = await savePage(page, body);
  return json({ ok: true, updatedAt: saved.updatedAt });
});

/** LGPD: o cliente exclui a página e os dados (fotos incluídas). */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const assets = await db.asset.findMany({ where: { pageId: id }, select: { key: true } });
  await deletePrefix(assets.map((a) => a.key));
  await db.asset.deleteMany({ where: { pageId: id } });
  await db.pageEvent.deleteMany({ where: { pageId: id } });
  await setPageStatus(id, "DELETED", "Excluída pelo cliente (LGPD)", {
    content: {},
    theme: {},
    gateHashes: [],
    slug: null,
    editTokenHash: null,
    editTokenExpiresAt: null,
  });
  await clearPageCookie(id);
  log.info("page.deleted_by_customer", { pageId: page.id });
  return json({ ok: true });
});
