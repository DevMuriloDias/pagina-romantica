"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Download, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/builder/CopyButton";
import { Button } from "@/components/ui/button";

/** "🎉 Sua página está pronta!" — link, QR Code e compartilhamento. */
export function SuccessView({ publicUrl, slug, pageId, email, recipientName }: { publicUrl: string; slug: string; pageId: string; email: string; recipientName: string }) {
  const reduced = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced || !canvas.current) return;
    void import("canvas-confetti").then(({ default: confetti }) => {
      const fire = confetti.create(canvas.current!, { resize: true });
      fire({ particleCount: 180, spread: 100, origin: { y: 0.3 }, colors: ["#c2264f", "#f6d9d5", "#c79a4b", "#ffffff"] });
    });
  }, [reduced]);
  const share = `Preparei uma surpresa para você 💌 ${publicUrl}`;
  return (
    <div className="relative" data-testid="success">
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden />
      <motion.div initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg text-center">
        <p className="text-6xl" aria-hidden>🎉</p>
        <h1 className="mt-4 font-display text-4xl">Sua página está pronta!</h1>
        <p className="mt-2 text-ink-soft">Agora é só entregar {recipientName ? `para ${recipientName}` : "a surpresa"}. Também mandamos tudo para <strong>{email || "o seu e-mail"}</strong>.</p>
        <div className="mt-8 space-y-3 rounded-2xl border border-line bg-white p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Link da página</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-cream px-3 py-2 text-sm" data-testid="public-url">{publicUrl}</code>
            <CopyButton text={publicUrl} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink /> Ver minha página</a></Button>
            <Button asChild variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100">
              <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:text-left">
          <img src={`/api/qr/${slug}?format=png`} alt="QR Code da página" className="size-36 rounded-xl ring-1 ring-line" />
          <div className="space-y-2">
            <p className="font-semibold">QR Code para imprimir</p>
            <p className="text-sm text-ink-soft">Coloque num cartão, numa caixa de presente ou atrás de uma foto.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><a href={`/api/qr/${slug}?format=png&download=1`}><Download /> PNG</a></Button>
              <Button asChild size="sm" variant="outline"><a href={`/api/qr/${slug}?format=svg&download=1`}><Download /> SVG</a></Button>
            </div>
          </div>
        </div>
        <Button asChild variant="ghost" className="mt-6"><Link href={`/criar/editor?page=${pageId}`}><Pencil /> Continuar editando</Link></Button>
      </motion.div>
    </div>
  );
}
