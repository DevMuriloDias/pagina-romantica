import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";
import { log } from "./log";

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

const memory = new Map<string, number[]>();
const limiters = new Map<string, Ratelimit>();
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  redis = url && token ? new Redis({ url, token }) : null;
  if (!redis && env().NODE_ENV === "production") log.warn("ratelimit.memory_fallback", { hint: "Configure UPSTASH_REDIS_REST_URL" });
  return redis;
}

function memoryLimit(key: string, limit: number, windowSec: number): RateResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  const ok = hits.length < limit;
  if (ok) hits.push(now);
  memory.set(key, hits);
  if (memory.size > 50_000) memory.clear(); // proteção de memória
  return { ok, remaining: Math.max(0, limit - hits.length), resetAt: (hits[0] ?? now) + windowMs };
}

/**
 * Limitador por janela deslizante. Usa Upstash Redis quando configurado;
 * caso contrário, memória local (adequado apenas para dev/instância única).
 */
export async function rateLimit(bucket: string, id: string, limit: number, windowSec: number): Promise<RateResult> {
  const key = `${bucket}:${id}`;
  const r = getRedis();
  if (!r) return memoryLimit(key, limit, windowSec);
  const cacheKey = `${bucket}:${limit}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`), prefix: `rl:${bucket}` });
    limiters.set(cacheKey, limiter);
  }
  try {
    const res = await limiter.limit(id);
    return { ok: res.success, remaining: res.remaining, resetAt: res.reset };
  } catch (err) {
    log.error("ratelimit.redis_error", { err });
    return memoryLimit(key, limit, windowSec);
  }
}

/** Limites padrão do produto (centralizados para fácil ajuste). */
export const LIMITS = {
  gateAttemptIp: { limit: 20, window: 600 },
  gateAttemptPage: { limit: 60, window: 600 },
  payment: { limit: 10, window: 600 },
  email: { limit: 5, window: 3600 },
  upload: { limit: 120, window: 3600 },
  geocode: { limit: 30, window: 60 },
  publicAction: { limit: 30, window: 600 },
  draftCreate: { limit: 20, window: 3600 },
  adminLogin: { limit: 10, window: 900 },
} as const;
