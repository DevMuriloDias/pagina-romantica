import { z } from "zod";
import { clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requirePublicPage } from "@/lib/pages/public";

type Ctx = { params: Promise<{ slug: string }> };

/** Denúncia de página (moderação pelo admin). */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const page = await requirePublicPage(slug);
  const { reason, details } = await parseBody(
    req,
    z.object({ reason: z.enum(["conteudo_ofensivo", "conteudo_sexual", "golpe", "privacidade", "outro"]), details: z.string().trim().max(1000).default("") }),
  );
  const ip = await clientIp();
  await enforceRate("report", ip, 5, 3600);
  await db.pageEvent.create({ data: { pageId: page.id, type: "REPORT", data: { reason, details }, ipHash: hashIp(ip) } });
  log.warn("page.reported", { pageId: page.id, reason });
  return json({ ok: true });
});
