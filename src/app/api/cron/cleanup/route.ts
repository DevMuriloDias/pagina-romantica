import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { deletePrefix } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** LGPD: apaga rascunhos não pagos (e suas fotos) após DRAFT_RETENTION_DAYS, e uploads abandonados. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const cutoff = new Date(Date.now() - env().DRAFT_RETENTION_DAYS * 86_400_000);
  const stale = await db.page.findMany({
    where: {
      status: { in: ["DRAFT", "PENDING_PAYMENT", "DELETED"] },
      updatedAt: { lt: cutoff },
      orders: { none: { status: { in: ["APPROVED", "PENDING"] } } },
    },
    select: { id: true, assets: { select: { key: true } } },
    take: 200,
  });
  for (const page of stale) {
    await deletePrefix(page.assets.map((a) => a.key));
    await db.page.delete({ where: { id: page.id } }).catch((err) => log.error("cron.cleanup_delete_error", { pageId: page.id, err }));
  }
  const abandoned = await db.asset.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86_400_000) } }, select: { id: true, key: true }, take: 500 });
  await deletePrefix(abandoned.map((a) => a.key));
  await db.asset.deleteMany({ where: { id: { in: abandoned.map((a) => a.id) } } });
  log.info("cron.cleanup", { pages: stale.length, assets: abandoned.length });
  return Response.json({ pagesDeleted: stale.length, abandonedAssets: abandoned.length });
}
