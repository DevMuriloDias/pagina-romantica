import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, secret = env().APP_SECRET): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Hash de IP para logs/eventos sem guardar o IP em claro (LGPD). */
export function hashIp(ip: string): string {
  return hmac(`ip:${ip}`).slice(0, 32);
}

/**
 * Token assinado e com expiração (formato: base64url(json).assinatura).
 * Usado em magic links e sessões sem estado.
 */
export function signToken<T extends Record<string, unknown>>(purpose: string, payload: T, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, p: purpose, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  return `${body}.${hmac(`${purpose}.${body}`)}`;
}

export function verifyToken<T>(purpose: string, token: string | undefined | null): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(`${purpose}.${body}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number; p: string };
    if (data.p !== purpose) return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
