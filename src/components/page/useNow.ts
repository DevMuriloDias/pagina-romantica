"use client";
import { useEffect, useState } from "react";

/** Relógio que atualiza a cada `interval` ms (inicia null no SSR para evitar mismatch de hidratação). */
export function useNow(interval = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
