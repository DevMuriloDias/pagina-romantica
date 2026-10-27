"use client";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { EffectType } from "@/lib/theme/schema";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
}

const GLYPH: Partial<Record<EffectType, string>> = { hearts: "♥", petals: "❀", stars: "✦", snow: "❄" };

/** Efeitos de fundo em canvas (leve). Desligado com prefers-reduced-motion. */
export function Effects({ type, intensity, colors, contained }: { type: EffectType; intensity: number; colors: string[]; contained?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (type === "none" || reduced) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const max = Math.round(6 + intensity * 5);
    const rising = type === "bubbles";
    const pick = () => colors[Math.floor(Math.random() * colors.length)] ?? "#ff4d6d";
    const spawn = (initial = false): Particle => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : rising ? h + 20 : -20,
      vx: (Math.random() - 0.5) * (type === "confetti" ? 1.6 : 0.5),
      vy: (rising ? -1 : 1) * (0.3 + Math.random() * (type === "snow" ? 0.7 : 1.1)),
      size: type === "particles" ? 1 + Math.random() * 2.5 : 8 + Math.random() * 12,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.04,
      color: type === "snow" ? "#ffffff" : pick(),
      life: Math.random() * 1000,
    });
    const parts: Particle[] = Array.from({ length: max }, () => spawn(true));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        p.life += 1;
        p.x += p.vx + Math.sin(p.life / 40) * 0.3;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 30 || p.y < -40) parts[i] = spawn();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = type === "stars" ? 0.4 + 0.6 * Math.abs(Math.sin(p.life / 30)) : 0.75;
        ctx.fillStyle = p.color;
        if (type === "bubbles") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 1.6, 0, Math.PI * 2);
          ctx.stroke();
        } else if (type === "confetti") {
          ctx.fillRect(-p.size / 4, -p.size / 2, p.size / 2, p.size);
        } else if (type === "particles") {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(GLYPH[type] ?? "♥", 0, 0);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [type, intensity, colors, reduced]);

  if (type === "none" || reduced) return null;
  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${contained ? "absolute" : "fixed"} inset-0 z-[1] h-full w-full`} />;
}
