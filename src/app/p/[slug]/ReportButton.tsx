"use client";
import { useState } from "react";

const REASONS = [
  ["conteudo_ofensivo", "Conteúdo ofensivo ou de ódio"],
  ["conteudo_sexual", "Conteúdo sexual impróprio"],
  ["golpe", "Golpe ou fraude"],
  ["privacidade", "Expõe alguém sem permissão"],
  ["outro", "Outro motivo"],
] as const;

/** Botão discreto "denunciar esta página". */
export function ReportButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("conteudo_ofensivo");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <>
      <button type="button" className="underline" onClick={() => setOpen(true)}>Denunciar esta página</button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Denunciar página" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 font-sans text-left text-sm text-neutral-800 opacity-100" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <>
                <p className="text-base font-semibold">Obrigado por avisar.</p>
                <p className="mt-1 text-neutral-600">Nossa equipe vai analisar esta página.</p>
                <button type="button" className="mt-4 w-full rounded-full bg-neutral-900 py-2 text-white" onClick={() => setOpen(false)}>Fechar</button>
              </>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await fetch(`/api/public/${slug}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, details }) }).catch(() => {});
                  setSent(true);
                }}
              >
                <p className="text-base font-semibold">Denunciar esta página</p>
                <div className="mt-3 space-y-1.5">
                  {REASONS.map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2">
                      <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} /> {l}
                    </label>
                  ))}
                </div>
                <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3} className="mt-3 w-full rounded-lg border border-neutral-300 p-2" placeholder="Detalhes (opcional)" aria-label="Detalhes" />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="rounded-full px-4 py-2" onClick={() => setOpen(false)}>Cancelar</button>
                  <button type="submit" className="rounded-full bg-red-600 px-4 py-2 font-semibold text-white">Enviar denúncia</button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
