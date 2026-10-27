"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { GateConfig } from "@/lib/content/schema";
import { SafeText } from "./SafeText";

export type VerifyFn = (answer: string) => Promise<{ ok: boolean; message?: string }>;

/**
 * Tela de "porta". Além de proteger a página, o clique aqui é o gesto do usuário
 * que libera o autoplay da música nos navegadores.
 */
export function Gate({
  gate,
  recipientName,
  onOpen,
  verify,
  hasMusic,
}: {
  gate: GateConfig;
  recipientName: string;
  onOpen: () => void;
  verify?: VerifyFn;
  hasMusic?: boolean;
}) {
  const reduced = useReducedMotion();
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Sem função de verificação (ex.: página já desbloqueada neste navegador) a porta só tem o botão.
  const protectedMode = gate.mode !== "none" && gate.answersCount > 0 && Boolean(verify);

  const open = () => {
    setLeaving(true);
    onOpen();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify || !answer.trim()) return;
    setBusy(true);
    setError(null);
    const r = await verify(answer);
    setBusy(false);
    if (r.ok) open();
    else {
      setAttempts((a) => a + 1);
      setError(r.message || gate.errorMessage || "Resposta incorreta. Tente de novo 💕");
    }
  };

  const showHint = gate.hint && attempts >= gate.hintAfter;

  return (
    <AnimatePresence>
      {!leaving ? (
        <motion.div
          key="gate"
          className="pointer-events-auto absolute inset-0 z-[80] flex items-center justify-center overflow-hidden p-6"
          style={{ background: "var(--c-bg)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: "blur(8px)" }}
          transition={{ duration: 0.8 }}
        >
          <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 50% 40%, var(--c-primary-soft), transparent 70%)" }} aria-hidden />
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm text-center"
          >
            <motion.div
              animate={reduced ? undefined : { scale: [1, 1.12, 1, 1.12, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }}
              className="mx-auto mb-6 text-6xl"
              aria-hidden
            >
              💌
            </motion.div>
            <h1 className="text-balance text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              <SafeText text={gate.welcomeText || (recipientName ? `${recipientName}, tenho uma surpresa para você` : "Tenho uma surpresa para você")} />
            </h1>

            {protectedMode ? (
              <form onSubmit={submit} className="mt-8 space-y-3">
                <label htmlFor="gate-answer" className="block text-sm opacity-80">
                  {gate.mode === "password" ? gate.question || "Digite a senha (dica: uma data especial, no formato DDMMAAAA)" : gate.question}
                </label>
                <input
                  id="gate-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  inputMode={gate.mode === "password" ? "numeric" : "text"}
                  autoComplete="off"
                  autoCapitalize="none"
                  className="w-full rounded-full border-2 border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-3 text-center text-lg text-[var(--c-text)] outline-none focus:border-[var(--c-primary)]"
                  placeholder={gate.mode === "password" ? "••••••••" : "Sua resposta"}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "gate-error" : undefined}
                />
                <AnimatePresence>
                  {error ? (
                    <motion.p id="gate-error" role="alert" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: [0, -8, 8, -4, 0] }} className="text-sm text-[var(--c-primary)]">
                      {error}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                {showHint ? <p className="text-sm opacity-80">💡 Dica: {gate.hint}</p> : null}
                <button type="submit" disabled={busy} className="w-full rounded-full bg-[var(--c-primary)] px-6 py-3.5 text-lg font-semibold text-white shadow-[var(--shadow)] transition-transform active:scale-95 disabled:opacity-60">
                  {busy ? "Verificando..." : gate.buttonLabel || "Entrar 💌"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={open}
                className="mt-10 rounded-full bg-[var(--c-primary)] px-10 py-4 text-xl font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-105 active:scale-95"
              >
                {gate.buttonLabel || "Abrir 💌"}
              </button>
            )}
            {hasMusic ? (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm opacity-80">
                <span aria-hidden className="text-lg">🔊</span> Aumente o volume: esta página tem música
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
