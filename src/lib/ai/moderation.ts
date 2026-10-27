/**
 * Moderação básica de entrada (antes de chamar a IA). O prompt de sistema também instrui a recusa.
 * Lista propositalmente conservadora: bloqueia termos explícitos e menções a menores em contexto sexual.
 */
const EXPLICIT = [
  "porn", "pornô", "porno", "sexo explícito", "sexo oral", "nude", "nudes", "transar", "foder", "buceta", "pau duro", "xoxota", "punheta", "boquete", "orgasmo",
];
const MINORS = ["criança", "crianca", "menor de idade", "menininha", "menininho", "anos de idade", "infantil", "adolescente", "novinha", "novinho"];
const OFFENSIVE = ["vagabunda", "puta", "viado", "macaco", "retardad", "estupr"];

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type ModerationResult = { ok: true } | { ok: false; reason: string };

export function moderateInput(...texts: string[]): ModerationResult {
  const t = norm(texts.join(" \n "));
  // casa no início de palavra (evita falsos positivos como "computador" contendo "puta")
  const has = (list: string[]) => list.some((w) => new RegExp(`(^|[^a-z0-9])${norm(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));
  const explicit = has(EXPLICIT);
  if (explicit && has(MINORS)) return { ok: false, reason: "Conteúdo não permitido." };
  if (explicit) return { ok: false, reason: "Não geramos conteúdo sexual explícito. Que tal o tom “picante leve”? 😉" };
  if (has(OFFENSIVE)) return { ok: false, reason: "Encontramos termos ofensivos no texto. Pode reformular?" };
  return { ok: true };
}
