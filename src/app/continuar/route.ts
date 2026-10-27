import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { setGrantCookie } from "@/lib/pages/access";

/** Link "continuar depois" (enviado por e-mail): reabre o rascunho neste navegador. */
export async function GET(req: Request) {
  const data = verifyToken<{ pageId: string }>("resume", new URL(req.url).searchParams.get("t"));
  const page = data ? await db.page.findUnique({ where: { id: data.pageId }, select: { id: true, status: true } }) : null;
  if (!page || (page.status !== "DRAFT" && page.status !== "PENDING_PAYMENT")) {
    return NextResponse.redirect(appUrl("/criar?erro=link-expirado"));
  }
  await setGrantCookie(page.id);
  return NextResponse.redirect(appUrl(`/criar/editor?page=${page.id}`));
}
