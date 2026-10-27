import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/client";
import { moderateInput } from "@/lib/ai/moderation";
import { AiDraftSchema } from "@/lib/ai/schemas";
import { emptyContent } from "@/lib/content/defaults";
import { reviewChecklist } from "@/lib/review";
import { sanitizeDeep } from "@/lib/sanitize";
import { altAz, projectSky, skyInstant } from "@/lib/sky";
import { publicSlug, slugify, validateCustomSlug } from "@/lib/slug";
import { contrastLevel, contrastRatio, normalizeHex } from "@/lib/theme/color";
import { parseTheme } from "@/lib/theme";
import { TEMPLATES } from "@/lib/theme/templates";
import { elapsedBetween, parseLocalDateTime, remainingUntil } from "@/lib/time";

describe("tempo", () => {
  it("diferença de calendário", () => {
    const e = elapsedBetween(parseLocalDateTime("2020-01-31T10:00")!, parseLocalDateTime("2021-03-01T12:30")!);
    expect(e).toMatchObject({ years: 1, months: 1, days: 1, hours: 2, minutes: 30 });
    expect(elapsedBetween(parseLocalDateTime("2021-06-12")!, parseLocalDateTime("2026-06-12")!)).toMatchObject({ years: 5, months: 0, days: 0 });
    expect(elapsedBetween(parseLocalDateTime("2024-02-29")!, parseLocalDateTime("2025-02-28")!)).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(elapsedBetween(parseLocalDateTime("2026-01-10T23:59")!, parseLocalDateTime("2026-01-11T00:01")!)).toMatchObject({ days: 0, hours: 0, minutes: 2 });
  });
  it("contagem regressiva", () => {
    const now = new Date("2026-01-01T00:00:00-03:00");
    expect(remainingUntil(new Date("2026-01-02T01:01:01-03:00"), now)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1, done: false });
    expect(remainingUntil(new Date("2025-01-01"), now).done).toBe(true);
  });
});

describe("slug", () => {
  it("público é legível + sufixo aleatório", () => {
    const s = publicSlug("João", "Maria");
    expect(s).toMatch(/^joao-e-maria-[a-z2-9]{8}$/);
    expect(publicSlug("João", "Maria")).not.toBe(s);
  });
  it("personalizado valida reservados e tamanho", () => {
    expect(validateCustomSlug("João & Maria")).toEqual({ ok: true, slug: "joao-e-maria" });
    expect(validateCustomSlug("adm").ok).toBe(false);
    expect(validateCustomSlug("admin").ok).toBe(false);
    expect(slugify("  Ação!!  ")).toBe("acao");
  });
});

describe("cores e tema", () => {
  it("contraste WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastLevel("#777777", "#ffffff")).toBe("AA-large");
    expect(contrastLevel("#eeeeee", "#ffffff")).toBe("fail");
    expect(normalizeHex("F0a")).toBe("#ff00aa");
    expect(normalizeHex("zzz")).toBeNull();
  });
  it("todos os templates são temas válidos e têm texto legível", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(8);
    for (const t of TEMPLATES) {
      expect(parseTheme(t.theme)).toEqual(t.theme);
      expect(contrastRatio(t.theme.colors.text, t.theme.colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("tema corrompido cai para o padrão sem quebrar", () => {
    expect(parseTheme({ colors: { primary: "vermelho" } }).templateId).toBe("classico");
    expect(parseTheme(null).templateId).toBe("classico");
  });
});

describe("céu estrelado", () => {
  it("Polaris fica na altura da latitude (hemisfério norte)", () => {
    const { alt } = altAz(2.53, 89.264, 40, 123);
    expect(alt).toBeGreaterThan(38);
    expect(alt).toBeLessThan(42);
  });
  it("projeta estrelas visíveis dentro do círculo", () => {
    const sky = projectSky(skyInstant("2021-06-12", "21:00", -46.63), -23.55, -46.63, 500);
    expect(sky.stars.length).toBeGreaterThan(20);
    for (const s of sky.stars) expect((s.x - 250) ** 2 + (s.y - 250) ** 2).toBeLessThanOrEqual(250 ** 2);
    // Em junho, às 21h em São Paulo, o Cruzeiro do Sul está alto no céu
    expect(sky.stars.some((s) => s.name === "Acrux")).toBe(true);
  });
});

describe("IA e moderação", () => {
  it("extrai JSON mesmo com cerca de código", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Aqui: {"b":2} fim')).toEqual({ b: 2 });
    expect(() => extractJson("sem json")).toThrow();
  });
  it("schema do rascunho filtra quiz inconsistente", () => {
    const d = AiDraftSchema.parse({
      title: "t", subtitle: "s", mainLetter: { title: "c", body: "b", signature: "x" }, reasons: ["r"], finalePhrase: "f",
      quiz: [{ question: "q", options: ["a", "b"], correctIndex: 3 }, { question: "q2", options: ["a", "b"], correctIndex: 1 }],
    });
    expect(d.quiz).toHaveLength(1);
  });
  it("moderação bloqueia conteúdo explícito e ofensivo sem falso positivo", () => {
    expect(moderateInput("quero algo pornô").ok).toBe(false);
    expect(moderateInput("sua vagabunda").ok).toBe(false);
    expect(moderateInput("ela trabalha com computação e ama pelada de futebol").ok).toBe(true);
  });
});

describe("segurança e revisão", () => {
  it("remove caracteres de controle", () => {
    expect(sanitizeDeep({ a: "oi\u0000‮tudo\nbem", b: ["x\u0007"] })).toEqual({ a: "oitudo\nbem", b: ["x"] });
  });
  it("checklist avisa quando faltam fotos e nome", () => {
    const items = reviewChecklist(emptyContent());
    expect(items.some((i) => i.text.includes("fotos"))).toBe(true);
    expect(items.some((i) => i.text.includes("nome"))).toBe(true);
  });
});
