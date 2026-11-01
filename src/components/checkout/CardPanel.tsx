"use client";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

export interface CardData {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: { email?: string; identification?: { type: string; number: string } };
}

let initialized: string | null = null;

/**
 * Cartão via Card Payment Brick do Mercado Pago: os dados do cartão são tokenizados
 * no navegador e nunca passam pelo nosso servidor.
 */
export function CardPanel({ amountCents, maxInstallments, publicKey, onSubmit, disabled }: { amountCents: number; maxInstallments: number; publicKey: string | null; onSubmit: (d: CardData) => Promise<void>; disabled?: boolean }) {
  const [ready, setReady] = useState(false);
  // A função de envio muda a cada render da página; guardamos numa ref para o Brick não ser recriado.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (publicKey && initialized !== publicKey) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      initialized = publicKey;
    }
    setReady(true);
  }, [publicKey]);

  if (!publicKey) return <MockCardForm amountCents={amountCents} maxInstallments={maxInstallments} onSubmit={onSubmit} disabled={disabled} />;
  if (!ready) return null;
  return (
    <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
      <MercadoPagoBrick amountCents={amountCents} maxInstallments={maxInstallments} submitRef={submitRef} />
    </div>
  );
}

/**
 * O Brick só pode ser montado uma vez por valor: recriá-lo a cada render (ex.: ao digitar o e-mail)
 * quebra a inicialização do Mercado Pago ("removeChild ... not of type Node").
 * Por isso as props são estáveis (memo) e o e-mail NÃO é passado ao Brick — o servidor o envia.
 */
const MercadoPagoBrick = memo(function MercadoPagoBrick({
  amountCents,
  maxInstallments,
  submitRef,
}: {
  amountCents: number;
  maxInstallments: number;
  submitRef: React.RefObject<(d: CardData) => Promise<void>>;
}) {
  const initialization = useMemo(() => ({ amount: amountCents / 100 }), [amountCents]);
  const customization = useMemo(
    () => ({ paymentMethods: { maxInstallments, minInstallments: 1 }, visual: { style: { theme: "default" as const } } }),
    [maxInstallments],
  );
  const handleSubmit = useCallback(
    async (formData: { token: string; payment_method_id: string; issuer_id?: string | number; installments: number | string; payer?: { email?: string; identification?: unknown } }) => {
      await submitRef.current({
        token: formData.token,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id ? String(formData.issuer_id) : undefined,
        installments: Number(formData.installments),
        payer: { identification: formData.payer?.identification as CardData["payer"]["identification"] },
      });
    },
    [submitRef],
  );
  const handleError = useCallback((err: unknown) => console.error("Mercado Pago Brick:", err), []);
  return <CardPayment key={amountCents} locale="pt-BR" initialization={initialization} customization={customization} onSubmit={handleSubmit as never} onError={handleError as never} />;
});

/** Formulário simulado (PAYMENTS_PROVIDER=mock): titular "APRO" aprova, "OTHE" recusa, "CONT" fica pendente. */
function MockCardForm({ amountCents, maxInstallments, onSubmit, disabled }: { amountCents: number; maxInstallments: number; onSubmit: (d: CardData) => Promise<void>; disabled?: boolean }) {
  const [holder, setHolder] = useState("APRO");
  const [installments, setInstallments] = useState(1);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3 rounded-2xl border border-dashed border-ink/20 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit({ token: `mock-${holder}`, payment_method_id: "master", installments, payer: {} });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs text-ink-soft">Modo de teste: cartão simulado. Use o titular <strong>APRO</strong> (aprova), <strong>OTHE</strong> (recusa) ou <strong>CONT</strong> (pendente).</p>
      <Input value="5031 4332 1540 6351" readOnly aria-label="Número do cartão (teste)" />
      <Input value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} aria-label="Nome do titular" />
      <NativeSelect value={installments} onChange={(e) => setInstallments(Number(e.target.value))} aria-label="Parcelas">
        {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}x de {(amountCents / 100 / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>
        ))}
      </NativeSelect>
      <Button type="submit" className="w-full" disabled={busy || disabled}>{busy ? "Processando..." : "Pagar com cartão"}</Button>
    </form>
  );
}
