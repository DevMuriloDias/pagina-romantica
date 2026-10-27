"use client";
import { ArrowLeft, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageRenderer } from "@/components/page/PageRenderer";
import type { PageRuntime } from "@/components/page/runtime";
import { Button } from "@/components/ui/button";
import type { PageContent } from "@/lib/content/schema";
import { reviewChecklist } from "@/lib/review";
import type { Theme } from "@/lib/theme/schema";
import { cn } from "@/lib/utils";

const runtime: PageRuntime = { mode: "preview", act: async () => ({ ok: true, message: "Prévia: na página real você recebe um e-mail 💌" }) };

/** Revisão final: a página em tela cheia (exatamente como o destinatário verá) + checklist. */
export function ReviewView({ pageId, content, theme }: { pageId: string; content: PageContent; theme: Theme }) {
  const items = useMemo(() => reviewChecklist(content), [content]);
  const warnings = items.filter((i) => i.level === "warn").length;
  const [open, setOpen] = useState(true);
  return (
    <>
      <PageRenderer content={content} theme={theme} runtime={runtime} showGate watermark />
      <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px] sm:p-0">
        <div className="overflow-hidden rounded-2xl border border-line bg-paper/95 font-sans text-ink shadow-2xl backdrop-blur">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span>
              <span className="block font-display text-lg">Revisão final</span>
              <span className="text-xs text-ink-soft">{warnings ? `${warnings} ponto(s) para dar uma olhada` : "Tudo pronto! ✨"}</span>
            </span>
            <ChevronUp className={cn("size-5 transition-transform", !open && "rotate-180")} />
          </button>
          {open ? (
            <div className="max-h-[45svh] overflow-y-auto border-t border-line px-4 py-3">
              <ul className="space-y-2 text-sm">
                {items.map((i, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span aria-hidden>{i.level === "ok" ? "✅" : i.level === "warn" ? "⚠️" : "💡"}</span>
                    <span className={cn(i.level === "warn" && "text-amber-900")}>{i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex gap-2 border-t border-line p-3">
            <Button asChild variant="outline" className="flex-1"><Link href={`/criar/editor?page=${pageId}`}><ArrowLeft /> Editar</Link></Button>
            <Button asChild className="flex-1"><Link href={`/criar/checkout?page=${pageId}`}>Finalizar 💌</Link></Button>
          </div>
        </div>
      </div>
    </>
  );
}
