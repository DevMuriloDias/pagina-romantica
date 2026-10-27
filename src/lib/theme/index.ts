import { ThemeSchema, type Theme } from "./schema";
import { DEFAULT_TEMPLATE } from "./templates";

/** Lê o tema salvo; campos inválidos ou ausentes caem para os valores do template padrão. */
export function parseTheme(raw: unknown): Theme {
  const parsed = ThemeSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const merged = deepMerge(DEFAULT_TEMPLATE.theme, (raw ?? {}) as Record<string, unknown>);
  const second = ThemeSchema.safeParse(merged);
  return second.success ? second.data : DEFAULT_TEMPLATE.theme;
}

function deepMerge<T>(base: T, patch: Record<string, unknown>): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (patch as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v)
      ? deepMerge(b, v as Record<string, unknown>)
      : v;
  }
  return out as T;
}

export * from "./schema";
export * from "./templates";
export * from "./css";
export * from "./color";
export * from "./fonts";
