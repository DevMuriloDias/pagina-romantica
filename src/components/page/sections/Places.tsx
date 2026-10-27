"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { Img } from "../Img";
import { Paragraphs } from "../SafeText";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <div className="love-card aspect-[4/3] w-full animate-pulse @md:aspect-video" />,
});

export function Places({ section, theme }: SectionProps<"places">) {
  const { mode } = useRuntime();
  const [active, setActive] = useState<string | null>(null);
  const { places, layout, title } = section.data;
  if (!places.length && mode === "public") return null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Lugares importantes">
      <SectionTitle eyebrow="por onde passamos">{title}</SectionTitle>
      {places.length === 0 ? (
        <EmptyHint>Marque os lugares especiais de vocês no mapa 📍</EmptyHint>
      ) : layout === "passport" ? (
        <div className="grid grid-cols-1 gap-5 @sm:grid-cols-2">
          {places.map((p, i) => (
            <article key={p.id} className="love-card relative overflow-hidden p-5" style={{ rotate: `${(i % 3) - 1}deg` }}>
              <div
                className="absolute -right-4 -top-4 flex size-24 rotate-12 flex-col items-center justify-center rounded-full border-[3px] border-dashed text-center text-[10px] font-bold uppercase leading-tight tracking-wider opacity-80"
                style={{ borderColor: "var(--c-primary)", color: "var(--c-primary)" }}
                aria-hidden
              >
                <span>♥</span>
                <span className="max-w-16 truncate">{p.name}</span>
                {p.date ? <span>{p.date.slice(0, 4)}</span> : null}
              </div>
              {p.image ? <Img image={p.image} className="mb-3 aspect-video w-full rounded" alt={p.image.alt || p.name} /> : null}
              <p className="text-xs uppercase tracking-[0.2em] opacity-60">Carimbo nº {String(i + 1).padStart(3, "0")}</p>
              <h3 className="mt-1 text-xl font-semibold">{p.name}</h3>
              {p.date ? <time className="text-sm text-[var(--c-primary)]">{formatDate(p.date)}</time> : null}
              {p.story ? <Paragraphs text={p.story} className="mt-2 text-sm opacity-85" /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <PlacesMap places={places} active={active} onSelect={setActive} color={theme.colors.primary} />
          <ul className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActive(p.id)}
                  className="love-card flex w-full gap-3 p-3 text-left transition-transform hover:-translate-y-0.5"
                  aria-pressed={active === p.id}
                >
                  {p.image ? <Img image={p.image} className="size-16 shrink-0 rounded" alt={p.image.alt || p.name} /> : <span className="flex size-16 shrink-0 items-center justify-center rounded bg-[var(--c-primary-soft)] text-2xl">📍</span>}
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.name}</span>
                    {p.date ? <span className="block text-xs text-[var(--c-primary)]">{formatDate(p.date)}</span> : null}
                    {p.story ? <span className="line-clamp-2 text-sm opacity-80">{p.story}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionShell>
  );
}
