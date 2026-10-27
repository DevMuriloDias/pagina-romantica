"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { SafeText } from "../SafeText";
import { SectionShell } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

const TEASES = ["Tem certeza? 🥺", "Pensa melhor...", "Ops, escapou!", "Tenta o outro botão 😏", "Nem vem!"];

export function Proposal({ section, theme }: SectionProps<"proposal">) {
  const { act } = useRuntime();
  const reduced = useReducedMotion();
  const areaRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const [noPos, setNoPos] = useState<{ x: number; y: number } | null>(null);
  const [tries, setTries] = useState(0);
  const [answered, setAnswered] = useState<"yes" | "no" | null>(null);
  const d = section.data;

  const flee = () => {
    const area = areaRef.current;
    if (!area) return;
    const w = area.clientWidth - 110;
    const h = area.clientHeight - 48;
    setNoPos({ x: Math.max(0, Math.random() * w), y: Math.max(0, Math.random() * h) });
    setTries((t) => t + 1);
  };

  const sayYes = async () => {
    setAnswered("yes");
    if (!reduced && confettiRef.current) {
      const confetti = (await import("canvas-confetti")).default;
      const fire = confetti.create(confettiRef.current, { resize: true });
      const colors = [theme.colors.primary, theme.colors.secondary, theme.colors.accent, "#ffffff"];
      fire({ particleCount: 160, spread: 90, origin: { y: 0.7 }, colors });
      setTimeout(() => fire({ particleCount: 120, spread: 120, origin: { y: 0.6 }, colors, shapes: ["circle"] }), 400);
    }
    void act({ type: "proposal", answer: "yes", sectionId: section.id });
  };

  const sayNo = () => {
    // só chega aqui pelo teclado; respeitamos a resposta
    setAnswered("no");
    void act({ type: "proposal", answer: "no", sectionId: section.id });
  };

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Pedido especial">
      <div className="relative text-center">
        <canvas ref={confettiRef} className="pointer-events-none absolute -inset-x-5 -top-20 z-20 h-[calc(100%+10rem)] w-[calc(100%+2.5rem)]" aria-hidden />
        <motion.div animate={reduced ? undefined : { scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-6xl" aria-hidden>
          {d.kind === "casamento" ? "💍" : "💘"}
        </motion.div>
        <h2 className="mx-auto mt-6 max-w-xl text-balance text-3xl font-bold @md:text-5xl">
          <SafeText text={d.question} />
        </h2>
        {answered === "yes" ? (
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-8 max-w-lg text-xl" aria-live="polite">
            <SafeText text={d.yesMessage} />
          </motion.p>
        ) : answered === "no" ? (
          <p className="mt-8 text-lg" aria-live="polite">Tudo bem. Eu continuo aqui, do seu lado. 💕</p>
        ) : (
          <div ref={areaRef} className="relative mx-auto mt-10 h-44 max-w-md">
            <div className="absolute inset-x-0 top-0 flex justify-center">
              <motion.button
                type="button"
                onClick={sayYes}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full bg-[var(--c-primary)] px-10 py-4 text-xl font-bold text-white shadow-[var(--shadow)]"
                style={{ fontSize: `${1.25 + Math.min(tries, 6) * 0.08}rem` }}
              >
                {d.yesLabel || "Sim!"}
              </motion.button>
            </div>
            <motion.button
              type="button"
              onPointerEnter={(e) => e.pointerType === "mouse" && flee()}
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse") {
                  e.preventDefault();
                  flee();
                }
              }}
              onClick={(e) => {
                if (e.detail > 0) flee();
                else sayNo();
              }}
              animate={noPos ? { left: noPos.x, top: noPos.y } : { left: "50%", top: 88, x: "-50%" }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="absolute rounded-full border-2 border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-2.5 text-base"
            >
              {tries > 0 ? TEASES[(tries - 1) % TEASES.length] : d.noLabel || "Não"}
            </motion.button>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
