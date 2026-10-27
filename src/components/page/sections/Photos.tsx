"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/content/schema";
import { cn } from "@/lib/utils";
import { Img } from "../Img";
import { Lightbox } from "../Lightbox";
import { EmptyHint, SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Photos({ section, theme }: SectionProps<"photos">) {
  const { mode } = useRuntime();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { photos, layout, title } = section.data;
  if (!photos.length && mode === "public") return null;

  const Layout = LAYOUTS[layout];
  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Fotos">
      <SectionTitle eyebrow="memórias">{title}</SectionTitle>
      {photos.length === 0 ? <EmptyHint>Suas fotos vão aparecer aqui 📸</EmptyHint> : <Layout photos={photos} onOpen={setLightbox} />}
      <Lightbox photos={photos} index={lightbox} onChange={setLightbox} />
    </SectionShell>
  );
}

type LayoutProps = { photos: Photo[]; onOpen: (i: number) => void };

function Polaroids({ photos, onOpen }: LayoutProps) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-wrap justify-center gap-x-2 gap-y-6 @md:gap-x-4">
      {photos.map((p, i) => {
        const rot = ((i * 37) % 13) - 6;
        return (
          <motion.button
            type="button"
            key={p.id}
            onClick={() => onOpen(i)}
            initial={reduced ? false : { opacity: 0, y: 30, rotate: rot * 2 }}
            whileInView={{ opacity: 1, y: 0, rotate: rot }}
            whileHover={reduced ? undefined : { scale: 1.06, rotate: 0, zIndex: 10 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 16, delay: (i % 6) * 0.06 }}
            className="relative w-[44%] bg-white p-2 pb-9 text-left shadow-lg @sm:w-48 @md:w-56"
            aria-label={p.caption || `Foto ${i + 1}`}
          >
            <Img image={p.image} className="aspect-square w-full" alt={p.image.alt || p.caption} />
            {p.caption ? <span className="font-script absolute inset-x-2 bottom-1.5 truncate text-center text-lg text-neutral-700">{p.caption}</span> : null}
          </motion.button>
        );
      })}
    </div>
  );
}

function Grid({ photos, onOpen }: LayoutProps) {
  return (
    <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @md:gap-3">
      {photos.map((p, i) => (
        <button type="button" key={p.id} onClick={() => onOpen(i)} className={cn("group relative overflow-hidden rounded-[var(--radius)]", i % 5 === 0 && "@md:col-span-2 @md:row-span-2")} aria-label={p.caption || `Foto ${i + 1}`}>
          <Img image={p.image} className="aspect-square h-full w-full transition-transform duration-500 group-hover:scale-105" alt={p.image.alt || p.caption} />
          {p.caption ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 p-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">{p.caption}</span> : null}
        </button>
      ))}
    </div>
  );
}

function Carousel({ photos, onOpen }: LayoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none]">
        {photos.map((p, i) => (
          <button type="button" key={p.id} onClick={() => onOpen(i)} className="love-card w-[78%] shrink-0 snap-center overflow-hidden @md:w-[55%]" aria-label={p.caption || `Foto ${i + 1}`}>
            <Img image={p.image} className="aspect-[4/5] w-full" alt={p.image.alt || p.caption} />
            {p.caption ? <p className="p-3 text-center text-sm">{p.caption}</p> : null}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-3">
        <button type="button" onClick={() => scroll(-1)} className="love-card px-4 py-1.5" aria-label="Anterior">←</button>
        <button type="button" onClick={() => scroll(1)} className="love-card px-4 py-1.5" aria-label="Próxima">→</button>
      </div>
    </div>
  );
}

function Slideshow({ photos, onOpen }: LayoutProps) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), 4000);
    return () => clearInterval(t);
  }, [photos.length, reduced]);
  const p = photos[i % photos.length]!;
  return (
    <div className="relative -mx-5 overflow-hidden @md:mx-0 @md:rounded-[var(--radius)]">
      <button type="button" className="relative block aspect-[3/4] w-full bg-black @md:aspect-video" onClick={() => onOpen(i)} aria-label="Ampliar foto">
        <AnimatePresence mode="popLayout">
          <motion.div key={p.id} className="absolute inset-0" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
            <Img image={p.image} className="h-full w-full" alt={p.image.alt || p.caption} />
          </motion.div>
        </AnimatePresence>
        {p.caption ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-5 text-center text-white">{p.caption}</span> : null}
      </button>
      <div className="absolute right-3 top-3 flex gap-1">
        {photos.map((ph, idx) => (
          <span key={ph.id} className={cn("h-1 w-5 rounded-full bg-white/40", idx === i % photos.length && "bg-white")} />
        ))}
      </div>
    </div>
  );
}

function Film({ photos, onOpen }: LayoutProps) {
  const holes = (
    <div className="flex justify-between px-1 py-1.5" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="h-2.5 w-3.5 rounded-[2px] bg-[#f5f0e6]/90" />
      ))}
    </div>
  );
  return (
    <div className="-mx-5 overflow-x-auto bg-[#1a1714] py-1 @md:mx-0 @md:rounded-md [scrollbar-width:thin]">
      <div className="w-max min-w-full">
        {holes}
        <div className="flex gap-2 px-2">
          {photos.map((p, i) => (
            <button type="button" key={p.id} onClick={() => onOpen(i)} className="w-44 shrink-0 @md:w-56" aria-label={p.caption || `Foto ${i + 1}`}>
              <Img image={p.image} className="aspect-[4/3] w-full sepia-[0.25]" alt={p.image.alt || p.caption} />
              <span className="block truncate pt-1 text-center font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                {String(i + 1).padStart(2, "0")} {p.caption}
              </span>
            </button>
          ))}
        </div>
        {holes}
      </div>
    </div>
  );
}

function Flipbook({ photos, onOpen }: LayoutProps) {
  const [rawPage, setPage] = useState(0);
  const reduced = useReducedMotion();
  const page = Math.min(rawPage, photos.length - 1);
  const p = photos[page]!;
  return (
    <div className="mx-auto max-w-md">
      <div className="relative [perspective:1600px]">
        <AnimatePresence mode="wait">
          <motion.button
            type="button"
            key={p.id}
            onClick={() => onOpen(page)}
            initial={reduced ? { opacity: 0 } : { rotateY: -90, opacity: 0.4 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { rotateY: 90, opacity: 0.4 }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: "left center" }}
            className="love-card paper-plain block w-full overflow-hidden p-4 text-left"
            aria-label={`Página ${page + 1} do livro de memórias`}
          >
            <Img image={p.image} className="aspect-[4/5] w-full rounded" alt={p.image.alt || p.caption} />
            <p className="font-script mt-3 min-h-8 text-center text-2xl text-neutral-700">{p.caption}</p>
            <span className="absolute bottom-2 right-4 text-xs text-neutral-400">{page + 1} / {photos.length}</span>
          </motion.button>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button type="button" disabled={page === 0} onClick={() => setPage((x) => x - 1)} className="love-card px-4 py-1.5 disabled:opacity-40">← Voltar</button>
        <button type="button" disabled={page === photos.length - 1} onClick={() => setPage((x) => x + 1)} className="love-card px-4 py-1.5 disabled:opacity-40">Virar →</button>
      </div>
    </div>
  );
}

const LAYOUTS = { polaroid: Polaroids, grid: Grid, carousel: Carousel, slideshow: Slideshow, film: Film, flipbook: Flipbook } as const;
