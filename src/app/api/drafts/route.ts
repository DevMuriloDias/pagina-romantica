import type { Prisma } from "@prisma/client";
import { clientIp, enforceRate, json, route } from "@/lib/api";
import { emptyContent } from "@/lib/content/defaults";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/ratelimit";
import { newDraftToken, setPageCookie } from "@/lib/pages/access";
import { DEFAULT_TEMPLATE } from "@/lib/theme";

/** Cria um rascunho anônimo. O token fica só no cookie httpOnly (no banco guardamos o hash). */
export const POST = route(async () => {
  const ip = await clientIp();
  await enforceRate("draft-create", ip, LIMITS.draftCreate.limit, LIMITS.draftCreate.window);
  const { token, hash } = newDraftToken();
  const page = await db.page.create({
    data: {
      content: emptyContent() as unknown as Prisma.InputJsonValue,
      theme: DEFAULT_TEMPLATE.theme as unknown as Prisma.InputJsonValue,
      draftTokenHash: hash,
    },
    select: { id: true },
  });
  await setPageCookie(page.id, token);
  return json({ pageId: page.id }, { status: 201 });
});
