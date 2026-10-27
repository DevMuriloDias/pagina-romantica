import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType, ZodTypeDef } from "zod";
import { env } from "../env";
import { log } from "../log";
import { RefusalSchema } from "./schemas";

export class AiError extends Error {
  constructor(
    message: string,
    public kind: "unavailable" | "refused" | "invalid" | "provider",
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new AiError("IA não configurada", "unavailable");
  client ??= new Anthropic({ apiKey: key, maxRetries: 2, timeout: 60_000 });
  return client;
}

type Effort = "low" | "medium" | "high";

/** Parâmetros comuns. O fallback server-side reencaminha recusas de classificador para outro modelo. */
function baseParams(system: string, maxTokens: number, effort: Effort) {
  const fallback = env().AI_SERVER_FALLBACK;
  return {
    model: env().AI_MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort },
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}

function textOf(content: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new SyntaxError("Resposta sem JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Pede JSON ao modelo e valida com Zod. Se vier inválido, faz UMA nova tentativa
 * informando o erro de validação ao modelo.
 */
export async function completeJson<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  system: string,
  user: string,
  opts: { maxTokens?: number; effort?: Effort } = {},
): Promise<T> {
  const c = getClient();
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: user }];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await c.beta.messages.create({ ...baseParams(system, opts.maxTokens ?? 8000, opts.effort ?? "low"), messages });
    } catch (err) {
      log.error("ai.provider_error", { err });
      throw new AiError("A IA está indisponível no momento.", "provider");
    }
    if (res.stop_reason === "refusal") throw new AiError("Não foi possível gerar esse conteúdo.", "refused");
    const text = textOf(res.content);
    try {
      const raw = extractJson(text);
      const refusal = RefusalSchema.safeParse(raw);
      if (refusal.success) throw new AiError(refusal.data.reason || "Pedido recusado pelas regras de conteúdo.", "refused");
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (err) {
      if (err instanceof AiError) throw err;
      lastError = err instanceof Error ? err.message : "JSON inválido";
    }
    log.warn("ai.invalid_json", { attempt, lastError });
    messages.push({ role: "assistant", content: text || "{}" });
    messages.push({ role: "user", content: `Sua resposta não passou na validação (${lastError}). Responda novamente APENAS com o JSON válido no formato pedido.` });
  }
  throw new AiError("A IA devolveu uma resposta inválida.", "invalid");
}

/** Streaming de texto (cartas): devolve um ReadableStream de texto puro para o navegador. */
export function streamText(system: string, user: string, opts: { maxTokens?: number; effort?: Effort } = {}): ReadableStream<Uint8Array> {
  const c = getClient();
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = c.beta.messages.stream({ ...baseParams(system, opts.maxTokens ?? 4000, opts.effort ?? "low"), messages: [{ role: "user", content: user }] });
        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n[Não foi possível gerar esse conteúdo.]"));
        controller.close();
      } catch (err) {
        log.error("ai.stream_error", { err });
        controller.error(err);
      }
    },
  });
}
