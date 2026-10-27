import { describe, expect, it } from "vitest";
import { buildContent, emptyContent, fallbackTexts } from "@/lib/content/defaults";
import { migrateContent, safeMigrateContent } from "@/lib/content/migrations";
import { QuestionnaireSchema } from "@/lib/content/questionnaire";
import { CONTENT_SCHEMA_VERSION, ContentSchema, SECTION_TYPES } from "@/lib/content/schema";
import { createSection, sectionRegistry } from "@/lib/sections/registry";

const answers = QuestionnaireSchema.parse({
  senderName: "Ana",
  recipientName: "João",
  relationship: "pedido_casamento",
  occasion: "pedido",
  startDate: "2020-02-14",
  howWeMet: "na faculdade",
  memories: ["a viagem para Ouro Preto"],
  lovedThings: "o sorriso, a calma",
  tone: "divertido",
});

describe("conteúdo da página", () => {
  it("monta conteúdo válido a partir do questionário (sem IA)", () => {
    const c = buildContent(answers);
    expect(c.schemaVersion).toBe(CONTENT_SCHEMA_VERSION);
    expect(ContentSchema.safeParse(c).success).toBe(true);
    const types = c.sections.map((s) => s.type);
    expect(types[0]).toBe("hero");
    expect(types).toContain("counter");
    expect(types).toContain("proposal");
    expect(types.at(-1)).toBe("finale");
  });

  it("textos padrão usam os dados do questionário", () => {
    const t = fallbackTexts(answers);
    expect(t.title).toContain("João");
    expect(t.mainLetter.signature).toContain("Ana");
    expect(t.reasons.some((r) => r.toLowerCase().includes("sorriso"))).toBe(true);
  });

  it("rascunho vazio é válido", () => {
    expect(ContentSchema.safeParse(emptyContent()).success).toBe(true);
  });

  it("todas as seções do registro têm padrões válidos", () => {
    for (const type of SECTION_TYPES) {
      const s = createSection(type);
      expect(s.type).toBe(type);
      expect(sectionRegistry[type].maxInstances).toBeGreaterThan(0);
    }
  });

  it("migra conteúdo legado (v0) para a versão atual", () => {
    const legacy = { title: "Oi amor", subtitle: "sub", meta: { senderName: "A", recipientName: "B" }, blocks: [{ id: "f1", type: "finale", data: { phrase: "fim" } }] };
    const c = migrateContent(legacy);
    expect(c.schemaVersion).toBe(CONTENT_SCHEMA_VERSION);
    expect(c.sections[0]).toMatchObject({ type: "hero", data: { title: "Oi amor" } });
    expect(c.sections[1]).toMatchObject({ type: "finale" });
  });

  it("rejeita versões futuras e conteúdo inválido", () => {
    expect(() => migrateContent({ schemaVersion: 999 })).toThrow();
    expect(safeMigrateContent({ schemaVersion: 1, sections: [{ type: "desconhecido" }] })).toBeNull();
  });

  it("limita tamanho de textos (proteção contra abuso)", () => {
    const c = emptyContent();
    const bad = { ...c, sections: [{ ...c.sections[0]!, data: { title: "x".repeat(5000), subtitle: "", layout: "centered" } }] };
    expect(ContentSchema.safeParse(bad).success).toBe(false);
  });
});
