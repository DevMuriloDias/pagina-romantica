import "server-only";
import { safeEqual } from "./crypto";
import { env } from "./env";

/** Rotas de cron exigem "Authorization: Bearer <CRON_SECRET>" (padrão da Vercel Cron). */
export function cronAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return env().NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
