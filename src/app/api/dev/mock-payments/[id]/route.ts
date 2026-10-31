import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { env } from "@/lib/env";
import { setMockPaymentStatus } from "@/lib/payments/mock";
import { signMercadoPagoWebhook } from "@/lib/payments/signature";
import { randomToken } from "@/lib/crypto";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Simulador (apenas com PAYMENTS_PROVIDER=mock): muda o status de um pagamento simulado e
 * dispara o MESMO webhook usado em produção, com assinatura válida — testa o caminho completo.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  if (env().PAYMENTS_PROVIDER !== "mock") throw new ApiError(404, "Não encontrado", "not_found");
  const { id } = await params;
  const { status } = await parseBody(req, z.object({ status: z.enum(["approved", "rejected", "cancelled", "refunded", "charged_back"]) }));
  const updated = await setMockPaymentStatus(id, status, status === "cancelled" ? "expired" : null);
  if (!updated) throw new ApiError(404, "Pagamento simulado não encontrado", "not_found");

  const requestId = randomToken(8);
  const secret = env().MP_WEBHOOK_SECRET;
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/webhooks/mercadopago?data.id=${id}&type=payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      ...(secret ? { "x-signature": signMercadoPagoWebhook(id, requestId, secret) } : {}),
    },
    body: JSON.stringify({ action: "payment.updated", type: "payment", data: { id } }),
  });
  return json({ ok: res.ok, webhookStatus: res.status, payment: updated });
});
