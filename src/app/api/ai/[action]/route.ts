import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { AiError, improveTextStream, suggestList, suggestQuiz, writeLetterStream } from "@/lib/ai/actions";
import { consumeAiQuota } from "@/lib/ai/limits";
import { moderateInput } from "@/lib/ai/moderation";
import { IMPROVE_MODES } from "@/lib/ai/prompts/text";
import { TONES } from "@/lib/content/schema";
import { requireEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

type Ctx = { params: Promise<{ action: string }> };

export const maxDuration = 60;

const Base = z.object({ pageId: z.string().min(1).max(40) });
const Context = z.string().max(3000).default("");
const Tone = z.enum(TONES).optional();

const Schemas = {
  letter: Base.extend({ context: Context, openWhen: z.string().max(80).optional(), tone: Tone }),
  improve: Base.extend({ text: z.string().trim().min(1, "Escreva algo para a IA melhorar").max(6000), mode: z.enum(Object.keys(IMPROVE_MODES) as [keyof typeof IMPROVE_MODES]) }),
  reasons: Base.extend({ context: Context, count: z.number().int().min(1).max(15).default(8), tone: Tone }),
  captions: Base.extend({ context: Context, count: z.number().int().min(1).max(10).default(5), tone: Tone }),
  titles: Base.extend({ context: Context, tone: Tone }),
  quiz: Base.extend({ context: Context, count: z.number().int().min(1).max(8).default(4) }),
} as const;

function streamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function prepare<T extends { pageId: string }>(req: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  const body = await parseBody(req, schema);
  const page = await requireEditablePage(body.pageId);
  const { content } = pageView(page);
  const texts = Object.values(body).filter((v): v is string => typeof v === "string");
  const mod = moderateInput(...texts);
  if (!mod.ok) throw new ApiError(422, mod.reason, "moderation");
  await consumeAiQuota(page.id);
  const tone = ("tone" in body && typeof body.tone === "string" && body.tone) || content.meta.tone;
  return { body, meta: content.meta, tone };
}

/** Ações de IA do editor. A chave da Anthropic nunca vai para o cliente. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  try {
    switch (action) {
      case "letter": {
        const { body, meta, tone } = await prepare(req, Schemas.letter);
        return streamResponse(writeLetterStream({ tone, senderName: meta.senderName, recipientName: meta.recipientName, context: body.context, openWhen: body.openWhen }));
      }
      case "improve": {
        const { body } = await prepare(req, Schemas.improve);
        return streamResponse(improveTextStream(body.mode, body.text));
      }
      case "reasons":
      case "captions": {
        const { body, meta, tone } = await prepare(req, Schemas[action]);
        return json({ items: await suggestList(action, { tone, recipientName: meta.recipientName, occasion: meta.occasion, context: body.context, count: body.count }) });
      }
      case "titles": {
        const { body, meta, tone } = await prepare(req, Schemas.titles);
        return json({ items: await suggestList("titles", { tone, recipientName: meta.recipientName, occasion: meta.occasion, context: body.context, count: 5 }) });
      }
      case "quiz": {
        const { body, meta } = await prepare(req, Schemas.quiz);
        return json({ items: await suggestQuiz({ context: body.context, count: body.count, senderName: meta.senderName }) });
      }
      default:
        throw new ApiError(404, "Ação desconhecida", "not_found");
    }
  } catch (err) {
    if (err instanceof AiError) throw new ApiError(err.kind === "refused" ? 422 : 503, err.kind === "refused" ? err.message : "A IA está indisponível agora. Tente de novo em instantes.", `ai_${err.kind}`);
    throw err;
  }
});
