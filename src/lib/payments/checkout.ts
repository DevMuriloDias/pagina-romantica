import "server-only";
import type { Page, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "../api";
import { randomToken } from "../crypto";
import { db } from "../db";
import { appUrl, env } from "../env";
import { validateCustomSlug } from "../slug";
import { quoteFor, type Quote } from "./quote";

export const CheckoutBase = z
  .object({
    pageId: z.string().min(1).max(40),
    planId: z.string().max(40).nullish(),
    couponCode: z.string().max(40).nullish(),
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido"),
    emailConfirm: z.string().trim().toLowerCase(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }) }),
    customSlug: z.string().max(60).nullish(),
  })
  .refine((d) => d.email === d.emailConfirm, { message: "Os e-mails não conferem. Confira com calma — é por ele que você recebe o link!", path: ["emailConfirm"] });

export type CheckoutInput = z.infer<typeof CheckoutBase>;

/** Valida tudo e cria o pedido PENDENTE com o preço recalculado no servidor. */
export async function prepareOrder(page: Page, input: CheckoutInput, method: PaymentMethod) {
  if (page.status === "PUBLISHED" && page.expiresAt === null) throw new ApiError(409, "Esta página já está paga e é vitalícia. 💖", "already_paid");
  if (page.status === "UNPUBLISHED" || page.status === "DELETED") throw new ApiError(409, "Esta página não pode ser paga.", "invalid_state");

  let requestedSlug: string | null = null;
  if (input.customSlug) {
    const check = validateCustomSlug(input.customSlug);
    if (!check.ok) throw new ApiError(400, check.reason, "slug_invalid");
    const taken = await db.page.findFirst({ where: { slug: check.slug, NOT: { id: page.id } }, select: { id: true } });
    if (taken) throw new ApiError(409, "Este endereço já está em uso. Tente outro.", "slug_taken");
    requestedSlug = check.slug;
  }

  const quote: Quote = await quoteFor(page, { planId: input.planId, couponCode: input.couponCode, wantsCustomSlug: Boolean(requestedSlug) });
  if (quote.violations.length) throw new ApiError(422, quote.violations[0]!.message, "plan_limit", { violations: quote.violations });
  if (input.couponCode && !quote.coupon?.ok) throw new ApiError(400, quote.coupon?.message ?? "Cupom inválido.", "coupon_invalid");

  const customer = await db.customer.upsert({ where: { email: input.email }, update: {}, create: { email: input.email } });
  const order = await db.order.create({
    data: {
      pageId: page.id,
      customerId: customer.id,
      planId: quote.plan.id,
      couponId: quote.couponRecord?.id ?? null,
      method,
      originalCents: quote.originalCents,
      discountCents: quote.discountCents,
      amountCents: quote.totalCents,
      idempotencyKey: `ord_${randomToken(18)}`,
      requestedSlug,
    },
  });
  await db.page.update({ where: { id: page.id }, data: { customerId: page.customerId ?? customer.id, ...(page.status === "DRAFT" ? { status: "PENDING_PAYMENT" } : {}) } });
  return { order, quote, customer };
}

export function notificationUrl(): string | undefined {
  const url = appUrl("/api/webhooks/mercadopago");
  // O Mercado Pago rejeita notification_url que não seja https pública.
  return url.startsWith("https://") ? url : undefined;
}

export function paymentDescription(planName: string) {
  return `Página romântica — plano ${planName}`;
}

export const cardInstallmentsMax = () => env().CARD_MAX_INSTALLMENTS;
