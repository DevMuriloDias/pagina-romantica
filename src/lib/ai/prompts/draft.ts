import type { Questionnaire } from "../../content/questionnaire";
import { OCCASION_LABELS, RELATIONSHIP_LABELS } from "../../content/questionnaire";
import { TEMPLATES } from "../../theme/templates";
import { BASE_RULES, TONE_GUIDE } from "./system";

export const DRAFT_SYSTEM = `${BASE_RULES}

Sua tarefa: criar o primeiro rascunho completo de uma página romântica a partir das respostas de um questionário.
Responda SOMENTE com um objeto JSON válido (sem markdown, sem comentários) neste formato exato:
{
  "title": "título da página (máx. 80 caracteres)",
  "subtitle": "subtítulo (máx. 160 caracteres)",
  "mainLetter": { "title": "título da carta", "body": "carta principal com 3 a 6 parágrafos separados por \\n\\n", "signature": "assinatura, ex.: Com amor, Ana" },
  "extraLetters": [ { "openWhen": "estiver com saudade", "title": "Abra quando estiver com saudade", "body": "carta curta" } ],
  "reasons": ["motivo curto e específico", "..."],
  "photoCaptions": ["legenda curta para foto", "..."],
  "timeline": [ { "title": "título do momento", "description": "1 a 2 frases", "emoji": "✨" } ],
  "quiz": [ { "question": "pergunta sobre o casal", "options": ["a", "b", "c"], "correctIndex": 0 } ],
  "finalePhrase": "frase final marcante (máx. 160 caracteres)",
  "templateId": "um de: ${TEMPLATES.map((t) => t.id).join(", ")}"
}
Quantidades: extraLetters 2 a 3 (cartas "abra quando..."), reasons 8 a 15, photoCaptions 4 a 6, timeline 3 a 6 (baseada nas lembranças), quiz 3 a 5 perguntas com 3 opções cada.`;

export function draftUserPrompt(a: Questionnaire): string {
  return `Crie o rascunho da página com tom ${TONE_GUIDE[a.tone] ?? TONE_GUIDE.romantico}.
<dados>
Quem escreve: ${a.senderName || "(não informado)"}
Para quem: ${a.recipientName || "(não informado)"}
Relação: ${RELATIONSHIP_LABELS[a.relationship]}
Ocasião: ${OCCASION_LABELS[a.occasion]}
Data em que se conheceram/começaram: ${a.startDate || "(não informada)"}
Como se conheceram: ${a.howWeMet || "(não informado)"}
Lembranças marcantes:
${a.memories.filter(Boolean).map((m, i) => `${i + 1}. ${m}`).join("\n") || "(nenhuma)"}
O que mais ama na pessoa: ${a.lovedThings || "(não informado)"}
Piadas internas / apelidos: ${a.insideJokes || "(nenhum)"}
Estilo visual preferido: ${a.templateId}
</dados>`;
}
