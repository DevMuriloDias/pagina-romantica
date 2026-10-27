import "server-only";
import type { Order, OrderStatus, Page, Plan, Prisma } from "@prisma/client";
import { db } from "../db";
import { sendEmail } from "../email";
import { appUrl } from "../env";
import { formatDate } from "../format";
import { log } from "../log";
import { issueEditToken } from "../pages/access";
import { pageView } from "../pages/service";
import { PlanLimitsSchema } from "../plans";
import { publicSlug } from "../slug";
import { mapStatus } from "./status";
import type { ProviderPayment } from "./types";

type OrderWithRelations = Order & { page: Page; plan: Plan; customer: { email: string } };

export interface SyncResult {
  changed: boolean;
  status: OrderStatus;
}

/**
 * Aplica o estado real do pagamento (buscado na API do provedor) ao pedido.
 * Idempotente: pode ser chamado várias vezes para o mesmo pagamento (webhooks repetidos,
 * reconciliação, SSE) e só executa os efeitos colaterais na primeira transição.
 */
export async function syncOrderWithPayment(orderId: string, payment: ProviderPayment): Promise<SyncResult> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { page: true, plan: true, customer: { select: { email: true } } } });
  if (!order) throw new Error(`Pedido não encontrado: ${orderId}`);

  if (payment.externalReference && payment.externalReference !== order.id) {
    log.error("payment.reference_mismatch", { orderId, paymentId: payment.id, ref: payment.externalReference });
    return { changed: false, status: order.status };
  }

  let next = mapStatus(payment.status, payment.statusDetail, payment.method);
  if (next === "APPROVED" && payment.amountCents < order.amountCents) {
    log.error("payment.amount_mismatch", { orderId, expected: order.amountCents, got: payment.amountCents });
    next = "PENDING";
  }

  await db.order.update({
    where: { id: order.id },
    data: { lastCheckedAt: new Date(), statusDetail: payment.statusDetail, mpPaymentId: order.mpPaymentId ?? payment.id },
  });

  if (next === order.status) return { changed: false, status: order.status };

  // Reivindica a transição de forma atômica: só um processo executa os efeitos.
  const claimed = await db.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: next, ...(next === "APPROVED" ? { paidAt: new Date() } : {}) },
  });
  if (claimed.count === 0) {
    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    return { changed: false, status: fresh.status };
  }
  log.info("order.status_changed", { orderId: order.id, from: order.status, to: next, paymentId: payment.id });

  if (next === "APPROVED") await onApproved(order);
  else if (next === "REFUNDED" || next === "CHARGED_BACK") await onReversed(order, next);
  else if (next === "REJECTED" || next === "EXPIRED" || next === "CANCELLED") await onFailed(order);

  return { changed: true, status: next };
}

async function uniqueSlug(page: Page, requested: string | null, allowCustom: boolean): Promise<{ slug: string; custom: boolean }> {
  if (page.slug) return { slug: page.slug, custom: page.customSlug };
  if (requested && allowCustom) {
    const taken = await db.page.findUnique({ where: { slug: requested }, select: { id: true } });
    if (!taken) return { slug: requested, custom: true };
    log.warn("order.custom_slug_taken", { pageId: page.id, requested });
  }
  const { content } = pageView(page);
  for (let i = 0; i < 5; i++) {
    const slug = publicSlug(content.meta.senderName, content.meta.recipientName);
    const taken = await db.page.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return { slug, custom: false };
  }
  throw new Error("Não foi possível gerar um slug único");
}

async function onApproved(order: OrderWithRelations) {
  const limits = PlanLimitsSchema.parse(order.plan.limits);
  const { slug, custom } = await uniqueSlug(order.page, order.requestedSlug, limits.customSlug);

  // Renovação: se a página já estava paga e ainda ativa, soma o período.
  const base = order.page.expiresAt && order.page.expiresAt > new Date() ? order.page.expiresAt : new Date();
  const expiresAt = limits.durationDays === null ? null : new Date(base.getTime() + limits.durationDays * 86_400_000);

  await db.$transaction(async (tx) => {
    const from = order.page.status;
    await tx.page.update({
      where: { id: order.pageId },
      data: {
        status: "PUBLISHED",
        slug,
        customSlug: custom,
        planId: order.planId,
        customerId: order.customerId,
        publishedAt: order.page.publishedAt ?? new Date(),
        expiresAt,
        unpublishedReason: null,
      } satisfies Prisma.PageUncheckedUpdateInput,
    });
    await tx.pageHistory.create({ data: { pageId: order.pageId, from, to: "PUBLISHED", reason: `Pagamento aprovado (pedido ${order.id})` } });
    if (order.couponId) await tx.coupon.update({ where: { id: order.couponId }, data: { uses: { increment: 1 } } });
  });

  await sendApprovalEmail(order.id).catch((err) => log.error("order.approval_email_failed", { orderId: order.id, err }));
}

/** Gera um novo link mágico e envia o e-mail de aprovação (também usado no "reenviar" do admin). */
export async function sendApprovalEmail(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { page: true, customer: true } });
  if (!order.page.slug) throw new Error("Página sem slug");
  const editToken = await issueEditToken(order.pageId);
  const { content } = pageView(order.page);
  const pageUrl = appUrl(`/p/${order.page.slug}`);
  const result = await sendEmail(
    "payment_approved",
    order.customer.email,
    {
      recipientName: content.meta.recipientName,
      pageUrl,
      editUrl: appUrl(`/editar/${order.pageId}?t=${editToken}`),
      qrUrl: appUrl(`/api/qr/${order.page.slug}?format=png`),
      expiresText: order.page.expiresAt ? `página ativa até ${formatDate(order.page.expiresAt)}` : "página vitalícia",
    },
    { pageId: order.pageId, orderId: order.id },
  );
  if (result.sent) await db.order.update({ where: { id: order.id }, data: { emailSentAt: new Date() } });
  return result;
}

async function onReversed(order: OrderWithRelations, status: OrderStatus) {
  await db.$transaction(async (tx) => {
    const page = await tx.page.findUniqueOrThrow({ where: { id: order.pageId } });
    if (page.status !== "PUBLISHED") return;
    await tx.page.update({ where: { id: page.id }, data: { status: "UNPUBLISHED", unpublishedReason: status === "REFUNDED" ? "Pagamento estornado" : "Chargeback" } });
    await tx.pageHistory.create({ data: { pageId: page.id, from: page.status, to: "UNPUBLISHED", reason: `${status} (pedido ${order.id})` } });
  });
}

async function onFailed(order: OrderWithRelations) {
  const pending = await db.order.count({ where: { pageId: order.pageId, status: "PENDING" } });
  if (pending > 0) return;
  await db.page.updateMany({ where: { id: order.pageId, status: "PENDING_PAYMENT" }, data: { status: "DRAFT" } });
}
