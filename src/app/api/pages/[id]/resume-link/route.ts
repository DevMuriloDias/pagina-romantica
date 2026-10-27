import { z } from "zod";
import { clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { signToken } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { requireEditablePage } from "@/lib/pages/access";
import { LIMITS } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ id: string }> };

/** "Receber link para continuar depois": envia um link assinado que reabre o rascunho em outro dispositivo. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const { email } = await parseBody(req, z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido") }));
  await enforceRate("email-ip", await clientIp(), LIMITS.email.limit, LIMITS.email.window);
  await enforceRate("email-to", email, LIMITS.email.limit, LIMITS.email.window);
  const token = signToken("resume", { pageId: page.id }, 30 * 86_400);
  await sendEmail("continue_draft", email, { resumeUrl: appUrl(`/continuar?t=${encodeURIComponent(token)}`) }, { pageId: page.id });
  return json({ ok: true });
});
