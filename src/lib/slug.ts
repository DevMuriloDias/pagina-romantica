const RESERVED = new Set(["admin", "api", "p", "criar", "editar", "minhas-paginas", "checkout", "termos", "privacidade", "login", "www", "app"]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // sem 0/o/1/l para evitar confusão

export function randomSuffix(length = 8, rand: (n: number) => number = cryptoRandomInt): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[rand(ALPHABET.length)];
  return out;
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! % max;
}

/** Slug público não adivinhável: "ana-e-joao-k7m2x9qa". */
export function publicSlug(sender: string, recipient: string): string {
  const base = slugify([sender, recipient].filter(Boolean).join(" e ")) || "surpresa";
  return `${base}-${randomSuffix(8)}`;
}

export type CustomSlugCheck = { ok: true; slug: string } | { ok: false; reason: string };

export function validateCustomSlug(input: string): CustomSlugCheck {
  const slug = slugify(input);
  if (slug.length < 4) return { ok: false, reason: "Use pelo menos 4 letras ou números." };
  if (RESERVED.has(slug)) return { ok: false, reason: "Este endereço é reservado." };
  return { ok: true, slug };
}
