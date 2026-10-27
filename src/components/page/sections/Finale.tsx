"use client";
import { motion, useReducedMotion } from "framer-motion";
import { SafeText } from "../SafeText";
import { SectionShell } from "../SectionShell";
import type { SectionProps } from "../types";

/** Frase final + assinatura com efeito de escrita à mão (animação de traço SVG). */
export function Finale({ section, theme }: SectionProps<"finale">) {
  const reduced = useReducedMotion();
  const { phrase, signature } = section.data;
  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Mensagem final">
      <div className="text-center">
        <p className="mx-auto max-w-2xl text-balance text-2xl font-semibold @md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
          <SafeText text={phrase} />
        </p>
        {signature ? (
          <svg viewBox="0 0 600 140" className="mx-auto mt-8 h-24 w-full max-w-md @md:h-32" role="img" aria-label={`Assinado: ${signature}`}>
            <motion.text
              x="50%"
              y="60%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="84"
              style={{ fontFamily: "var(--font-script)" }}
              fill="transparent"
              stroke="var(--c-primary)"
              strokeWidth="1.6"
              strokeDasharray="1600"
              initial={reduced ? { strokeDashoffset: 0, fill: "var(--c-primary)" } : { strokeDashoffset: 1600, fill: "rgba(0,0,0,0)" }}
              whileInView={{ strokeDashoffset: 0, fill: "var(--c-primary)" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ strokeDashoffset: { duration: 3.2, ease: "easeInOut" }, fill: { delay: 2.6, duration: 1 } }}
            >
              {signature}
            </motion.text>
          </svg>
        ) : null}
        <p className="mt-6 text-3xl text-[var(--c-primary)]" aria-hidden>♥</p>
      </div>
    </SectionShell>
  );
}
