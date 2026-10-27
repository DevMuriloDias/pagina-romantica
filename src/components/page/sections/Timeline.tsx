"use client";
import { motion, useReducedMotion } from "framer-motion";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Img } from "../Img";
import { Paragraphs } from "../SafeText";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Timeline({ section, theme }: SectionProps<"timeline">) {
  const { mode } = useRuntime();
  const reduced = useReducedMotion();
  const { events, layout, title } = section.data;
  if (!events.length && mode === "public") return null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Linha do tempo">
      <SectionTitle eyebrow="nossa história">{title}</SectionTitle>
      {events.length === 0 ? (
        <EmptyHint>Adicione as datas especiais de vocês 🗓️</EmptyHint>
      ) : layout === "horizontal" ? (
        <div className="-mx-5 overflow-x-auto px-5 pb-4 [scrollbar-width:thin]">
          <ol className="relative flex w-max gap-6 pt-8">
            <span className="absolute left-0 right-0 top-[18px] h-0.5 bg-[var(--c-primary)] opacity-30" aria-hidden />
            {events.map((e, i) => (
              <motion.li
                key={e.id}
                initial={reduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative w-60"
              >
                <span className="absolute -top-8 left-4 flex size-9 items-center justify-center rounded-full bg-[var(--c-primary)] text-base text-white shadow">{e.emoji || "♥"}</span>
                <div className="love-card mt-4 overflow-hidden">
                  {e.image ? <Img image={e.image} className="aspect-video w-full" alt={e.image.alt || e.title} /> : null}
                  <div className="p-4">
                    {e.date ? <time className="text-xs font-semibold uppercase tracking-wider text-[var(--c-primary)]">{formatDate(e.date)}</time> : null}
                    <h3 className="mt-1 text-lg font-semibold">{e.title}</h3>
                    {e.description ? <Paragraphs text={e.description} className="mt-1 text-sm opacity-85" /> : null}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      ) : (
        <ol className="relative mx-auto max-w-2xl">
          <span className="absolute bottom-0 left-[18px] top-0 w-0.5 bg-[var(--c-primary)] opacity-30 @md:left-1/2" aria-hidden />
          {events.map((e, i) => (
            <motion.li
              key={e.id}
              initial={reduced ? false : { opacity: 0, x: i % 2 ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className={cn("relative mb-10 pl-12 @md:w-1/2 @md:pl-0", i % 2 ? "@md:ml-auto @md:pl-10" : "@md:pr-10 @md:text-right")}
            >
              <span
                className={cn(
                  "absolute left-0 top-1 flex size-9 items-center justify-center rounded-full bg-[var(--c-primary)] text-base text-white shadow ring-4 ring-[var(--c-bg)]",
                  i % 2 ? "@md:-left-[18px]" : "@md:-right-[18px] @md:left-auto",
                )}
              >
                {e.emoji || "♥"}
              </span>
              <div className="love-card overflow-hidden text-left">
                {e.image ? <Img image={e.image} className="aspect-video w-full" alt={e.image.alt || e.title} /> : null}
                <div className="p-5">
                  {e.date ? <time className="text-xs font-semibold uppercase tracking-wider text-[var(--c-primary)]">{formatDate(e.date)}</time> : null}
                  <h3 className="mt-1 text-xl font-semibold">{e.title}</h3>
                  {e.description ? <Paragraphs text={e.description} className="mt-2 opacity-85" /> : null}
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </SectionShell>
  );
}
