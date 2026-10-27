import { createSection } from "../sections/registry";
import { uid } from "../utils";
import type { Questionnaire } from "./questionnaire";
import { CONTENT_SCHEMA_VERSION, ContentSchema, type PageContent, type Section } from "./schema";

/** Rascunho gerado pela IA (validado em src/lib/ai/schemas.ts). */
export interface DraftTexts {
  title: string;
  subtitle: string;
  mainLetter: { title: string; body: string; signature: string };
  extraLetters: { openWhen: string; title: string; body: string }[];
  reasons: string[];
  photoCaptions: string[];
  timeline: { title: string; description: string; emoji: string }[];
  quiz: { question: string; options: string[]; correctIndex: number }[];
  finalePhrase: string;
}

function nameOr(name: string, fallback: string) {
  return name.trim() || fallback;
}

/**
 * Textos padrão de boa qualidade — usados quando a IA está desligada ou falha.
 * O fluxo nunca pode travar: esta função é síncrona e não depende de serviços externos.
 */
export function fallbackTexts(a: Questionnaire): DraftTexts {
  const to = nameOr(a.recipientName, "meu amor");
  const from = nameOr(a.senderName, "Eu");
  const funny = a.tone === "divertido";
  const loved = a.lovedThings
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const memoryLines = a.memories.filter(Boolean).map((m) => `Lembra quando ${m.replace(/^lembra quando\s*/i, "")}? Eu lembro de cada detalhe.`);

  const body = [
    `${to},`,
    "",
    funny
      ? "Eu tentei escrever algo sério, juro. Mas toda vez que penso em você eu acabo sorrindo igual bobo(a) — então vai assim mesmo."
      : "Existem pessoas que chegam devagar e, quando a gente percebe, já são casa. Você é isso para mim.",
    a.howWeMet ? `\nDesde o dia em que ${a.howWeMet.replace(/^(a gente|nós)\s*/i, "a gente ")}, a minha vida ganhou outra cor.` : "",
    memoryLines.length ? `\n${memoryLines.join(" ")}` : "",
    loved.length ? `\nAmo ${loved.slice(0, 3).join(", ")} — e amo ainda mais o jeito que você faz tudo isso parecer simples.` : "",
    "",
    "Obrigado(a) por cada dia, por cada risada e por ser exatamente quem você é.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const reasons = [
    ...loved.map((l) => (l.length > 3 ? l.charAt(0).toUpperCase() + l.slice(1) : l)),
    "O seu sorriso, que muda o meu dia",
    "O jeito que você me olha",
    "Porque com você tudo fica mais leve",
    "Os nossos silêncios confortáveis",
    "Porque você acredita em mim",
    "O seu abraço, o meu lugar favorito",
    "Porque você me faz querer ser melhor",
  ].slice(0, 12);

  return {
    title: a.occasion === "aniversario" ? `Feliz aniversário, ${to}!` : `Para ${to}, com todo o meu amor`,
    subtitle: funny ? "Prepare o coração (e o lencinho, vai que...)" : "Cada pedacinho desta página foi pensado em você",
    mainLetter: { title: "Uma carta para você", body, signature: `Com amor, ${from}` },
    extraLetters: [
      { openWhen: "estiver com saudade", title: "Abra quando estiver com saudade", body: "Feche os olhos e lembra do nosso último abraço. Eu estou aí, pertinho, sempre. Logo, logo a gente se vê. 💕" },
      { openWhen: "precisar rir", title: "Abra quando precisar rir", body: a.insideJokes ? `Só uma palavra: ${a.insideJokes.split(/[\n,;]+/)[0]?.trim()}. Pronto, já está rindo, né? 😂` : "Lembra daquela vez que a gente riu até a barriga doer? Então. Eu ainda rio sozinho(a) lembrando. 😂" },
    ],
    reasons,
    photoCaptions: ["Um dos meus momentos favoritos", "Nós dois, do jeitinho que eu amo", "Para guardar para sempre"],
    timeline: [
      { title: "O dia em que nos conhecemos", description: a.howWeMet || "O começo de tudo.", emoji: "✨" },
      ...a.memories.filter(Boolean).map((m) => ({ title: "Uma lembrança marcante", description: m, emoji: "💞" })),
    ].slice(0, 6),
    quiz: [
      { question: "Onde foi o nosso primeiro encontro?", options: ["No lugar de sempre", "Num lugar inesquecível", "Não lembro 🙈"], correctIndex: 1 },
      { question: "Qual é o meu jeito favorito de passar o domingo?", options: ["Com você", "Com você, claro", "Adivinha: com você"], correctIndex: 0 },
    ],
    finalePhrase: funny ? "Te amo mais que pizza. E olha que eu amo muito pizza. 🍕" : "Hoje, amanhã e em todos os dias que vierem: é você.",
  };
}

/** Monta o conteúdo completo da página a partir do questionário e dos textos (IA ou padrão). */
export function buildContent(a: Questionnaire, texts: DraftTexts = fallbackTexts(a)): PageContent {
  const sections: Section[] = [];
  const isProposal = a.relationship === "pedido_namoro" || a.relationship === "pedido_casamento" || a.occasion === "pedido";

  sections.push(createSection("hero", { title: texts.title, subtitle: texts.subtitle }));

  if (a.startDate) {
    sections.push(createSection("counter", { startDate: `${a.startDate}T00:00`, title: "Juntos há" }));
  }

  sections.push(
    createSection("letters", {
      title: "Cartinhas para você",
      letters: [
        {
          id: uid("l"),
          kind: "normal",
          openWhen: "",
          title: texts.mainLetter.title,
          body: texts.mainLetter.body,
          signature: texts.mainLetter.signature,
          paper: "lined",
          font: "dancing",
          lockedUntil: "",
        },
        ...texts.extraLetters.slice(0, 2).map((l) => ({
          id: uid("l"),
          kind: "open_when" as const,
          openWhen: l.openWhen,
          title: l.title,
          body: l.body,
          signature: texts.mainLetter.signature,
          paper: "kraft" as const,
          font: "caveat" as const,
          lockedUntil: "",
        })),
      ],
    }),
  );

  sections.push(createSection("photos", { title: "Nossos momentos", layout: "polaroid", photos: [] }));

  if (texts.timeline.length) {
    sections.push(
      createSection("timeline", {
        events: texts.timeline.map((e, i) => ({
          id: uid("t"),
          date: i === 0 ? a.startDate : "",
          title: e.title,
          description: e.description,
          emoji: e.emoji,
        })),
      }),
    );
  }

  sections.push(createSection("reasons", { reasons: texts.reasons }));

  if (isProposal) {
    const casamento = a.relationship === "pedido_casamento";
    sections.push(
      createSection("proposal", {
        kind: casamento ? "casamento" : "namoro",
        question: casamento ? `${nameOr(a.recipientName, "Meu amor")}, quer casar comigo?` : `${nameOr(a.recipientName, "Meu amor")}, quer namorar comigo?`,
      }),
    );
  }

  sections.push(createSection("finale", { phrase: texts.finalePhrase, signature: nameOr(a.senderName, "") }));

  return ContentSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    meta: {
      senderName: a.senderName,
      recipientName: a.recipientName,
      relationship: a.relationship,
      occasion: a.occasion,
      tone: a.tone,
      startDate: a.startDate,
    },
    gate: {
      mode: "none",
      buttonLabel: "Abrir 💌",
      welcomeText: `${nameOr(a.recipientName, "Oi")}, preparei uma surpresa para você`,
      errorMessage: "Hmm, não foi dessa vez... tenta de novo, amor 💕",
    },
    music: {},
    settings: { notifyOnOpen: true },
    sections,
  });
}

/** Conteúdo mínimo para um rascunho recém-criado (antes do questionário). */
export function emptyContent(): PageContent {
  return buildContent(
    {
      senderName: "",
      recipientName: "",
      relationship: "namoro",
      occasion: "so_porque_sim",
      startDate: "",
      howWeMet: "",
      memories: [],
      lovedThings: "",
      insideJokes: "",
      tone: "romantico",
      templateId: "classico",
    },
  );
}
