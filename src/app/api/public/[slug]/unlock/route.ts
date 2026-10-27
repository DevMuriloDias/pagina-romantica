import { z } from "zod";
import { clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { checkGateAnswer } from "@/lib/pages/gate";
import { requirePublicPage, setUnlocked } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { LIMITS } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ slug: string }> };

/** Verifica a resposta da tela de entrada. Rate limit por IP e por página. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const page = await requirePublicPage(slug);
  const { answer } = await parseBody(req, z.object({ answer: z.string().max(200) }));
  const ip = await clientIp();
  const msg = "Muitas tentativas. Respira fundo e tenta de novo daqui a alguns minutinhos 💕";
  await enforceRate("gate-ip", `${ip}:${page.id}`, LIMITS.gateAttemptIp.limit, LIMITS.gateAttemptIp.window, msg);
  await enforceRate("gate-page", page.id, LIMITS.gateAttemptPage.limit, LIMITS.gateAttemptPage.window, msg);
  const { content, theme } = pageView(page);
  const ok = content.gate.mode === "none" || (await checkGateAnswer(page.gateHashes, content.gate.mode, answer));
  if (!ok) {
    await db.pageEvent.create({ data: { pageId: page.id, type: "UNLOCK_FAILED", ipHash: hashIp(ip) } });
    return json({ ok: false, message: content.gate.errorMessage || "Resposta incorreta. Tente de novo 💕" });
  }
  await setUnlocked(page.id);
  return json({ ok: true, content, theme });
});
