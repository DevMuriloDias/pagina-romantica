"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/builder/CopyButton";
import { Button } from "@/components/ui/button";

function useCountdown(target: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const t = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((t - Date.now()) / 1000)));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [target]);
  return left;
}

export function PixPanel({ qrCode, qrBase64, expiresAt, onRegenerate, regenerating, devApprove }: { qrCode: string; qrBase64: string | null; expiresAt: string | null; onRegenerate: () => void; regenerating: boolean; devApprove?: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(qrBase64 ? `data:image/png;base64,${qrBase64}` : null);
  const left = useCountdown(expiresAt);
  const expired = left === 0;

  useEffect(() => {
    if (qrBase64) return;
    QRCode.toDataURL(qrCode, { width: 320, margin: 1, errorCorrectionLevel: "M" }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [qrCode, qrBase64]);

  return (
    <div className="space-y-4 text-center" data-testid="pix-panel">
      {expired ? (
        <div className="space-y-3 rounded-2xl bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Este Pix expirou ⏰</p>
          <p className="text-sm text-amber-900/80">Sem problema: gere um novo código e pague em seguida.</p>
          <Button onClick={onRegenerate} disabled={regenerating}>{regenerating ? "Gerando..." : "Gerar novo Pix"}</Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Abra o app do seu banco, escolha <strong>Pix → Ler QR Code</strong> ou use o copia e cola.</p>
          {dataUrl ? <img src={dataUrl} alt="QR Code do Pix" className="mx-auto size-56 rounded-xl bg-white p-2 ring-1 ring-line" /> : <div className="mx-auto size-56 animate-pulse rounded-xl bg-ink/5" />}
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-left text-xs ring-1 ring-line" data-testid="pix-code">{qrCode}</code>
            <CopyButton text={qrCode} label="Copiar código" />
          </div>
          {left !== null ? (
            <p className="text-sm tabular-nums text-ink-soft">
              Expira em <strong>{String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}</strong>
            </p>
          ) : null}
          <p className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Aguardando o pagamento — esta tela atualiza sozinha.
          </p>
          {devApprove ? (
            <div className="rounded-xl border border-dashed border-ink/20 p-3 text-xs text-ink-soft">
              Modo de teste (pagamentos simulados).{" "}
              <button type="button" className="font-semibold text-rose underline" onClick={devApprove} data-testid="mock-approve">Simular pagamento aprovado</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
