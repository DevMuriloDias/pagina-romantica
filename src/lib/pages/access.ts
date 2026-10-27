import "server-only";
import type { Page } from "@prisma/client";
import { cookies } from "next/headers";
import { ApiError } from "../api";
import { randomToken, safeEqual, sha256, signToken, verifyToken } from "../crypto";
import { db } from "../db";
import { env } from "../env";

const PAGE_COOKIE = (pageId: string) => `aep_p_${pageId}`;
export const CURRENT_COOKIE = "aep_current";
const CUSTOMER_COOKIE = "aep_customer";
const DAY = 86_400;
export const EDIT_TOKEN_TTL_DAYS = 90;

function cookieOpts(maxAgeSec: number) {
  return { httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: maxAgeSec };
}

export async function setPageCookie(pageId: string, token: string) {
  const jar = await cookies();
  jar.set(PAGE_COOKIE(pageId), token, cookieOpts(120 * DAY));
  jar.set(CURRENT_COOKIE, pageId, { ...cookieOpts(120 * DAY), httpOnly: true });
}

export async function clearPageCookie(pageId: string) {
  const jar = await cookies();
  jar.delete(PAGE_COOKIE(pageId));
  if (jar.get(CURRENT_COOKIE)?.value === pageId) jar.delete(CURRENT_COOKIE);
}

/** Cookie de acesso a partir de uma concessão assinada (sem expor o token original do rascunho). */
export async function setGrantCookie(pageId: string) {
  await setPageCookie(pageId, `g.${signToken("grant", { pageId }, 120 * DAY)}`);
}

export function newDraftToken() {
  const token = randomToken(32);
  return { token, hash: sha256(token) };
}

/** Gera (ou renova) o token do link mágico de edição. O texto puro só existe no e-mail. */
export async function issueEditToken(pageId: string): Promise<string> {
  const token = randomToken(32);
  await db.page.update({
    where: { id: pageId },
    data: { editTokenHash: sha256(token), editTokenExpiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_DAYS * DAY * 1000) },
  });
  return token;
}

export function tokenMatches(page: Pick<Page, "draftTokenHash" | "editTokenHash" | "editTokenExpiresAt">, token: string): "draft" | "edit" | null {
  const h = sha256(token);
  if (safeEqual(h, page.draftTokenHash)) return "draft";
  if (page.editTokenHash && page.editTokenExpiresAt && page.editTokenExpiresAt > new Date() && safeEqual(h, page.editTokenHash)) return "edit";
  return null;
}

// ───────────── Sessão do cliente ("Minhas páginas", via magic link) ─────────────

export async function setCustomerSession(email: string) {
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, signToken("customer", { email }, 30 * DAY), cookieOpts(30 * DAY));
}

export async function getCustomerSession(): Promise<string | null> {
  const jar = await cookies();
  return verifyToken<{ email: string }>("customer", jar.get(CUSTOMER_COOKIE)?.value)?.email ?? null;
}

export async function clearCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/**
 * Resolve o acesso de edição a uma página pelo cookie do navegador:
 * token do rascunho, token do link mágico (com renovação deslizante) ou sessão do cliente dono.
 */
export async function getEditablePage(pageId: string): Promise<Page | null> {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page || page.status === "DELETED") return null;
  const jar = await cookies();
  const token = jar.get(PAGE_COOKIE(pageId))?.value;
  if (token?.startsWith("g.")) {
    // Concessão assinada (link "continuar depois" enviado por e-mail)
    const grant = verifyToken<{ pageId: string }>("grant", token.slice(2));
    if (grant?.pageId === page.id && (page.status === "DRAFT" || page.status === "PENDING_PAYMENT")) return page;
  } else if (token) {
    const kind = tokenMatches(page, token);
    if (kind === "draft") return page;
    if (kind === "edit") {
      const renewAfter = Date.now() + (EDIT_TOKEN_TTL_DAYS - 7) * DAY * 1000;
      if (page.editTokenExpiresAt && page.editTokenExpiresAt.getTime() < renewAfter) {
        await db.page.update({ where: { id: page.id }, data: { editTokenExpiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_DAYS * DAY * 1000) } });
      }
      return page;
    }
  }
  const email = await getCustomerSession();
  if (email && page.customerId) {
    const customer = await db.customer.findUnique({ where: { id: page.customerId } });
    if (customer?.email === email) return page;
  }
  return null;
}

export async function requireEditablePage(pageId: string): Promise<Page> {
  const page = await getEditablePage(pageId);
  if (!page) throw new ApiError(404, "Página não encontrada ou sem permissão de edição.", "not_found");
  return page;
}

export async function currentDraftId(): Promise<string | null> {
  return (await cookies()).get(CURRENT_COOKIE)?.value ?? null;
}
