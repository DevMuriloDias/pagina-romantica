import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { moderateInput } from "@/lib/ai/moderation";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/log";
import { isUnlocked, requirePublicPage } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { LIMITS } from "@/lib/ratelimit";
import { sanitizeDeep } from "@/lib/sanitize";

type Ctx = { params: Promise<{ slug: string }> };

const Schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("proposal"), sectionId: z.string().max(40), answer: z.enum(["yes", "no"]) }),
  z.object({ type: z.literal("coupon"), sectionId: z.string().max(40), couponId: z.string().max(40) }),
  z.object({ type: z.literal("guestbook"), sectionId: z.string().max(40), message: z.string().trim().min(1).max(1000), name: z.string().trim().max(60).default("") }),
]);

/** Interações do destinatário: resposta do pedido, cupom resgatado e recado. O cliente recebe e-mail. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const page = await requirePublicPage(slug);
  const { content } = pageView(page);
  if (content.gate.mode !== "none" && content.gate.answersCount > 0 && !(await isUnlocked(page.id))) throw new ApiError(403, "Página bloqueada.", "locked");
  const ip = await clientIp();
  await enforceRate("public-action", `${ip}:${page.id}`, LIMITS.publicAction.limit, LIMITS.publicAction.window);
  const body = sanitizeDeep(await parseBody(req, Schema));
  const section = content.sections.find((s) => s.id === body.sectionId);
  const owner = page.customer?.email;
  const editUrl = appUrl(`/minhas-paginas`);

  if (body.type === "proposal") {
    if (section?.type !== "proposal") throw new ApiError(400, "Seção inválida.", "bad_section");
    const already = await db.pageEvent.findFirst({ where: { pageId: page.id, type: "PROPOSAL_ANSWER" } });
    await db.pageEvent.create({ data: { pageId: page.id, type: "PROPOSAL_ANSWER", data: { answer: body.answer, question: section.data.question }, ipHash: hashIp(ip) } });
    if (owner && !already) {
      void sendEmail("proposal_answer", owner, { answer: body.answer, question: section.data.question, recipientName: content.meta.recipientName }, { pageId: page.id }).catch((err) => log.warn("action.email_failed", { err }));
    }
    return json({ ok: true });
  }

  if (body.type === "coupon") {
    if (section?.type !== "coupons") throw new ApiError(400, "Seção inválida.", "bad_section");
    const coupon = section.data.coupons.find((c) => c.id === body.couponId);
    if (!coupon) throw new ApiError(400, "Vale não encontrado.", "bad_coupon");
    const existing = await db.pageEvent.findFirst({ where: { pageId: page.id, type: "COUPON_REDEEMED", data: { path: ["couponId"], equals: coupon.id } } });
    if (existing) return json({ ok: true, message: "Esse vale já foi resgatado — agora é só cobrar 😉" });
    await db.pageEvent.create({ data: { pageId: page.id, type: "COUPON_REDEEMED", data: { couponId: coupon.id, title: coupon.title } as Prisma.InputJsonValue, ipHash: hashIp(ip) } });
    if (owner) void sendEmail("coupon_redeemed", owner, { couponTitle: coupon.title, recipientName: content.meta.recipientName }, { pageId: page.id }).catch((err) => log.warn("action.email_failed", { err }));
    return json({ ok: true, message: "Resgatado! Já avisei quem te deu 💌" });
  }

  if (section?.type !== "guestbook") throw new ApiError(400, "Seção inválida.", "bad_section");
  const mod = moderateInput(body.message, body.name);
  if (!mod.ok) throw new ApiError(422, "Não foi possível enviar este recado.", "moderation");
  await db.pageEvent.create({ data: { pageId: page.id, type: "GUESTBOOK", data: { message: body.message, name: body.name }, ipHash: hashIp(ip) } });
  if (owner) void sendEmail("guestbook", owner, { message: body.message, name: body.name, editUrl }, { pageId: page.id }).catch((err) => log.warn("action.email_failed", { err }));
  return json({ ok: true, message: "Só quem criou esta página vai ler 💕" });
});
