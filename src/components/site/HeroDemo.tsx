"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageRenderer } from "@/components/page/PageRenderer";
import { sampleContent } from "@/lib/content/sample";
import { TEMPLATES } from "@/lib/theme/templates";
import { PhoneFrame } from "./PhoneFrame";

const runtime = { mode: "preview" as const, act: async () => ({ ok: true, message: "Exemplo 💌" }) };

/** Exemplo animado na landing: o mesmo renderer das páginas reais, trocando de template sozinho. */
export function HeroDemo() {
  const content = useMemo(() => sampleContent(), []);
  const [idx, setIdx] = useState(0);
  const screen = useRef<HTMLDivElement>(null);
  const theme = TEMPLATES[idx % TEMPLATES.length]!.theme;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    let paused = false;
    const el = screen.current;
    const step = () => {
      if (el && !paused) {
        el.scrollTop += 0.6;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          el.scrollTop = 0;
          setIdx((i) => i + 1);
        }
      }
      raf = requestAnimationFrame(step);
    };
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    el?.addEventListener("pointerenter", pause);
    el?.addEventListener("pointerleave", resume);
    el?.addEventListener("touchstart", pause, { passive: true });
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el?.removeEventListener("pointerenter", pause);
      el?.removeEventListener("pointerleave", resume);
      el?.removeEventListener("touchstart", pause);
    };
  }, []);

  return (
    <div className="relative">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,rgba(194,38,79,0.18),transparent_65%)] blur-2xl" aria-hidden />
      <PhoneFrame screenRef={screen}>
        <PageRenderer content={content} theme={theme} runtime={runtime} contained />
      </PhoneFrame>
      <div className="absolute -right-2 top-16 hidden rotate-6 rounded-2xl bg-white px-4 py-3 shadow-xl sm:block">
        <p className="font-hand text-xl text-rose">Template:</p>
        <p className="text-sm font-semibold text-ink">{TEMPLATES[idx % TEMPLATES.length]!.name}</p>
      </div>
      <div className="absolute -left-6 bottom-24 hidden -rotate-6 rounded-2xl bg-white px-4 py-3 shadow-xl sm:block">
        <p className="text-sm text-ink-soft">💌 Aberta por</p>
        <p className="font-hand text-xl text-ink">Marina, agora há pouco</p>
      </div>
    </div>
  );
}
