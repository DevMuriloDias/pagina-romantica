/** Cálculos de tempo para contadores (puros e testáveis). */

export interface Elapsed {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalDays: number;
}

/** Interpreta "AAAA-MM-DDTHH:mm" (ou "AAAA-MM-DD") no fuso de São Paulo (UTC-3, sem horário de verão desde 2019). */
export function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonthsClamped(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}

/**
 * Diferença de calendário (anos, meses, dias...) entre duas datas.
 * Ex.: 31/01 → 01/03 = 1 mês e 1 dia (o "dia 31 de fevereiro" vira o último dia do mês).
 */
export function elapsedBetween(from: Date, to: Date): Elapsed {
  const [a, b] = to >= from ? [from, to] : [to, from];
  // Trabalha em "horário de São Paulo" deslocando para UTC-3.
  const shift = (d: Date) => new Date(d.getTime() - 3 * 3600_000);
  const A = shift(a);
  const B = shift(b);
  let total = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
  let anchor = addMonthsClamped(A, total);
  if (anchor > B) {
    total -= 1;
    anchor = addMonthsClamped(A, total);
  }
  const rest = Math.floor((B.getTime() - anchor.getTime()) / 1000);
  return {
    years: Math.floor(total / 12),
    months: total % 12,
    days: Math.floor(rest / 86400),
    hours: Math.floor((rest % 86400) / 3600),
    minutes: Math.floor((rest % 3600) / 60),
    seconds: rest % 60,
    totalDays: Math.floor((b.getTime() - a.getTime()) / 86_400_000),
  };
}

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function remainingUntil(target: Date, now: Date): Remaining {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, done: false };
}
