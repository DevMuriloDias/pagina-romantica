import { BASE_RULES, TONE_GUIDE } from "./system";

export const LETTER_SYSTEM = `${BASE_RULES}

Sua tarefa: escrever UMA carta de amor. Responda apenas com o texto da carta (sem título, sem assinatura, sem aspas, sem markdown), em 3 a 6 parágrafos separados por linha em branco.`;

export function letterPrompt(o: { tone: string; senderName: string; recipientName: string; context: string; openWhen?: string }) {
  return `Escreva uma carta com tom ${TONE_GUIDE[o.tone] ?? TONE_GUIDE.romantico}${o.openWhen ? `, do tipo "Abra quando ${o.openWhen}"` : ""}.
<dados>
De: ${o.senderName || "(não informado)"}
Para: ${o.recipientName || "(não informado)"}
Contexto e lembranças: ${o.context || "(sem detalhes)"}
</dados>`;
}

export const IMPROVE_MODES = {
  romantico: "deixe o texto mais romântico e carinhoso",
  divertido: "deixe o texto mais divertido e leve, sem perder o carinho",
  curto: "deixe o texto mais curto e direto (no máximo metade do tamanho), mantendo o essencial",
  poetico: "deixe o texto mais poético, com imagens e ritmo",
  corrigir: "corrija ortografia, gramática e pontuação sem mudar o estilo nem o conteúdo",
} as const;
export type ImproveMode = keyof typeof IMPROVE_MODES;

export const IMPROVE_SYSTEM = `${BASE_RULES}

Sua tarefa: reescrever o texto do usuário seguindo a instrução. Preserve nomes, fatos, apelidos e a voz de quem escreveu.
Responda apenas com o texto reescrito (sem comentários, sem aspas, sem markdown).`;

export function improvePrompt(mode: ImproveMode, text: string) {
  return `Instrução: ${IMPROVE_MODES[mode]}.
<dados>
${text}
</dados>`;
}

export const LIST_SYSTEM = `${BASE_RULES}

Responda SOMENTE com JSON válido no formato pedido, sem markdown.`;

export function reasonsPrompt(o: { tone: string; recipientName: string; context: string; count: number }) {
  return `Sugira ${o.count} motivos curtos (máx. 90 caracteres cada) pelos quais a pessoa ama ${o.recipientName || "seu amor"}, com tom ${TONE_GUIDE[o.tone] ?? TONE_GUIDE.romantico}. Seja específico usando o contexto.
Formato: {"items": ["..."]}
<dados>${o.context || "(sem detalhes)"}</dados>`;
}

export function captionsPrompt(o: { tone: string; count: number; context: string }) {
  return `Sugira ${o.count} legendas curtas (máx. 60 caracteres) para fotos de casal, com tom ${TONE_GUIDE[o.tone] ?? TONE_GUIDE.romantico}.
Formato: {"items": ["..."]}
<dados>${o.context || "(sem detalhes)"}</dados>`;
}

export function quizPrompt(o: { context: string; count: number; senderName: string }) {
  return `Crie ${o.count} perguntas de múltipla escolha divertidas sobre o relacionamento para o destinatário responder sobre ${o.senderName || "quem criou a página"}. Use o contexto; se faltar informação, crie perguntas leves e genéricas.
Formato: {"items": [{"question": "...", "options": ["a", "b", "c"], "correctIndex": 0}]}
<dados>${o.context || "(sem detalhes)"}</dados>`;
}

export function titlePrompt(o: { tone: string; recipientName: string; occasion: string; context: string }) {
  return `Sugira 5 títulos curtos (máx. 60 caracteres) para a página, com tom ${TONE_GUIDE[o.tone] ?? TONE_GUIDE.romantico}. Ocasião: ${o.occasion}. Para: ${o.recipientName || "(não informado)"}.
Formato: {"items": ["..."]}
<dados>${o.context || "(sem detalhes)"}</dados>`;
}
