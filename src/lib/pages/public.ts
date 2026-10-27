import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { ApiError } from "../api";
import { signToken, verifyToken } from "../crypto";
import { db } from "../db";
import { env } from "../env";

/** Página pública: só existe se estiver paga (PUBLISHED) e dentro da validade do plano. */
export const getPublicPage = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  const page = await db.page.findUnique({ where: { slug }, include: { customer: { select: { email: true } } } });
  if (!page || page.status !== "PUBLISHED") return null;
  if (page.expiresAt && page.expiresAt < new Date()) return null;
  return page;
});

export async function requirePublicPage(slug: string) {
  const page = await getPublicPage(slug);
  if (!page) throw new ApiError(404, "Página não encontrada.", "not_found");
  return page;
}

const unlockCookie = (pageId: string) => `aep_u_${pageId}`;

export async function setUnlocked(pageId: string) {
  (await cookies()).set(unlockCookie(pageId), signToken("unlock", { pageId }, 30 * 86_400), {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
}

export async function isUnlocked(pageId: string): Promise<boolean> {
  const v = verifyToken<{ pageId: string }>("unlock", (await cookies()).get(unlockCookie(pageId))?.value);
  return v?.pageId === pageId;
}
