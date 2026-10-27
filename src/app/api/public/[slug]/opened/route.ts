import { clientIp, enforceRate, json, route } from "@/lib/api";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/log";
import { requirePublicPage } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { LIMITS } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ slug: string }> };

/** Registra a abertura; na PRIMEIRA abertura avisa o cliente por e-mail (se ele não desligou). */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const page = await requirePublicPage(slug);
  const ip = await clientIp();
  await enforceRate("public-action", `${ip}:${page.id}`, LIMITS.publicAction.limit, LIMITS.publicAction.window);
  await db.pageEvent.create({ data: { pageId: page.id, type: "OPENED", ipHash: hashIp(ip) } });
  const first = await db.page.updateMany({ where: { id: page.id, firstOpenedAt: null }, data: { firstOpenedAt: new Date() } });
  if (first.count === 1 && page.customer?.email) {
    const { content } = pageView(page);
    if (content.settings.notifyOnOpen) {
      void sendEmail("page_opened", page.customer.email, { recipientName: content.meta.recipientName, pageUrl: appUrl(`/p/${slug}`) }, { pageId: page.id }).catch((err) =>
        log.warn("opened.email_failed", { err }),
      );
    }
  }
  return json({ ok: true });
});
