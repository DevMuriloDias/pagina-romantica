import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { MAX_EMAIL_ATTEMPTS, retryDelivery } from "@/lib/email";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Retentativa de e-mails que falharam (ex.: Resend fora do ar). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const failed = await db.emailLog.findMany({
    where: { status: { in: ["FAILED", "PENDING"] }, attempts: { lt: MAX_EMAIL_ATTEMPTS }, updatedAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    take: 30,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const e of failed) {
    if (await retryDelivery(e.id, 1)) {
      sent++;
      if (e.orderId && e.template === "payment_approved") await db.order.update({ where: { id: e.orderId }, data: { emailSentAt: new Date() } });
    }
  }
  log.info("cron.emails", { retried: failed.length, sent });
  return Response.json({ retried: failed.length, sent });
}
