import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida o header x-signature do Mercado Pago.
 * Formato: "ts=1704908010,v1=<hmac-sha256-hex>"
 * Manifesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (partes ausentes são omitidas;
 * data.id alfanumérico deve estar em minúsculas).
 */
export function verifyMercadoPagoSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!opts.xSignature) return false;
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((kv) => {
      const [k, ...v] = kv.split("=");
      return [k?.trim(), v.join("=").trim()];
    }),
  ) as Record<string, string | undefined>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = opts.dataId ? (/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId) : null;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Usado em testes e no simulador local para gerar uma assinatura válida. */
export function signMercadoPagoWebhook(dataId: string, requestId: string, secret: string, ts = Date.now()): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}
