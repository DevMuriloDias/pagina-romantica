"use client";
import { useState } from "react";
import { parseYouTubeId } from "@/lib/music";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

/** Fachada leve: o iframe do YouTube só carrega no clique (melhor para o Lighthouse). */
export function Video({ section, theme }: SectionProps<"video">) {
  const { mode } = useRuntime();
  const [play, setPlay] = useState(false);
  const id = parseYouTubeId(section.data.url);
  if (!id && mode === "public") return null;
  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Vídeo">
      <SectionTitle eyebrow="aperte o play">{section.data.title}</SectionTitle>
      {!id ? (
        <EmptyHint>Cole o link de um vídeo do YouTube 🎬</EmptyHint>
      ) : (
        <div className="love-card relative aspect-video w-full overflow-hidden bg-black">
          {play ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
              title={section.data.title || "Vídeo"}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0" aria-label="Reproduzir vídeo">
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90" />
              <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--c-primary)] text-2xl text-white shadow-xl transition-transform group-hover:scale-110">▶</span>
            </button>
          )}
        </div>
      )}
      {section.data.caption ? <p className="mt-4 text-center opacity-80">{section.data.caption}</p> : null}
    </SectionShell>
  );
}
