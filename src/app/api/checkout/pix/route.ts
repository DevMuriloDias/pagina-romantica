import { clientIp, enforceRate, json, parseBody, route, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl, env } from "@/lib/env";
import { formatBRL, formatDateTime } from "@/lib/format";
import { log } from "@/lib/log";
import { requireEditablePage } from "@/lib/pages/access";
import { paymentProvider } from "@/lib/payments";
import { CheckoutBase, notificationUrl, paymentDescription, prepareOrder } from "@/lib/payments/checkout";
import { syncOrderWithPayment } from "@/lib/payments/fulfill";
import { LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

/** Cria um pagamento Pix (QR Code + copia e cola) com expiração e chave de idempotência. */
export const POST = route(async (req: Request) => {
  const input = await parseBody(req, CheckoutBase);
  const page = await requireEditablePage(input.pageId);
  await enforceRate("payment", await clientIp(), LIMITS.payment.limit, LIMITS.payment.window);
  const { order, quote } = await prepareOrder(page, input, "PIX");
  const expiresAt = new Date(Date.now() + env().PIX_EXPIRATION_MINUTES * 60_000);

  let payment;
  try {
    payment = await paymentProvider().createPix({
      amountCents: order.amountCents,
      description: paymentDescription(quote.plan.name),
      email: input.email,
      idempotencyKey: order.idempotencyKey,
      externalReference: order.id,
      expiresAt,
      notificationUrl: notificationUrl(),
    });
  } catch (err) {
    log.error("checkout.pix_error", { orderId: order.id, err });
    await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", statusDetail: "provider_error" } });
    throw new ApiError(502, "Não conseguimos gerar o Pix agora. Tente novamente em instantes.", "provider_error");
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: { mpPaymentId: payment.id, pixQrCode: payment.qrCode, pixQrBase64: payment.qrBase64, pixExpiresAt: payment.expiresAt ?? expiresAt, statusDetail: payment.statusDetail },
  });
  if (payment.status !== "pending") await syncOrderWithPayment(order.id, payment);

  // Lembrete opcional com o copia-e-cola (não bloqueia a resposta)
  if (payment.qrCode) {
    void sendEmail(
      "pix_created",
      input.email,
      { pixCode: payment.qrCode, amount: formatBRL(order.amountCents), expiresText: `válido até ${formatDateTime(updated.pixExpiresAt!)}`, resumeUrl: appUrl(`/criar/checkout?page=${page.id}&order=${order.id}`) },
      { pageId: page.id, orderId: order.id },
    ).catch((err) => log.warn("checkout.pix_email_failed", { err }));
  }

  return json({
    orderId: updated.id,
    status: updated.status,
    amountCents: updated.amountCents,
    pix: { qrCode: updated.pixQrCode, qrBase64: updated.pixQrBase64, expiresAt: updated.pixExpiresAt },
  });
});
