import { BRAND } from "@/config";

const brl = new Intl.NumberFormat(BRAND.locale, { style: "currency", currency: BRAND.currency });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  const d = typeof date === "string" ? parseDateInput(date) : date;
  if (!d || Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(BRAND.locale, { timeZone: BRAND.timeZone, ...opts }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, { dateStyle: "short", timeStyle: "short" });
}

/**
 * Datas "de calendário" (AAAA-MM-DD) são interpretadas ao meio-dia de São Paulo
 * para nunca "voltarem um dia" por causa do fuso.
 */
export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00-03:00`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
