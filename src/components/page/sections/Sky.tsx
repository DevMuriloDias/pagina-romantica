"use client";
import { useMemo } from "react";
import { formatDate } from "@/lib/format";
import { backgroundStars, projectSky, skyInstant } from "@/lib/sky";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Sky({ section, theme }: SectionProps<"sky">) {
  const { mode } = useRuntime();
  const d = section.data;
  const ready = Boolean(d.date && d.lat !== null && d.lng !== null);
  const sky = useMemo(() => {
    if (!d.date || d.lat === null || d.lng === null) return null;
    return projectSky(skyInstant(d.date, d.time, d.lng), d.lat, d.lng, 500);
  }, [d.date, d.time, d.lat, d.lng]);
  const bg = useMemo(() => backgroundStars(`${d.date}${d.city}`, 260), [d.date, d.city]);
  if (!ready && mode === "public") return null;

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Céu estrelado">
      <SectionTitle eyebrow="olhe para cima">{d.title}</SectionTitle>
      {!sky ? (
        <EmptyHint>Escolha a data e a cidade para desenhar o céu ✨</EmptyHint>
      ) : (
        <figure className="mx-auto max-w-md text-center">
          <svg viewBox="0 0 500 500" className="w-full drop-shadow-2xl" role="img" aria-label={`Mapa estelar de ${d.city || "nossa cidade"} em ${formatDate(d.date)}`}>
            <defs>
              <radialGradient id={`sky-${section.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1b2452" />
                <stop offset="100%" stopColor="#070a1a" />
              </radialGradient>
            </defs>
            <circle cx="250" cy="250" r="248" fill={`url(#sky-${section.id})`} stroke={theme.colors.primary} strokeOpacity="0.6" strokeWidth="3" />
            {bg.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
            ))}
            {d.showConstellations
              ? sky.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#cfd8ff" strokeOpacity="0.45" strokeWidth="0.9" />)
              : null}
            {sky.stars.map((s) => (
              <circle key={s.name} cx={s.x} cy={s.y} r={s.r} fill="#fffbe8">
                <title>{s.name}</title>
              </circle>
            ))}
            <text x="250" y="22" textAnchor="middle" fill="#cfd8ff" fontSize="12" opacity="0.7">N</text>
            <text x="16" y="254" textAnchor="middle" fill="#cfd8ff" fontSize="12" opacity="0.7">L</text>
            <text x="484" y="254" textAnchor="middle" fill="#cfd8ff" fontSize="12" opacity="0.7">O</text>
            <text x="250" y="490" textAnchor="middle" fill="#cfd8ff" fontSize="12" opacity="0.7">S</text>
          </svg>
          <figcaption className="mt-6">
            <p className="font-script text-2xl text-[var(--c-primary)]">{d.caption}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] opacity-70">
              {d.city ? `${d.city} · ` : ""}
              {formatDate(d.date)} · {d.time || "21:00"}
            </p>
          </figcaption>
        </figure>
      )}
    </SectionShell>
  );
}
