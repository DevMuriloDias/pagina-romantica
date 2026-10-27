"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Quiz({ section, theme }: SectionProps<"quiz">) {
  const { mode } = useRuntime();
  const qs = section.data.questions.filter((q) => q.question.trim());
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  if (!qs.length && mode === "public") return null;

  const done = step >= qs.length;
  const q = qs[step];
  const choose = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.correctIndex) setScore((s) => s + 1);
    setTimeout(() => {
      setPicked(null);
      setStep((s) => s + 1);
    }, 1100);
  };
  const ratio = qs.length ? score / qs.length : 0;
  const result = ratio >= 0.8 ? section.data.resultHigh : ratio >= 0.4 ? section.data.resultMid : section.data.resultLow;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Quiz do casal">
      <SectionTitle eyebrow="vamos ver...">{section.data.title}</SectionTitle>
      {!qs.length ? (
        <EmptyHint>Crie perguntas sobre vocês dois 🧩</EmptyHint>
      ) : (
        <div className="love-card mx-auto max-w-lg p-6 @md:p-8">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center" aria-live="polite">
                <p className="text-5xl font-bold text-[var(--c-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                  {score}/{qs.length}
                </p>
                <p className="mt-4 text-lg">{result}</p>
                <button type="button" onClick={() => { setStep(0); setScore(0); }} className="mt-6 text-sm underline opacity-70">
                  Jogar de novo
                </button>
              </motion.div>
            ) : q ? (
              <motion.div key={q.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <p className="text-xs uppercase tracking-widest opacity-60">Pergunta {step + 1} de {qs.length}</p>
                <h3 className="mt-2 text-xl font-semibold">{q.question}</h3>
                <div className="mt-5 grid gap-2.5">
                  {q.options.map((o, i) => {
                    const state = picked === null ? "idle" : i === q.correctIndex ? "right" : i === picked ? "wrong" : "idle";
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => choose(i)}
                        className={cn(
                          "rounded-[calc(var(--radius)*0.75)] border-2 px-4 py-3 text-left transition-all",
                          state === "idle" && "border-[var(--c-border)] hover:border-[var(--c-primary)]",
                          state === "right" && "border-emerald-500 bg-emerald-500/15",
                          state === "wrong" && "border-red-400 bg-red-400/15",
                        )}
                      >
                        {o} {state === "right" ? "✓" : state === "wrong" ? "✗" : ""}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      )}
    </SectionShell>
  );
}
