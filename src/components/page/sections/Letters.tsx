"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Letter } from "@/lib/content/schema";
import { formatDate } from "@/lib/format";
import { fontStack } from "@/lib/theme/fonts";
import { parseLocalDateTime, remainingUntil } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Paragraphs } from "../SafeText";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";
import { useNow } from "../useNow";
import { Overlay } from "../Overlay";

export function Letters({ section, theme }: SectionProps<"letters">) {
  const { mode } = useRuntime();
  const [open, setOpen] = useState<Letter | null>(null);
  const letters = section.data.letters;
  if (!letters.length && mode === "public") return null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Cartinhas">
      <SectionTitle eyebrow="com carinho">{section.data.title}</SectionTitle>
      {letters.length === 0 ? (
        <EmptyHint>Adicione sua primeira cartinha no painel ao lado ✍️</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 pb-8 @sm:grid-cols-2">
          {letters.map((l, i) => (
            <Envelope key={l.id} letter={l} index={i} onOpen={() => setOpen(l)} />
          ))}
        </div>
      )}
      <Overlay>
        <AnimatePresence>{open ? <OpenLetter letter={open} onClose={() => setOpen(null)} /> : null}</AnimatePresence>
      </Overlay>
    </SectionShell>
  );
}

function Envelope({ letter, index, onOpen }: { letter: Letter; index: number; onOpen: () => void }) {
  const now = useNow(1000);
  const reduced = useReducedMotion();
  const unlockAt = letter.lockedUntil ? parseLocalDateTime(letter.lockedUntil) : null;
  const locked = Boolean(unlockAt && (!now || now < unlockAt));
  const remaining = unlockAt && now ? remainingUntil(unlockAt, now) : null;
  const color = letter.envelopeColor ?? "var(--c-secondary)";
  const label = letter.kind === "open_when" && letter.openWhen ? `Abra quando ${letter.openWhen}` : letter.title || "Uma carta para você";

  return (
    <motion.button
      type="button"
      onClick={locked ? undefined : onOpen}
      aria-disabled={locked}
      aria-label={locked ? `${label} — trancada até ${formatDate(letter.lockedUntil)}` : `Abrir carta: ${label}`}
      whileHover={reduced || locked ? undefined : { y: -6, rotate: index % 2 ? 1.5 : -1.5 }}
      whileTap={locked ? undefined : { scale: 0.97 }}
      className={cn("group relative mx-auto block aspect-[4/3] w-full max-w-sm text-left", locked && "cursor-not-allowed")}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[calc(var(--radius)/2)] shadow-[var(--shadow)]" style={{ background: color }}>
        {/* aba do envelope */}
        <div
          className="absolute inset-x-0 top-0 h-1/2 origin-top transition-transform duration-500 group-hover:[transform:rotateX(25deg)]"
          style={{ background: color, filter: "brightness(0.93)", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: color, filter: "brightness(0.97)", clipPath: "polygon(0 100%, 50% 0, 100% 100%)" }} />
        {/* selo */}
        <div className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--c-primary)] text-xl text-white shadow-md">
          {locked ? "🔒" : "♥"}
        </div>
      </div>
      <div className="absolute inset-x-0 -bottom-8 text-center">
        <p className="font-script text-xl text-[var(--c-text)]">{label}</p>
        {locked && remaining ? (
          <p className="mt-1 text-xs tabular-nums opacity-70">
            Abre em {remaining.days}d {remaining.hours}h {remaining.minutes}m {remaining.seconds}s
          </p>
        ) : null}
      </div>
    </motion.button>
  );
}

function OpenLetter({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={letter.title || "Carta"}
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.article
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { y: 120, scaleY: 0.2, opacity: 0 }}
        animate={{ y: 0, scaleY: 1, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 160 }}
        className={cn("relative max-h-[85%] w-full max-w-xl origin-bottom overflow-y-auto rounded-md px-7 py-8 text-[#2b2320] shadow-2xl @md:px-12", `paper-${letter.paper}`)}
      >
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full px-2 text-xl opacity-60 hover:opacity-100" aria-label="Fechar carta">
          ×
        </button>
        {letter.title ? <h3 className="mb-4 text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{letter.title}</h3> : null}
        <div className="text-[1.35rem] leading-[32px]" style={{ fontFamily: fontStack(letter.font) }}>
          <Paragraphs text={letter.body} />
          {letter.signature ? <p className="mt-6 text-right text-2xl">{letter.signature}</p> : null}
        </div>
      </motion.article>
    </motion.div>
  );
}
