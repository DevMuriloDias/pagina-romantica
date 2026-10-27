import "server-only";
import { buildContent, fallbackTexts, type DraftTexts } from "../content/defaults";
import type { Questionnaire } from "../content/questionnaire";
import { log } from "../log";
import { aiEnabled, AiError, completeJson, streamText } from "./client";
import { DRAFT_SYSTEM, draftUserPrompt } from "./prompts/draft";
import {
  captionsPrompt,
  IMPROVE_SYSTEM,
  improvePrompt,
  LETTER_SYSTEM,
  letterPrompt,
  LIST_SYSTEM,
  quizPrompt,
  reasonsPrompt,
  titlePrompt,
  type ImproveMode,
} from "./prompts/text";
import { AiDraftSchema, QuizListSchema, StringListSchema } from "./schemas";

/** Gera o rascunho completo. Nunca lança: em qualquer falha devolve textos padrão (o fluxo não pode travar). */
export async function generateDraftContent(a: Questionnaire) {
  let texts: DraftTexts = fallbackTexts(a);
  let source: "ai" | "fallback" = "fallback";
  let templateId: string | undefined;
  if (aiEnabled()) {
    try {
      const draft = await completeJson(AiDraftSchema, DRAFT_SYSTEM, draftUserPrompt(a), { maxTokens: 12000, effort: "medium" });
      const fb = texts;
      texts = {
        ...draft,
        extraLetters: draft.extraLetters.length ? draft.extraLetters : fb.extraLetters,
        timeline: draft.timeline.length ? draft.timeline : fb.timeline,
        quiz: draft.quiz.length ? draft.quiz : fb.quiz,
      };
      templateId = draft.templateId;
      source = "ai";
    } catch (err) {
      log.warn("ai.draft_fallback", { reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { content: buildContent(a, texts), texts, source, templateId };
}

/** Simula streaming quando a IA está desligada (dev), para a UX ficar idêntica. */
function fakeStream(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const words = text.split(/(\s+)/);
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= words.length) return controller.close();
      controller.enqueue(enc.encode(words.slice(i, i + 4).join("")));
      i += 4;
      await new Promise((r) => setTimeout(r, 25));
    },
  });
}

export function writeLetterStream(o: { tone: string; senderName: string; recipientName: string; context: string; openWhen?: string }) {
  if (!aiEnabled()) {
    const fb = fallbackTexts({ senderName: o.senderName, recipientName: o.recipientName, relationship: "namoro", occasion: "so_porque_sim", startDate: "", howWeMet: "", memories: o.context ? [o.context] : [], lovedThings: "", insideJokes: "", tone: o.tone as Questionnaire["tone"], templateId: "classico" });
    return fakeStream(o.openWhen ? fb.extraLetters[0]!.body : fb.mainLetter.body.split("\n").slice(1).join("\n").trim());
  }
  return streamText(LETTER_SYSTEM, letterPrompt(o), { maxTokens: 4000 });
}

export function improveTextStream(mode: ImproveMode, text: string) {
  if (!aiEnabled()) {
    const t = mode === "curto" ? text.split(/(?<=[.!?])\s+/).slice(0, Math.max(1, Math.ceil(text.split(/(?<=[.!?])\s+/).length / 2))).join(" ") : text;
    return fakeStream(t);
  }
  return streamText(IMPROVE_SYSTEM, improvePrompt(mode, text), { maxTokens: 4000 });
}

const CANNED_REASONS = [
  "O jeito que você ri das minhas piadas sem graça",
  "Porque você faz qualquer lugar parecer casa",
  "O seu abraço, que conserta qualquer dia ruim",
  "Porque você acredita em mim até quando eu duvido",
  "O seu cheiro, que eu reconheço de longe",
  "Os nossos planos bobos e os sérios também",
  "Porque com você o silêncio é confortável",
  "O cuidado que você tem com quem ama",
];

export async function suggestList(kind: "reasons" | "captions" | "titles", o: { tone: string; recipientName: string; occasion: string; context: string; count: number }): Promise<string[]> {
  if (!aiEnabled()) {
    if (kind === "reasons") return CANNED_REASONS.slice(0, o.count);
    if (kind === "captions") return ["Nós dois, do nosso jeito", "Meu lugar favorito: do seu lado", "Um dia para nunca esquecer", "Rindo de tudo, como sempre", "Para guardar no coração", "Eu e você, sempre"].slice(0, o.count);
    return [`Para ${o.recipientName || "você"}, com todo o meu amor`, "Nossa história em uma página", "Tudo o que eu sinto por você", "Um pedacinho do nosso amor", "Porque você merece o mundo"];
  }
  const prompt =
    kind === "reasons" ? reasonsPrompt(o) : kind === "captions" ? captionsPrompt(o) : titlePrompt(o);
  const res = await completeJson(StringListSchema, LIST_SYSTEM, prompt, { maxTokens: 3000 });
  return res.items;
}

export async function suggestQuiz(o: { context: string; count: number; senderName: string }) {
  if (!aiEnabled()) return fallbackTexts({ senderName: o.senderName, recipientName: "", relationship: "namoro", occasion: "so_porque_sim", startDate: "", howWeMet: "", memories: [], lovedThings: "", insideJokes: "", tone: "divertido", templateId: "classico" }).quiz;
  const res = await completeJson(QuizListSchema, LIST_SYSTEM, quizPrompt(o), { maxTokens: 4000 });
  return res.items.filter((q) => q.correctIndex < q.options.length);
}

export { AiError };
