"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageRenderer } from "@/components/page/PageRenderer";
import type { PageRuntime } from "@/components/page/runtime";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";

export type Device = "mobile" | "desktop";

const runtime: PageRuntime = {
  mode: "preview",
  act: async (a) => {
    await new Promise((r) => setTimeout(r, 400));
    const msg = a.type === "proposal" ? "Prévia: na página real, você recebe a resposta por e-mail 💌" : a.type === "coupon" ? "Prévia: você receberia um e-mail avisando 🎟️" : "Prévia: o recado chegaria no seu e-mail 📝";
    return { ok: true, message: msg };
  },
};

const DESKTOP_W = 1100;

/**
 * Preview ao vivo usando EXATAMENTE o mesmo renderer da página pública.
 * "contained" prende elementos fixos (música, efeitos, cartas abertas) dentro da moldura.
 */
export function Preview({ device, gateKey, focusId, watermark = true }: { device: Device; gateKey: number; focusId: { id: string; n: number } | null; watermark?: boolean }) {
  const content = useBuilder((s) => s.content);
  const theme = useBuilder((s) => s.theme);
  const pageId = useBuilder((s) => s.pageId);
  const outer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 400, h: 700 });
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const target = scroller.current?.querySelector<HTMLElement>(`#s-${CSS.escape(focusId.id)}`);
      if (target && scroller.current) scroller.current.scrollTo({ top: target.offsetTop - 12, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [focusId]);

  const verify = useCallback(async (answer: string) => {
    try {
      const r = await api<{ ok: boolean }>(`/api/pages/${pageId}/gate/test`, { body: { answer } });
      return { ok: r.ok };
    } catch {
      return { ok: false, message: "Não foi possível testar agora." };
    }
  }, [pageId]);

  const renderer = (
    <PageRenderer
      key={gateKey}
      content={content}
      theme={theme}
      runtime={runtime}
      contained
      overlayRoot={overlay}
      watermark={watermark}
      showGate={gateKey > 0}
      verify={verify}
    />
  );

  if (device === "desktop") {
    const scale = Math.min(1, box.w / DESKTOP_W);
    return (
      <div ref={outer} className="relative h-full w-full overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-30px_rgba(42,20,24,0.5)] ring-1 ring-line">
        <div className="flex h-8 items-center gap-1.5 border-b border-line bg-cream/70 px-3" aria-hidden>
          <span className="size-2.5 rounded-full bg-red-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 h-4 flex-1 rounded bg-white/80" />
        </div>
        <div className="relative [transform-origin:top_left]" style={{ width: DESKTOP_W, height: (box.h - 32) / scale, transform: `scale(${scale})` }}>
          <div ref={scroller} className="h-full w-full overflow-y-auto overflow-x-hidden [transform:translateZ(0)]" data-preview-scroller>
            {renderer}
          </div>
          <div ref={setOverlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
        </div>
      </div>
    );
  }

  const scale = Math.min(1, (box.h - 8) / 800, (box.w - 8) / 400);
  return (
    <div ref={outer} className="flex h-full w-full items-start justify-center overflow-hidden">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
        <div className="relative w-[400px] rounded-[52px] bg-[#1a1416] p-[12px] shadow-[0_40px_80px_-30px_rgba(42,20,24,0.55)]">
          <div className="absolute left-1/2 top-[20px] z-20 h-[24px] w-[100px] -translate-x-1/2 rounded-full bg-[#1a1416]" aria-hidden />
          <div className="relative h-[776px] overflow-hidden rounded-[40px]">
            <div ref={scroller} className={cn("h-full overflow-y-auto overflow-x-hidden bg-white [scrollbar-width:none] [transform:translateZ(0)]")} data-preview-scroller>
              {renderer}
            </div>
            <div ref={setOverlay} className="pointer-events-none absolute inset-0 overflow-hidden rounded-[40px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
