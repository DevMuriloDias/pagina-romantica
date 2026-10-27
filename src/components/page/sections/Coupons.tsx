"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Coupons({ section, theme }: SectionProps<"coupons">) {
  const { mode, act } = useRuntime();
  const [redeemed, setRedeemed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const coupons = section.data.coupons;
  if (!coupons.length && mode === "public") return null;

  const redeem = async (id: string, title: string) => {
    setBusy(id);
    const r = await act({ type: "coupon", couponId: id, title, sectionId: section.id });
    setBusy(null);
    setRedeemed((s) => ({ ...s, [id]: r.ok ? r.message ?? "Resgatado! Já avisei 💌" : r.message ?? "Não deu certo, tenta de novo" }));
  };

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Vale-presentes">
      <SectionTitle eyebrow="pode usar quando quiser">{section.data.title}</SectionTitle>
      {!coupons.length ? (
        <EmptyHint>Crie vales como “vale 1 massagem” 🎟️</EmptyHint>
      ) : (
        <div className="grid gap-4 @md:grid-cols-2">
          {coupons.map((c) => {
            const done = redeemed[c.id];
            return (
              <motion.div key={c.id} whileHover={{ y: -3 }} className={cn("love-card relative flex overflow-hidden", done && "opacity-80")}>
                <div className="flex w-20 shrink-0 items-center justify-center bg-[var(--c-primary)] text-3xl text-white">{c.emoji || "🎟️"}</div>
                <div className="relative flex-1 border-l-2 border-dashed border-[var(--c-border)] p-4">
                  <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-[var(--c-bg)]" aria-hidden />
                  <span className="absolute -bottom-2.5 -left-2.5 size-5 rounded-full bg-[var(--c-bg)]" aria-hidden />
                  <h3 className="text-lg font-semibold">{c.title}</h3>
                  {c.description ? <p className="mt-0.5 text-sm opacity-80">{c.description}</p> : null}
                  {done ? (
                    <p className="mt-3 text-sm font-semibold text-[var(--c-primary)]" aria-live="polite">{done}</p>
                  ) : (
                    <button type="button" disabled={busy === c.id} onClick={() => redeem(c.id, c.title)} className="mt-3 rounded-full bg-[var(--c-primary)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                      {busy === c.id ? "Resgatando..." : "Resgatar"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
