"use client";
import { parseLocalDateTime, remainingUntil } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";
import { useNow } from "../useNow";
import { TimeUnits } from "./Counter";

export function Countdown({ section, theme }: SectionProps<"countdown">) {
  const { mode } = useRuntime();
  const now = useNow(1000);
  const target = parseLocalDateTime(section.data.targetDate);
  if (!target && mode === "public") return null;
  const r = target && now ? remainingUntil(target, now) : null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Contagem regressiva">
      <SectionTitle eyebrow={section.data.eventName || undefined}>{section.data.title}</SectionTitle>
      {!target ? (
        <EmptyHint>Escolha a data do próximo grande momento 🚀</EmptyHint>
      ) : r?.done ? (
        <p className="text-center text-2xl font-semibold">{section.data.doneMessage}</p>
      ) : (
        <>
          <TimeUnits
            style={section.data.style}
            units={[
              { label: "dias", value: r?.days ?? 0 },
              { label: "horas", value: r?.hours ?? 0 },
              { label: "min", value: r?.minutes ?? 0 },
              { label: "seg", value: r?.seconds ?? 0 },
            ]}
          />
          <p className="mt-6 text-center text-sm opacity-75">{formatDate(target, { dateStyle: "full", timeStyle: "short" })}</p>
        </>
      )}
    </SectionShell>
  );
}
