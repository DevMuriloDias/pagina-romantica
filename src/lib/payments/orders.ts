import "server-only";
import type { Order, Page } from "@prisma/client";
import { ApiError } from "../api";
import { db } from "../db";
import { appUrl, env } from "../env";
import { log } from "../log";
import { getEditablePage } from "../pages/access";
import { paymentProvider } from ".";
import { syncOrderWithPayment } from "./fulfill";

export async function requireOrderAccess(orderId: string): Promise<Order & { page: Page }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { page: true } });
  if (!order) throw new ApiError(404, "Pedido não encontrado.", "not_found");
  const page = await getEditablePage(order.pageId);
  if (!page) throw new ApiError(404, "Pedido não encontrado.", "not_found");
  return order;
}

/**
 * Se o pedido está pendente há algum tempo, consulta o provedor diretamente
 * (cobre webhooks perdidos e ambientes sem URL pública). No máximo a cada 15s por pedido.
 */
export async function maybeRefreshFromProvider(order: Order): Promise<void> {
  if (order.status !== "PENDING" || !order.mpPaymentId) return;
  if (order.lastCheckedAt && Date.now() - order.lastCheckedAt.getTime() < 15_000) return;
  try {
    await db.order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
    const payment = await paymentProvider().getPayment(order.mpPaymentId);
    await syncOrderWithPayment(order.id, payment);
  } catch (err) {
    log.warn("order.refresh_failed", { orderId: order.id, err });
  }
}

export async function orderStatusView(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { page: { select: { slug: true, status: true } } } });
  const paid = order.status === "APPROVED" && order.page.status === "PUBLISHED" && order.page.slug;
  return {
    orderId: order.id,
    status: order.status,
    statusDetail: order.statusDetail,
    method: order.method,
    amountCents: order.amountCents,
    pix: order.method === "PIX" ? { qrCode: order.pixQrCode, qrBase64: order.pixQrBase64, expiresAt: order.pixExpiresAt } : null,
    publicUrl: paid ? appUrl(`/p/${order.page.slug}`) : null,
    slug: paid ? order.page.slug : null,
    // apenas no modo simulado: permite o botão "simular pagamento aprovado"
    ...(env().PAYMENTS_PROVIDER === "mock" ? { devPaymentId: order.mpPaymentId } : {}),
  };
}
