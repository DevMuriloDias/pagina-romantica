import { z } from "zod";
import { ApiError, clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { requireEditablePage } from "@/lib/pages/access";
import { paymentProvider } from "@/lib/payments";
import { CheckoutBase, notificationUrl, paymentDescription, prepareOrder } from "@/lib/payments/checkout";
import { syncOrderWithPayment } from "@/lib/payments/fulfill";
import { friendlyStatusMessage } from "@/lib/payments/status";
import { LIMITS } from "@/lib/ratelimit";

export const maxDuration = 30;

/** Dados vindos do Card Payment Brick: só o token — o número do cartão nunca chega aqui. */
const CardSchema = CheckoutBase.and(
  z.object({
    card: z.object({
      token: z.string().min(4).max(200),
      payment_method_id: z.string().min(2).max(40),
      issuer_id: z.union([z.string(), z.number()]).transform(String).optional(),
      installments: z.number().int().min(1).max(24),
      payer: z.object({
        email: z.string().email().optional(),
        identification: z.object({ type: z.string().max(10), number: z.string().max(20) }).optional(),
      }),
    }),
  }),
);

export const POST = route(async (req: Request) => {
  const input = await parseBody(req, CardSchema);
  const page = await requireEditablePage(input.pageId);
  await enforceRate("payment", await clientIp(), LIMITS.payment.limit, LIMITS.payment.window);
  if (input.card.installments > env().CARD_MAX_INSTALLMENTS) throw new ApiError(400, `Parcelamento máximo: ${env().CARD_MAX_INSTALLMENTS}x.`, "installments");
  const { order, quote } = await prepareOrder(page, input, "CARD");
  await db.order.update({ where: { id: order.id }, data: { installments: input.card.installments } });

  let payment;
  try {
    payment = await paymentProvider().createCard({
      amountCents: order.amountCents,
      description: paymentDescription(quote.plan.name),
      token: input.card.token,
      paymentMethodId: input.card.payment_method_id,
      issuerId: input.card.issuer_id,
      installments: input.card.installments,
      payer: { email: input.email, identification: input.card.payer.identification },
      idempotencyKey: order.idempotencyKey,
      externalReference: order.id,
      notificationUrl: notificationUrl(),
    });
  } catch (err) {
    log.error("checkout.card_error", { orderId: order.id, err });
    await db.order.update({ where: { id: order.id }, data: { status: "REJECTED", statusDetail: "provider_error" } });
    await db.page.updateMany({ where: { id: page.id, status: "PENDING_PAYMENT" }, data: { status: "DRAFT" } });
    throw new ApiError(502, "Não conseguimos processar o cartão agora. Tente de novo ou pague com Pix.", "provider_error");
  }

  await db.order.update({ where: { id: order.id }, data: { mpPaymentId: payment.id } });
  const { status } = await syncOrderWithPayment(order.id, payment);
  return json({
    orderId: order.id,
    status,
    message: status === "APPROVED" ? "Pagamento aprovado! 🎉" : status === "PENDING" ? friendlyStatusMessage(payment.statusDetail) : friendlyStatusMessage(payment.statusDetail),
  });
});
