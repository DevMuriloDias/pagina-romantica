"use client";
import { useEffect, useRef, useState } from "react";

export interface OrderView {
  orderId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "REFUNDED" | "CHARGED_BACK";
  statusDetail: string | null;
  method: "PIX" | "CARD";
  amountCents: number;
  pix: { qrCode: string | null; qrBase64: string | null; expiresAt: string | null } | null;
  publicUrl: string | null;
  slug: string | null;
}

/**
 * Acompanha o pedido em tempo real: SSE (/stream) com fallback de polling a cada 3s.
 * A tela troca sozinha quando o pagamento é aprovado.
 */
export function useOrderStatus(orderId: string | null) {
  const [view, setView] = useState<OrderView | null>(null);
  const [mode, setMode] = useState<"sse" | "poll" | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    done.current = false;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const isFinal = (v: OrderView) => (v.status === "APPROVED" && Boolean(v.slug)) || ["REJECTED", "EXPIRED", "CANCELLED", "REFUNDED", "CHARGED_BACK"].includes(v.status);

    const startPolling = () => {
      if (poll || done.current) return;
      setMode("poll");
      const tick = async () => {
        try {
          const r = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
          if (!r.ok) return;
          const v = (await r.json()) as OrderView;
          setView(v);
          if (isFinal(v)) {
            done.current = true;
            if (poll) clearInterval(poll);
          }
        } catch {
          /* rede instável: tenta no próximo ciclo */
        }
      };
      void tick();
      poll = setInterval(tick, 3000);
    };

    if (typeof EventSource !== "undefined") {
      es = new EventSource(`/api/orders/${orderId}/stream`);
      setMode("sse");
      es.addEventListener("status", (e) => {
        const v = JSON.parse((e as MessageEvent).data) as OrderView;
        setView(v);
        if (isFinal(v)) {
          done.current = true;
          es?.close();
        }
      });
      es.onerror = () => {
        es?.close();
        if (!done.current) startPolling();
      };
    } else startPolling();

    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [orderId]);

  return { view, mode, setView };
}
