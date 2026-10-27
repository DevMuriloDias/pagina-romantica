import { json, route } from "@/lib/api";
import { env } from "@/lib/env";
import { requireEditablePage } from "@/lib/pages/access";
import { publicQuote, quoteFor } from "@/lib/payments/quote";

/** Cotação para a tela de checkout (o valor real é recalculado ao criar o pagamento). */
export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  const page = await requireEditablePage(url.searchParams.get("pageId") ?? "");
  const q = await quoteFor(page, {
    planId: url.searchParams.get("planId"),
    couponCode: url.searchParams.get("coupon"),
    wantsCustomSlug: url.searchParams.get("customSlug") === "1",
  });
  return json({ ...publicQuote(q), maxInstallments: env().CARD_MAX_INSTALLMENTS, provider: env().PAYMENTS_PROVIDER, publicKey: env().NEXT_PUBLIC_MP_PUBLIC_KEY ?? null });
});
