"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Img } from "../Img";
import { SafeText } from "../SafeText";
import { sectionStyleVars } from "../SectionShell";
import type { SectionProps } from "../types";

export function Hero({ section, content }: SectionProps<"hero">) {
  const d = section.data;
  const reduced = useReducedMotion();
  const names = [content.meta.senderName, content.meta.recipientName].filter(Boolean);
  return (
    <section
      id={`s-${section.id}`}
      className="relative flex min-h-[78svh] items-center justify-center overflow-hidden px-6 py-20 text-center"
      style={sectionStyleVars(section.style)}
    >
      <div className="relative z-10 mx-auto max-w-2xl">
        {d.layout === "photo" && d.photo ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.9, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: -3 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-10 w-56 rotate-[-3deg] bg-white p-3 pb-10 shadow-xl @md:w-72"
          >
            <Img image={d.photo} className="aspect-square w-full" eager alt={d.photo.alt || "Foto do casal"} />
          </motion.div>
        ) : null}
        {names.length === 2 ? (
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="font-script mb-4 text-3xl text-[var(--c-primary)] @md:text-4xl"
          >
            {names[0]} <span aria-hidden>♥</span>
            <span className="sr-only"> e </span> {names[1]}
          </motion.p>
        ) : null}
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-balance text-4xl font-bold text-[var(--c-text)] @md:text-6xl"
        >
          <SafeText text={d.title} />
        </motion.h1>
        {d.subtitle ? (
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 0.85 }}
            transition={{ delay: 0.7, duration: 1 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg @md:text-xl"
          >
            <SafeText text={d.subtitle} />
          </motion.p>
        ) : null}
        <motion.div
          aria-hidden
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 0.7, y: reduced ? 0 : [0, 8, 0] }}
          transition={{ delay: 1.4, duration: 2, repeat: reduced ? 0 : Infinity }}
          className="mt-14 text-2xl text-[var(--c-primary)]"
        >
          ↓
        </motion.div>
      </div>
    </section>
  );
}
