import "server-only";
import { z } from "zod";
import { env } from "../env";
import { log } from "../log";
import type { CreateCardInput, CreatePixInput, PaymentProvider, ProviderPayment } from "./types";

const API = "https://api.mercadopago.com";

const PaymentResponse = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullable().optional(),
  external_reference: z.string().nullable().optional(),
  transaction_amount: z.number(),
  payment_method_id: z.string().nullable().optional(),
  payment_type_id: z.string().nullable().optional(),
  date_of_expiration: z.string().nullable().optional(),
  point_of_interaction: z
    .object({
      transaction_data: z
        .object({ qr_code: z.string().nullable().optional(), qr_code_base64: z.string().nullable().optional() })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
});

function toPayment(raw: unknown): ProviderPayment {
  const p = PaymentResponse.parse(raw);
  const isPix = p.payment_method_id === "pix" || p.payment_type_id === "bank_transfer";
  return {
    id: p.id,
    status: p.status as ProviderPayment["status"],
    statusDetail: p.status_detail ?? null,
    externalReference: p.external_reference ?? null,
    amountCents: Math.round(p.transaction_amount * 100),
    method: isPix ? "pix" : "card",
    qrCode: p.point_of_interaction?.transaction_data?.qr_code ?? null,
    qrBase64: p.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
    expiresAt: p.date_of_expiration ? new Date(p.date_of_expiration) : null,
  };
}

async function call(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<unknown> {
  const token = env().MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    log.warn("mercadopago.http_error", { path, status: res.status, body });
    const message = (body as { message?: string }).message ?? `HTTP ${res.status}`;
    const err = new Error(`Mercado Pago: ${message}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Formato exigido pelo MP: 2025-01-01T12:00:00.000-03:00 */
export function mpDate(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3600_000);
  return `${local.toISOString().slice(0, 23)}-03:00`;
}

export const mercadoPago: PaymentProvider = {
  name: "mercadopago",
  async createPix(input: CreatePixInput) {
    const body = await call("/v1/payments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        description: input.description,
        payment_method_id: "pix",
        date_of_expiration: mpDate(input.expiresAt),
        external_reference: input.externalReference,
        notification_url: input.notificationUrl,
        payer: { email: input.email },
      }),
    });
    return toPayment(body);
  },
  async createCard(input: CreateCardInput) {
    const body = await call("/v1/payments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        description: input.description,
        token: input.token,
        payment_method_id: input.paymentMethodId,
        issuer_id: input.issuerId ? Number(input.issuerId) : undefined,
        installments: input.installments,
        external_reference: input.externalReference,
        notification_url: input.notificationUrl,
        statement_descriptor: "AVELOVE",
        payer: input.payer,
      }),
    });
    return toPayment(body);
  },
  async getPayment(id: string) {
    return toPayment(await call(`/v1/payments/${encodeURIComponent(id)}`));
  },
  async refund(id: string) {
    await call(`/v1/payments/${encodeURIComponent(id)}/refunds`, { method: "POST", idempotencyKey: `refund-${id}`, body: "{}" });
  },
};
