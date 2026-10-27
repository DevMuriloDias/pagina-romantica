"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect } from "react";
import type { Photo } from "@/lib/content/schema";
import { Img } from "./Img";
import { Overlay } from "./Overlay";

export function Lightbox({ photos, index, onChange }: { photos: Photo[]; index: number | null; onChange: (i: number | null) => void }) {
  const close = useCallback(() => onChange(null), [onChange]);
  const go = useCallback(
    (delta: number) => index !== null && onChange((index + delta + photos.length) % photos.length),
    [index, onChange, photos.length],
  );
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, close, go]);

  const photo = index !== null ? photos[index] : null;
  return (
    <Overlay>
    <AnimatePresence>
      {photo ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          className="pointer-events-auto absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div key={photo.id} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-h-[80%] max-w-full" onClick={(e) => e.stopPropagation()}>
            <Img image={photo.image} className="max-h-[60svh] w-auto max-w-full rounded object-contain" eager alt={photo.image.alt || photo.caption} />
          </motion.div>
          {photo.caption ? <p className="mt-4 max-w-lg text-center text-white/90">{photo.caption}</p> : null}
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25" onClick={() => go(-1)} aria-label="Foto anterior">←</button>
            <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25" onClick={close}>Fechar</button>
            <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25" onClick={() => go(1)} aria-label="Próxima foto">→</button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </Overlay>
  );
}
