import { z } from "zod";
import { clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { signToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { LIMITS } from "@/lib/ratelimit";

/** "Minhas páginas": envia magic link. A resposta é sempre igual (não revela se o e-mail existe). */
export const POST = route(async (req: Request) => {
  const { email } = await parseBody(req, z.object({ email: z.string().trim().toLowerCase().email("Informe um e-mail válido") }));
  await enforceRate("email-ip", await clientIp(), LIMITS.email.limit, LIMITS.email.window);
  await enforceRate("email-to", email, 3, 3600);
  const customer = await db.customer.findUnique({ where: { email } });
  if (customer) {
    const token = signToken("login", { email }, 30 * 60);
    await sendEmail("my_pages", email, { loginUrl: appUrl(`/minhas-paginas/entrar?t=${encodeURIComponent(token)}`) });
  }
  return json({ ok: true });
});
