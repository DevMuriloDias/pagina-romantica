/**
 * Normaliza respostas da tela de entrada: minúsculas, sem acentos, sem pontuação
 * e com espaços colapsados. "12/06/2020" ≡ "12062020"; "  Praia  do Forte! " ≡ "praia do forte".
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Para senha numérica (data), espaços também são irrelevantes. */
export function normalizePassword(input: string): string {
  return normalizeAnswer(input).replace(/\s/g, "");
}
