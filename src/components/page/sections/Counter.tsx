"use client";
import { AnimatePresence, motion } from "framer-motion";
import { parseLocalDateTime, elapsedBetween } from "@/lib/time";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";
import { useNow } from "../useNow";

export type ClockStyle = "flip" | "minimal" | "hearts";

export function TimeUnits({ units, style }: { units: { label: string; value: number }[]; style: ClockStyle }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 @md:gap-4" role="timer" aria-live="off">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          {style === "flip" ? (
            <div className="relative flex h-16 min-w-14 items-center justify-center overflow-hidden rounded-lg bg-[#1d1a1f] px-2 text-3xl font-bold tabular-nums text-white shadow-lg @md:h-20 @md:min-w-20 @md:text-5xl">
              <span className="absolute inset-x-0 top-1/2 h-px bg-black/50" aria-hidden />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={u.value} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ rotateX: 90, opacity: 0 }} transition={{ duration: 0.35 }}>
                  {String(u.value).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>
          ) : style === "hearts" ? (
            <div className="relative flex size-20 items-center justify-center @md:size-24">
              <svg viewBox="0 0 24 24" className="absolute inset-0 size-full text-[var(--c-primary)]" aria-hidden>
                <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.4 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.4 0 5.8 3.3 4.3 6.8C19.5 16.4 12 21 12 21z" fill="currentColor" />
              </svg>
              <span className="relative -mt-1 text-xl font-bold tabular-nums text-white @md:text-2xl">{u.value}</span>
            </div>
          ) : (
            <span className="text-4xl font-light tabular-nums @md:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>
              {u.value}
            </span>
          )}
          <span className="mt-2 text-xs uppercase tracking-[0.18em] opacity-70">{u.label}</span>
        </div>
      ))}
    </div>
  );
}

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

export function Counter({ section, theme }: SectionProps<"counter">) {
  const { mode } = useRuntime();
  const now = useNow(1000);
  const start = parseLocalDateTime(section.data.startDate);
  if (!start && mode === "public") return null;

  const e = start && now ? elapsedBetween(start, now) : null;
  const units = e
    ? [
        { label: plural(e.years, "ano", "anos"), value: e.years },
        { label: plural(e.months, "mês", "meses"), value: e.months },
        { label: plural(e.days, "dia", "dias"), value: e.days },
        { label: plural(e.hours, "hora", "horas"), value: e.hours },
        { label: "min", value: e.minutes },
        { label: "seg", value: e.seconds },
      ].filter((u, i) => i > 1 || u.value > 0 || (i === 1 && e.years > 0))
    : [];

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Tempo juntos">
      <SectionTitle>{section.data.title}</SectionTitle>
      {!start ? (
        <EmptyHint>Escolha a data em que tudo começou ⏳</EmptyHint>
      ) : (
        <>
          <TimeUnits units={units} style={section.data.style} />
          {e ? <p className="mt-6 text-center text-sm opacity-75">São {e.totalDays.toLocaleString("pt-BR")} dias de nós dois 💕</p> : null}
        </>
      )}
    </SectionShell>
  );
}
