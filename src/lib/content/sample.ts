import { CONTENT_SCHEMA_VERSION, ContentSchema, type PageContent } from "./schema";

/** Conteúdo de demonstração (landing e galeria de templates). */
export function sampleContent(): PageContent {
  return ContentSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    meta: { senderName: "Lucas", recipientName: "Marina", relationship: "namoro", occasion: "aniversario", tone: "romantico", startDate: "2021-06-12" },
    gate: { mode: "none" },
    music: {},
    settings: {},
    sections: [
      { id: "d-hero", type: "hero", data: { title: "Feliz aniversário, Marina!", subtitle: "Cada pedacinho desta página foi pensado em você", layout: "centered" } },
      { id: "d-counter", type: "counter", data: { title: "Juntos há", startDate: "2021-06-12T20:00", style: "flip" } },
      {
        id: "d-letters",
        type: "letters",
        data: {
          title: "Cartinhas para você",
          letters: [
            { id: "l1", title: "Uma carta para você", body: "Marina,\n\nLembra da chuva no dia do nosso primeiro encontro? Eu lembro de cada gota.", signature: "Com amor, Lucas" },
            { id: "l2", kind: "open_when", openWhen: "estiver com saudade", title: "Abra quando estiver com saudade", body: "Fecha os olhos. Tô aí. 💕", paper: "kraft", font: "caveat" },
          ],
        },
      },
      { id: "d-reasons", type: "reasons", data: { title: "Motivos pelos quais te amo", layout: "flip", reasons: ["Seu sorriso de manhã", "Seu cafuné", "Sua risada alta", "Você acredita em mim", "Nossas viagens", "Seu cheiro"] } },
      { id: "d-finale", type: "finale", data: { phrase: "Hoje, amanhã e sempre: é você.", signature: "Lucas" } },
    ],
  });
}
