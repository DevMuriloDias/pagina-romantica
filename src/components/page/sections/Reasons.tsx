"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Reasons({ section, theme }: SectionProps<"reasons">) {
  const { mode } = useRuntime();
  const reasons = section.data.reasons.filter((r) => r.trim());
  if (!reasons.length && mode === "public") return null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Motivos pelos quais te amo">
      <SectionTitle eyebrow={`${reasons.length} motivos (e contando)`}>{section.data.title}</SectionTitle>
      {!reasons.length ? <EmptyHint>Escreva os motivos pelos quais você ama 🫙</EmptyHint> : section.data.layout === "jar" ? <Jar reasons={reasons} /> : <FlipCards reasons={reasons} />}
    </SectionShell>
  );
}

function FlipCards({ reasons }: { reasons: string[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setFlipped((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });
  return (
    <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @md:gap-4">
      {reasons.map((r, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(i)}
          aria-pressed={flipped.has(i)}
          aria-label={flipped.has(i) ? r : `Motivo número ${i + 1} — toque para ver`}
          className="group aspect-[4/5] [perspective:1000px]"
        >
          <div className={cn("relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]", flipped.has(i) && "[transform:rotateY(180deg)]")}>
            <div className="love-card absolute inset-0 flex flex-col items-center justify-center bg-[var(--c-primary)]! text-white [backface-visibility:hidden]">
              <span className="text-4xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>#{i + 1}</span>
              <span className="mt-2 text-xs uppercase tracking-widest opacity-80">toque aqui</span>
            </div>
            <div className="love-card absolute inset-0 flex items-center justify-center p-4 text-center text-sm leading-snug [backface-visibility:hidden] [transform:rotateY(180deg)] @md:text-base">
              {r}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Jar({ reasons }: { reasons: string[] }) {
  const [current, setCurrent] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const reduced = useReducedMotion();
  const draw = () => {
    let next = Math.floor(Math.random() * reasons.length);
    if (reasons.length > 1 && next === current) next = (next + 1) % reasons.length;
    setCurrent(next);
    setCount((c) => c + 1);
  };
  return (
    <div className="flex flex-col items-center">
      <motion.button
        type="button"
        onClick={draw}
        whileTap={reduced ? undefined : { rotate: [0, -8, 8, -4, 0] }}
        className="relative h-56 w-44 focus-visible:outline-offset-8"
        aria-label="Sortear um motivo do pote"
      >
        <svg viewBox="0 0 120 150" className="h-full w-full drop-shadow-xl" aria-hidden>
          <rect x="30" y="4" width="60" height="18" rx="4" fill="var(--c-accent)" />
          <path d="M24 26 h72 q10 0 10 12 v90 q0 18 -18 18 h-56 q-18 0 -18 -18 v-90 q0 -12 10 -12z" fill="rgba(255,255,255,0.35)" stroke="var(--c-text)" strokeOpacity="0.25" strokeWidth="2" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={26 + ((i * 23) % 64)} y={80 + ((i * 17) % 56)} width="16" height="10" rx="2" fill={i % 2 ? "var(--c-primary)" : "var(--c-secondary)"} transform={`rotate(${(i * 47) % 60 - 30} ${34 + ((i * 23) % 64)} ${85 + ((i * 17) % 56)})`} />
          ))}
        </svg>
        <span className="absolute inset-x-0 top-[45%] text-center text-sm font-semibold">toque no pote</span>
      </motion.button>
      <div className="mt-6 min-h-28 w-full max-w-md">
        <AnimatePresence mode="wait">
          {current !== null ? (
            <motion.div
              key={count}
              initial={{ opacity: 0, y: 30, rotate: -4 }}
              animate={{ opacity: 1, y: 0, rotate: -1 }}
              exit={{ opacity: 0, y: -20 }}
              className="love-card paper-plain px-6 py-5 text-center text-lg text-neutral-800"
              aria-live="polite"
            >
              <span className="font-script block text-2xl text-[var(--c-primary)]">Motivo #{current + 1}</span>
              {reasons[current]}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
