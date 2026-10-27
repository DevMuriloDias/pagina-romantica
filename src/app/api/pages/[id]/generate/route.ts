import type { Prisma } from "@prisma/client";
import { json, parseBody, route } from "@/lib/api";
import { generateDraftContent } from "@/lib/ai/actions";
import { consumeAiQuota } from "@/lib/ai/limits";
import { moderateInput } from "@/lib/ai/moderation";
import { buildContent } from "@/lib/content/defaults";
import { QuestionnaireSchema } from "@/lib/content/questionnaire";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requireEditablePage } from "@/lib/pages/access";
import { sanitizeDeep } from "@/lib/sanitize";
import { getTemplate } from "@/lib/theme";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/**
 * Gera o primeiro rascunho a partir do questionário.
 * Nunca falha por causa da IA: limite estourado, moderação ou erro → textos padrão.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const answers = sanitizeDeep(await parseBody(req, QuestionnaireSchema));
  const template = getTemplate(answers.templateId);

  let result: { content: ReturnType<typeof buildContent>; source: "ai" | "fallback"; templateId?: string; notice?: string };
  const moderation = moderateInput(answers.howWeMet, answers.memories.join(" "), answers.lovedThings, answers.insideJokes);
  if (!moderation.ok) {
    result = { content: buildContent({ ...answers, howWeMet: "", memories: [], lovedThings: "", insideJokes: "" }), source: "fallback", notice: moderation.reason };
  } else {
    try {
      await consumeAiQuota(page.id);
      result = await generateDraftContent(answers);
    } catch (err) {
      log.warn("generate.quota_or_error", { pageId: id, err });
      result = { content: buildContent(answers), source: "fallback", notice: err instanceof Error ? err.message : undefined };
    }
  }

  // Respeita o estilo escolhido pela pessoa; a sugestão da IA só vale se ela não escolheu.
  const theme = getTemplate(answers.templateId || result.templateId || template.id).theme;
  await db.page.update({
    where: { id: page.id },
    data: { content: result.content as unknown as Prisma.InputJsonValue, theme: theme as unknown as Prisma.InputJsonValue },
  });
  return json({ content: result.content, theme, source: result.source, notice: result.notice });
});
