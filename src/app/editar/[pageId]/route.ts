import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { EDIT_TOKEN_TTL_DAYS, setPageCookie, tokenMatches } from "@/lib/pages/access";

type Ctx = { params: Promise<{ pageId: string }> };

/** Link mágico de edição (enviado no e-mail de aprovação). Renova a validade a cada uso. */
export async function GET(req: Request, { params }: Ctx) {
  const { pageId } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page || page.status === "DELETED" || tokenMatches(page, token) !== "edit") {
    return NextResponse.redirect(appUrl("/minhas-paginas?erro=link-invalido"));
  }
  await db.page.update({ where: { id: pageId }, data: { editTokenExpiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_DAYS * 86_400_000) } });
  await setPageCookie(pageId, token);
  return NextResponse.redirect(appUrl(`/criar/editor?page=${pageId}`));
}
