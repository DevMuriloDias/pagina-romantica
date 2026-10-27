import "server-only";
import type { Page, PageStatus, Prisma } from "@prisma/client";
import { ApiError } from "../api";
import { emptyContent } from "../content/defaults";
import { safeMigrateContent } from "../content/migrations";
import { ContentSchema, type PageContent } from "../content/schema";
import { db } from "../db";
import { log } from "../log";
import { parseMusicUrl } from "../music";
import { countUsage, planViolations } from "../plans";
import { sanitizeDeep } from "../sanitize";
import { parseTheme, ThemeSchema, type Theme } from "../theme";

export function pageView(page: Pick<Page, "id" | "content" | "theme">): { content: PageContent; theme: Theme } {
  const content = safeMigrateContent(page.content);
  if (!content) log.error("page.content_invalid", { pageId: page.id });
  return { content: content ?? emptyContent(), theme: parseTheme(page.theme) };
}

/** Normaliza a música: o ID é sempre extraído no servidor a partir do link. */
export function resolveMusic(content: PageContent): PageContent {
  const m = content.music;
  if (m.provider === "none" || !m.url) return { ...content, music: { ...m, provider: "none", mediaId: "" } };
  const parsed = parseMusicUrl(m.url);
  if (!parsed) return { ...content, music: { ...m, provider: "none", mediaId: "" } };
  return {
    ...content,
    music: {
      ...m,
      provider: parsed.provider,
      mediaId: parsed.mediaId,
      spotifyType: parsed.provider === "spotify" ? parsed.spotifyType : m.spotifyType,
      startAt: parsed.provider === "youtube" && parsed.startAt && !m.startAt ? parsed.startAt : m.startAt,
    },
  };
}

export async function savePage(page: Page, input: { content?: unknown; theme?: unknown }) {
  const data: Prisma.PageUpdateInput = {};
  if (input.content !== undefined) {
    let content = ContentSchema.parse(sanitizeDeep(input.content));
    content = resolveMusic(content);
    // As respostas da porta vivem em gateHashes; mantemos a contagem consistente.
    content.gate.answersCount = page.gateHashes.length;
    if (page.status === "PUBLISHED" && page.planId) {
      const plan = await db.plan.findUnique({ where: { id: page.planId } });
      if (plan) {
        const violations = planViolations(plan.limits, countUsage(content));
        if (violations.length) {
          throw new ApiError(422, `${violations[0]!.message} Sua página publicada usa o plano ${plan.name}.`, "plan_limit", { violations });
        }
      }
    }
    data.content = content as unknown as Prisma.InputJsonValue;
  }
  if (input.theme !== undefined) {
    data.theme = ThemeSchema.parse(sanitizeDeep(input.theme)) as unknown as Prisma.InputJsonValue;
  }
  return db.page.update({ where: { id: page.id }, data, select: { id: true, updatedAt: true } });
}

export async function setPageStatus(pageId: string, to: PageStatus, reason: string, extra: Prisma.PageUpdateInput = {}) {
  return db.$transaction(async (tx) => {
    const current = await tx.page.findUniqueOrThrow({ where: { id: pageId }, select: { status: true } });
    const page = await tx.page.update({ where: { id: pageId }, data: { status: to, ...extra } });
    await tx.pageHistory.create({ data: { pageId, from: current.status, to, reason } });
    return page;
  });
}
