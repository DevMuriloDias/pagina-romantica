import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { log } from "./log";
import { rateLimit, type RateResult } from "./ratelimit";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Corpo da requisição inválido.", "invalid_json");
  }
  return schema.parse(raw);
}

/** Envolve um handler de rota: erros viram respostas JSON amigáveis em PT-BR. */
export function route<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, code: err.code, ...err.extra }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return json(
          { error: first ? `Dados inválidos (${first.path.join(".") || "campo"}): ${first.message}` : "Dados inválidos.", code: "validation", issues: err.issues.slice(0, 10) },
          { status: 400 },
        );
      }
      log.error("api.unhandled", { err });
      return json({ error: "Algo deu errado do nosso lado. Tente novamente em instantes.", code: "internal" }, { status: 500 });
    }
  };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}

export async function enforceRate(bucket: string, id: string, limit: number, windowSec: number, message = "Muitas tentativas. Aguarde um pouco e tente de novo."): Promise<RateResult> {
  const r = await rateLimit(bucket, id, limit, windowSec);
  if (!r.ok) throw new ApiError(429, message, "rate_limited", { retryAt: r.resetAt });
  return r;
}
