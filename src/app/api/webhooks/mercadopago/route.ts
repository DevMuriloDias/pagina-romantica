import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { paymentProvider } from "@/lib/payments";
import { syncOrderWithPayment } from "@/lib/payments/fulfill";
import { verifyMercadoPagoSignature } from "@/lib/payments/signature";
import { randomToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function ok(body: Record<string, unknown> = {}, status = 200) {
  return Response.json({ received: true, ...body }, { status });
}

/**
 * Webhook do Mercado Pago.
 * 1) valida x-signature; 2) registra o evento; 3) NUNCA confia no payload — busca o pagamento
 * na API pelo ID; 4) aplica o status de forma idempotente.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const raw = await req.text();
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* corpo inválido: seguimos com os query params */
  }
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id !== undefined ? String(body.data.id) : null) ?? url.searchParams.get("id");
  const topic = url.searchParams.get("type") ?? body.type ?? url.searchParams.get("topic");
  const xRequestId = req.headers.get("x-request-id");
  const secret = env().MP_WEBHOOK_SECRET;

  let signatureValid = false;
  if (secret) signatureValid = verifyMercadoPagoSignature({ xSignature: req.headers.get("x-signature"), xRequestId, dataId, secret });
  else if (env().NODE_ENV !== "production") signatureValid = true; // dev sem segredo configurado

  let event;
  try {
    event = await db.paymentEvent.create({
      data: {
        requestId: xRequestId ?? `none-${randomToken(8)}`,
        topic,
        action: body.action ?? null,
        dataId,
        signatureValid,
        payload: (body ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.paymentEvent.findFirst({ where: { requestId: xRequestId, dataId } });
      if (existing?.processedAt) return ok({ duplicate: true });
      event = existing;
    } else throw err;
  }
  if (!event) return ok({ duplicate: true });

  if (!signatureValid) {
    log.warn("webhook.invalid_signature", { dataId, xRequestId });
    await db.paymentEvent.update({ where: { id: event.id }, data: { error: "Assinatura inválida", processedAt: new Date() } });
    return ok({ error: "invalid signature" }, 401);
  }

  if (topic !== "payment" || !dataId) {
    await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), result: "ignorado" } });
    return ok({ ignored: true });
  }

  try {
    const payment = await paymentProvider().getPayment(dataId);
    const order =
      (await db.order.findUnique({ where: { mpPaymentId: payment.id } })) ??
      (payment.externalReference ? await db.order.findUnique({ where: { id: payment.externalReference } }) : null);
    if (!order) {
      await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), result: "pedido não encontrado" } });
      return ok({ ignored: true });
    }
    const result = await syncOrderWithPayment(order.id, payment);
    await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), result: `${result.status}${result.changed ? " (alterado)" : ""}` } });
    return ok({ status: result.status });
  } catch (err) {
    log.error("webhook.processing_error", { dataId, err });
    await db.paymentEvent.update({ where: { id: event.id }, data: { error: err instanceof Error ? err.message : String(err) } });
    // 500 faz o Mercado Pago tentar de novo
    return ok({ error: "processing" }, 500);
  }
}
