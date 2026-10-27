import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { log } from "@/lib/log";
import { paymentProvider } from "@/lib/payments";
import { syncOrderWithPayment } from "@/lib/payments/fulfill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reconciliação: confere direto na API os pedidos pendentes (caso algum webhook tenha se perdido). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const pending = await db.order.findMany({
    where: { status: "PENDING", mpPaymentId: { not: null }, createdAt: { lt: new Date(now - 2 * 60_000), gt: new Date(now - 7 * 86_400_000) } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let changed = 0;
  let expired = 0;
  for (const order of pending) {
    try {
      const payment = await paymentProvider().getPayment(order.mpPaymentId!);
      const r = await syncOrderWithPayment(order.id, payment);
      if (r.changed) changed++;
      // Pix muito além da expiração e ainda pendente no provedor: encerramos localmente.
      if (!r.changed && order.method === "PIX" && order.pixExpiresAt && order.pixExpiresAt.getTime() < now - 60 * 60_000) {
        await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "EXPIRED", statusDetail: "expired_local" } });
        await db.page.updateMany({ where: { id: order.pageId, status: "PENDING_PAYMENT" }, data: { status: "DRAFT" } });
        expired++;
      }
    } catch (err) {
      log.error("cron.reconcile_error", { orderId: order.id, err });
    }
  }
  log.info("cron.reconcile", { checked: pending.length, changed, expired });
  return Response.json({ checked: pending.length, changed, expired });
}
