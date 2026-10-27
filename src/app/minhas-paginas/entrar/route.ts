import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { setCustomerSession } from "@/lib/pages/access";

export async function GET(req: Request) {
  const data = verifyToken<{ email: string }>("login", new URL(req.url).searchParams.get("t"));
  if (!data) return NextResponse.redirect(appUrl("/minhas-paginas?erro=link-expirado"));
  await setCustomerSession(data.email);
  return NextResponse.redirect(appUrl("/minhas-paginas"));
}
