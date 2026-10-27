/**
 * Remove caracteres de controle (exceto \n e \t) de todas as strings de um objeto.
 * O conteúdo é sempre renderizado como texto (sem HTML livre), então isto é defesa em profundidade.
 */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‮‭]/g;

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return value.replace(CONTROL, "") as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out as T;
  }
  return value;
}
