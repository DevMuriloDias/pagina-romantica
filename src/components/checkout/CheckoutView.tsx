"use client";
import { CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, Badge, Spinner } from "@/components/ui/misc";
import { api, ClientApiError } from "@/lib/client/api";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardPanel, type CardData } from "./CardPanel";
import { PixPanel } from "./PixPanel";
import { SuccessView } from "./SuccessView";
import { useOrderStatus, type OrderView } from "./useOrderStatus";

interface QuoteResponse {
  plans: { id: string; slug: string; name: string; description: string; priceCents: number; highlight: boolean; features: string[] }[];
  selectedPlanId: string;
  requiredPlanId: string;
  violations: { kind: string; message: string; section?: string }[];
  originalCents: number;
  discountCents: number;
  totalCents: number;
  coupon: { code: string; ok: boolean; message: string } | null;
  maxInstallments: number;
  provider: "mock" | "mercadopago";
  publicKey: string | null;
}

export function CheckoutView({ pageId, recipientName, initialOrderId, initialEmail }: { pageId: string; recipientName: string; initialOrderId: string | null; initialEmail: string }) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(initialEmail);
  const [emailConfirm, setEmailConfirm] = useState(initialEmail);
  const [terms, setTerms] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [orderId, setOrderId] = useState<string | null>(initialOrderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const { view, setView } = useOrderStatus(orderId);

  const plan = quote?.plans.find((p) => p.id === quote.selectedPlanId);
  const allowsCustomSlug = plan?.features.some((f) => f.includes("Endereço personalizado")) ?? false;

  const loadQuote = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pageId, ...(planId ? { planId } : {}), ...(coupon ? { coupon } : {}), ...(customSlug ? { customSlug: "1" } : {}) });
      setQuote(await api<QuoteResponse>(`/api/checkout/quote?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar valores");
    } finally {
      setLoading(false);
    }
  }, [pageId, planId, coupon, customSlug]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  // Ao retomar um pedido (ex.: link do e-mail do Pix), restaura o método
  useEffect(() => {
    if (view?.method === "CARD") setMethod("card");
  }, [view?.method]);

  const formError = (() => {
    if (!email.includes("@")) return "Informe seu e-mail.";
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) return "Os e-mails não conferem.";
    if (!terms) return "Aceite os Termos e a Política de Privacidade.";
    if (quote?.violations.length) return quote.violations[0]!.message;
    return null;
  })();

  const base = () => ({ pageId, planId: quote?.selectedPlanId, couponCode: coupon, email, emailConfirm, acceptTerms: terms as true, customSlug: allowsCustomSlug && customSlug ? customSlug : null });

  const createPix = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ orderId: string; status: OrderView["status"]; amountCents: number; pix: OrderView["pix"] }>("/api/checkout/pix", { body: base() });
      setView({ orderId: r.orderId, status: r.status, statusDetail: null, method: "PIX", amountCents: r.amountCents, pix: r.pix, publicUrl: null, slug: null });
      setOrderId(r.orderId);
      window.history.replaceState(null, "", `/criar/checkout?page=${pageId}&order=${r.orderId}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Erro ao gerar o Pix.");
    } finally {
      setBusy(false);
    }
  };

  const payCard = async (card: CardData) => {
    setCardMsg(null);
    setError(null);
    try {
      const r = await api<{ orderId: string; status: OrderView["status"]; message: string }>("/api/checkout/card", { body: { ...base(), card } });
      setOrderId(r.orderId);
      if (r.status !== "APPROVED") setCardMsg(r.message);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Erro ao processar o cartão.");
    }
  };

  const devApprove = view?.pix && quote?.provider === "mock" && orderId
    ? async () => {
        const o = await api<{ devPaymentId?: string }>(`/api/orders/${orderId}`);
        if (!o.devPaymentId) throw new Error("Pagamento simulado não encontrado. Gere um novo Pix.");
        const r = await api<{ ok: boolean; webhookStatus: number }>(`/api/dev/mock-payments/${o.devPaymentId}`, { body: { status: "approved" } });
        if (!r.ok) throw new Error(`O aviso de pagamento (webhook) foi recusado (HTTP ${r.webhookStatus}). Confira o MP_WEBHOOK_SECRET.`);
      }
    : undefined;

  if (view?.status === "APPROVED" && view.publicUrl && view.slug) {
    return (
      <Shell>
        <SuccessView publicUrl={view.publicUrl} slug={view.slug} pageId={pageId} email={email} recipientName={recipientName} />
      </Shell>
    );
  }

  const pixActive = view?.method === "PIX" && view.status === "PENDING" && view.pix?.qrCode;

  return (
    <Shell>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <div>
            <Link href={`/criar/revisao?page=${pageId}`} className="text-sm text-ink-soft hover:text-ink">← Voltar para a revisão</Link>
            <h1 className="mt-2 font-display text-4xl">Finalizar sua página</h1>
            <p className="mt-1 text-ink-soft">Pagamento único. Assim que for aprovado, o link aparece aqui e no seu e-mail.</p>
          </div>

          <section className="space-y-3">
            <h2 className="font-display text-xl">1. Escolha o plano</h2>
            {!quote ? <div className="h-40 animate-pulse rounded-2xl bg-ink/5" /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {quote.plans.map((p) => {
                  const required = quote.plans.find((x) => x.id === quote.requiredPlanId);
                  const tooSmall = required ? p.priceCents < required.priceCents : false;
                  const active = p.id === quote.selectedPlanId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={tooSmall || Boolean(pixActive)}
                      onClick={() => setPlanId(p.id)}
                      className={cn("relative rounded-2xl border-2 bg-white p-4 text-left transition", active ? "border-rose shadow-[0_12px_30px_-18px_rgba(194,38,79,0.7)]" : "border-line hover:border-ink/25", tooSmall && "cursor-not-allowed opacity-60")}
                      aria-pressed={active}
                      data-testid={`plan-${p.slug}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xl">{p.name}</span>
                        {p.highlight ? <Badge tone="premium">Mais escolhido</Badge> : null}
                      </div>
                      <p className="mt-1 text-2xl font-semibold">{formatBRL(p.priceCents)}</p>
                      <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                        {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                      </ul>
                      {tooSmall ? <p className="mt-3 text-xs text-amber-800">Sua página usa recursos do plano {required?.name}.</p> : null}
                    </button>
                  );
                })}
              </div>
            )}
            {quote && quote.requiredPlanId !== quote.plans[0]?.id ? (
              <FitPlanHint pageId={pageId} cheapest={quote.plans[0]!} onDone={() => { setPlanId(quote.plans[0]!.id); void loadQuote(); }} />
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl">2. Seu e-mail</h2>
            <p className="text-sm text-ink-soft">É para ele que enviamos o link da página e o seu link de edição. Confira com carinho!</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail" disabled={Boolean(pixActive)} />
              <Input type="email" autoComplete="off" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Confirme o e-mail" aria-label="Confirme o e-mail" onPaste={(e) => e.preventDefault()} disabled={Boolean(pixActive)} />
            </div>
            {emailConfirm && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase() ? <p className="text-sm text-red-700">Os e-mails não conferem.</p> : null}
            {allowsCustomSlug ? (
              <div className="space-y-1.5 rounded-xl bg-cream/60 p-3">
                <p className="text-sm font-medium">Endereço personalizado (opcional) <Badge tone="premium">Premium</Badge></p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-soft">/p/</span>
                  <Input value={customSlug} onChange={(e) => { setCustomSlug(e.target.value); setSlugMsg(null); }} onBlur={async () => customSlug && setSlugMsg(await api<{ ok: boolean; message: string }>("/api/checkout/slug", { body: { pageId, slug: customSlug } }))} placeholder="joao-e-maria" aria-label="Endereço personalizado" disabled={Boolean(pixActive)} />
                </div>
                {slugMsg ? <p className={cn("text-xs", slugMsg.ok ? "text-emerald-700" : "text-red-700")}>{slugMsg.message}</p> : <p className="text-xs text-ink-soft">Sem endereço personalizado, criamos um link com código aleatório (mais privado).</p>}
              </div>
            ) : null}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-rose" disabled={Boolean(pixActive)} />
              <span>Li e aceito os <Link href="/termos" target="_blank" className="text-rose underline">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" className="text-rose underline">Política de Privacidade</Link>.</span>
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl">3. Pagamento</h2>
            <div className="flex gap-2" role="tablist">
              <button type="button" role="tab" aria-selected={method === "pix"} onClick={() => setMethod("pix")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 font-medium", method === "pix" ? "border-rose bg-white" : "border-line bg-white/60")}><QrCode className="size-5" /> Pix</button>
              <button type="button" role="tab" aria-selected={method === "card"} onClick={() => setMethod("card")} disabled={Boolean(pixActive)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 font-medium disabled:opacity-50", method === "card" ? "border-rose bg-white" : "border-line bg-white/60")}><CreditCard className="size-5" /> Cartão</button>
            </div>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {method === "pix" ? (
              pixActive && view?.pix?.qrCode ? (
                <PixPanel qrCode={view.pix.qrCode} qrBase64={view.pix.qrBase64} expiresAt={view.pix.expiresAt} onRegenerate={createPix} regenerating={busy} devApprove={devApprove} />
              ) : view?.method === "PIX" && (view.status === "EXPIRED" || view.status === "CANCELLED") ? (
                <div className="space-y-3 rounded-2xl bg-amber-50 p-5 text-center">
                  <p className="font-semibold text-amber-900">Este Pix expirou ⏰</p>
                  <Button onClick={createPix} disabled={busy || Boolean(formError)}>{busy ? "Gerando..." : "Gerar novo Pix"}</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button size="lg" className="w-full" onClick={createPix} disabled={busy || loading || Boolean(formError)} data-testid="pay-pix">
                    {busy ? <Loader2 className="animate-spin" /> : <QrCode />} Gerar Pix de {quote ? formatBRL(quote.totalCents) : "..."}
                  </Button>
                  {formError ? <p className="text-center text-xs text-ink-soft">{formError}</p> : <p className="text-center text-xs text-ink-soft">Aprovação na hora, 24h por dia.</p>}
                </div>
              )
            ) : quote ? (
              <div className="space-y-3">
                {formError ? <Alert tone="info">{formError}</Alert> : null}
                {view?.method === "CARD" && view.status === "PENDING" ? <Alert tone="info"><Spinner className="mr-2" /> Pagamento em análise. Você pode fechar esta tela: avisamos por e-mail.</Alert> : null}
                {cardMsg ? <Alert tone="warning">{cardMsg}</Alert> : null}
                <CardPanel amountCents={quote.totalCents} maxInstallments={quote.maxInstallments} publicKey={quote.provider === "mercadopago" ? quote.publicKey : null} email={email} onSubmit={payCard} disabled={Boolean(formError)} />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Resumo</h2>
            <p className="mt-1 text-sm text-ink-soft">Página para {recipientName || "seu amor"} 💌</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt>Plano {plan?.name}</dt><dd>{quote ? formatBRL(quote.originalCents) : "..."}</dd></div>
              {quote?.discountCents ? <div className="flex justify-between text-emerald-700"><dt>Desconto ({quote.coupon?.code})</dt><dd>− {formatBRL(quote.discountCents)}</dd></div> : null}
              <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold"><dt>Total</dt><dd data-testid="total">{quote ? formatBRL(quote.totalCents) : "..."}</dd></div>
            </dl>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(couponInput.trim().toUpperCase() || null);
              }}
            >
              <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Cupom de desconto" aria-label="Cupom" className="uppercase" disabled={Boolean(pixActive)} />
              <Button type="submit" variant="outline" disabled={Boolean(pixActive)}>Aplicar</Button>
            </form>
            {quote?.coupon ? <p className={cn("mt-2 text-xs", quote.coupon.ok ? "text-emerald-700" : "text-red-700")}>{quote.coupon.message}</p> : null}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft"><ShieldCheck className="size-4 text-emerald-600" /> Pagamento seguro processado pelo Mercado Pago.</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function FitPlanHint({ pageId, cheapest, onDone }: { pageId: string; cheapest: { id: string; name: string }; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="rounded-xl bg-cream/70 p-3 text-sm">
      Prefere o plano {cheapest.name}?{" "}
      <button
        type="button"
        className="font-semibold text-rose underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await api<{ ok: boolean; remaining: { message: string }[] }>(`/api/pages/${pageId}/fit-plan`, { body: { planId: cheapest.id } });
          setBusy(false);
          if (r.ok) onDone();
          else setMsg(`${r.remaining[0]?.message ?? ""} Ajuste no editor para usar o ${cheapest.name}.`);
        }}
      >
        {busy ? "Ajustando..." : "Ocultar os recursos Premium"}
      </button>
      {msg ? <p className="mt-1 text-amber-800">{msg} <Link className="underline" href={`/criar/editor?page=${pageId}`}>Abrir editor</Link></p> : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grain min-h-svh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
      </header>
      <main className="px-4 pb-20 pt-4 sm:px-8">{children}</main>
    </div>
  );
}
