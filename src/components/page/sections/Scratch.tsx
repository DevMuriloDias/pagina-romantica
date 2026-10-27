"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Img } from "../Img";
import { SafeText } from "../SafeText";
import { SectionShell, SectionTitle } from "../SectionShell";
import type { SectionProps } from "../types";

/** Raspadinha em canvas: o destinatário "raspa" com o dedo ou mouse. */
export function Scratch({ section, theme }: SectionProps<"scratch">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const d = section.data;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = box.clientWidth * ratio;
    canvas.height = box.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const g = ctx.createLinearGradient(0, 0, box.clientWidth, box.clientHeight);
    g.addColorStop(0, "#c9c9c9");
    g.addColorStop(0.5, "#eeeeee");
    g.addColorStop(1, "#b5b5b5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, box.clientWidth, box.clientHeight);
    ctx.fillStyle = "#7a7a7a";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.instructions || "Raspe aqui", box.clientWidth / 2, box.clientHeight / 2);
    ctx.globalCompositeOperation = "destination-out";
  }, [d.instructions]);

  useEffect(() => {
    paint();
    setRevealed(false);
  }, [paint, d.hiddenText, d.hiddenType]);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkProgress = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    for (let i = 3; i < data.length; i += 64) if (data[i] === 0) clear++;
    if (clear / (data.length / 64) > 0.55) setRevealed(true);
  };

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Raspadinha">
      <SectionTitle eyebrow="surpresa">{d.title}</SectionTitle>
      <div ref={boxRef} className="love-card relative mx-auto aspect-[4/3] w-full max-w-md select-none overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          {d.hiddenType === "image" && d.hiddenImage ? (
            <Img image={d.hiddenImage} className="absolute inset-0 h-full w-full" alt={d.hiddenImage.alt || "Imagem surpresa"} />
          ) : (
            <p className="text-2xl font-semibold text-[var(--c-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
              <SafeText text={d.hiddenText} />
            </p>
          )}
        </div>
        <canvas
          ref={canvasRef}
          aria-label={d.instructions || "Raspe para revelar"}
          role="img"
          className="absolute inset-0 h-full w-full touch-none transition-opacity duration-700"
          style={{ opacity: revealed ? 0 : 1, pointerEvents: revealed ? "none" : "auto" }}
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => drawing.current && scratchAt(e.clientX, e.clientY)}
          onPointerUp={() => {
            drawing.current = false;
            checkProgress();
          }}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setRevealed(true)}
          tabIndex={0}
        />
      </div>
      {!revealed ? (
        <p className="mt-3 text-center text-xs opacity-60">
          Sem conseguir raspar? <button type="button" className="underline" onClick={() => setRevealed(true)}>Revelar</button>
        </p>
      ) : null}
    </SectionShell>
  );
}
