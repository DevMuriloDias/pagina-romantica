"use client";
import { Crop, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import type { ImageRef } from "@/lib/content/schema";
import { cropImage, sameOriginImageUrl, uploadImage } from "@/lib/client/upload";
import { safeImageUrl } from "@/lib/theme/css";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";
import { ChoiceChips } from "./fields";

/** Envia várias fotos em sequência, informando o progresso. */
export function useUploader() {
  const pageId = useBuilder((s) => s.pageId);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: File[] | Blob[], onEach: (img: ImageRef) => void) => {
    setError(null);
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        onEach(await uploadImage(pageId, files[i]!));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no envio de uma das fotos.");
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
  };
  return { upload, progress, error };
}

export function UploadButton({ onFiles, multiple, label = "Adicionar fotos", disabled, busy }: { onFiles: (files: File[]) => void; multiple?: boolean; label?: string; disabled?: boolean; busy?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={disabled || Boolean(busy)}>
        {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {busy ?? label}
      </Button>
    </>
  );
}

/** Campo de imagem única (capa, linha do tempo, lugares, raspadinha, fundo). */
export function ImageField({ label, value, onChange, aspect }: { label: string; value?: ImageRef; onChange: (img: ImageRef | undefined) => void; aspect?: number }) {
  const { upload, progress, error } = useUploader();
  const [cropping, setCropping] = useState(false);
  const src = safeImageUrl(value?.url);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5 ring-1 ring-line">
          {src ? <img src={src} alt={value?.alt ?? ""} className="size-full object-cover" /> : <ImagePlus className="size-6 text-ink-soft/40" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <UploadButton
            label={src ? "Trocar" : "Enviar foto"}
            busy={progress ? "Enviando..." : null}
            onFiles={(files) => upload(files.slice(0, 1), (img) => onChange({ ...img, alt: value?.alt ?? "" }))}
          />
          {src ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCropping(true)}>
                <Crop /> Recortar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
                Remover
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {cropping && value ? (
        <CropDialog image={value} aspect={aspect} onClose={() => setCropping(false)} onCropped={(img) => onChange({ ...img, alt: value.alt })} />
      ) : null}
    </div>
  );
}

const ASPECTS = [
  { value: "orig", label: "Original" },
  { value: "1", label: "Quadrado" },
  { value: "0.8", label: "Retrato 4:5" },
  { value: "1.7778", label: "Paisagem 16:9" },
] as const;

/** Recorte simples: proporção + zoom + arrastar para enquadrar. Gera uma nova imagem (sem alterar a original). */
export function CropDialog({ image, aspect: fixedAspect, onClose, onCropped }: { image: ImageRef; aspect?: number; onClose: () => void; onCropped: (img: ImageRef) => void }) {
  const pageId = useBuilder((s) => s.pageId);
  const src = safeImageUrl(image.url) ?? "";
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [aspectKey, setAspectKey] = useState<string>(fixedAspect ? String(fixedAspect) : "orig");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setError("Não foi possível carregar a imagem para recorte.");
    img.src = sameOriginImageUrl(src);
  }, [src]);

  const aspect = aspectKey === "orig" ? (natural ? natural.w / natural.h : 1) : Number(aspectKey);

  // região visível (normalizada) da imagem dentro da moldura
  const region = (() => {
    if (!natural) return { x: 0, y: 0, w: 1, h: 1 };
    const imgAspect = natural.w / natural.h;
    let w = 1;
    let h = 1;
    if (imgAspect > aspect) w = aspect / imgAspect;
    else h = imgAspect / aspect;
    w /= zoom;
    h /= zoom;
    const x = ((1 - w) / 2) * (1 + pan.x);
    const y = ((1 - h) / 2) * (1 + pan.y);
    return { x, y, w, h };
  })();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await cropImage(src, region);
      const { uploadImage } = await import("@/lib/client/upload");
      onCropped(await uploadImage(pageId, blob));
      onClose();
    } catch {
      setError("Não foi possível recortar esta imagem. Se ela estiver num armazenamento externo, verifique o CORS do bucket (ver README).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader title="Recortar foto" description="Escolha a proporção, aproxime e arraste para enquadrar." />
        {!fixedAspect ? <ChoiceChips value={aspectKey} onChange={setAspectKey} options={ASPECTS.map((a) => ({ value: a.value, label: a.label }))} /> : null}
        <div
          ref={box}
          className="relative mx-auto mt-4 w-full max-w-md cursor-move touch-none overflow-hidden rounded-xl bg-ink/90"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !box.current) return;
            const rect = box.current.getBoundingClientRect();
            const sx = region.w < 1 ? (2 * (e.clientX - drag.current.x)) / (rect.width * (1 / region.w - 1)) : 0;
            const sy = region.h < 1 ? (2 * (e.clientY - drag.current.y)) / (rect.height * (1 / region.h - 1)) : 0;
            setPan({ x: Math.max(-1, Math.min(1, drag.current.px - sx)), y: Math.max(-1, Math.min(1, drag.current.py - sy)) });
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {natural ? (
            <img
              src={sameOriginImageUrl(src)}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: `${100 / region.w}%`, height: `${100 / region.h}%`, left: `${(-region.x / region.w) * 100}%`, top: `${(-region.y / region.h) * 100}%` }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/70"><Loader2 className="animate-spin" /></div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/80" />
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm font-medium">Zoom</p>
          <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={([v]) => setZoom(v ?? 1)} aria-label="Zoom" />
        </div>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={busy || !natural}>
            {busy ? <Loader2 className="animate-spin" /> : null} Salvar recorte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Thumb({ image, className }: { image?: ImageRef; className?: string }) {
  const src = safeImageUrl(image?.url);
  return src ? <img src={src} alt={image?.alt ?? ""} className={cn("object-cover", className)} /> : <div className={cn("bg-ink/5", className)} />;
}
