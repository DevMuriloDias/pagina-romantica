import { beforeEach, describe, expect, it } from "vitest";
import { emptyContent } from "@/lib/content/defaults";
import { DEFAULT_TEMPLATE, TEMPLATES } from "@/lib/theme/templates";
import { useBuilder } from "@/stores/builder";

describe("store do editor (desfazer/refazer)", () => {
  beforeEach(() => useBuilder.getState().init({ pageId: "p1", status: "DRAFT", content: emptyContent(), theme: DEFAULT_TEMPLATE.theme }));

  it("desfaz e refaz alterações", () => {
    const s = useBuilder.getState();
    const before = s.content.sections.length;
    s.addSection("quiz");
    expect(useBuilder.getState().content.sections.length).toBe(before + 1);
    useBuilder.getState().undo();
    expect(useBuilder.getState().content.sections.length).toBe(before);
    useBuilder.getState().redo();
    expect(useBuilder.getState().content.sections.length).toBe(before + 1);
  });

  it("digitação rápida no mesmo campo vira um único passo", () => {
    const set = useBuilder.getState().setContent;
    set((c) => ({ ...c, meta: { ...c.meta, recipientName: "M" } }), "nome");
    set((c) => ({ ...c, meta: { ...c.meta, recipientName: "Ma" } }), "nome");
    set((c) => ({ ...c, meta: { ...c.meta, recipientName: "Mar" } }), "nome");
    expect(useBuilder.getState().past).toHaveLength(1);
    useBuilder.getState().undo();
    expect(useBuilder.getState().content.meta.recipientName).toBe("");
  });

  it("trocar de template não apaga o conteúdo", () => {
    const content = useBuilder.getState().content;
    useBuilder.getState().applyTemplate(TEMPLATES[3]!.theme);
    expect(useBuilder.getState().content).toBe(content);
    expect(useBuilder.getState().theme.templateId).toBe(TEMPLATES[3]!.id);
  });

  it("respeita o limite de instâncias por módulo", () => {
    expect(useBuilder.getState().addSection("hero")).toBeNull();
  });
});
