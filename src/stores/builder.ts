"use client";
import { create } from "zustand";
import type { PageContent, Section, SectionData, SectionType } from "@/lib/content/schema";
import { createSection, sectionRegistry } from "@/lib/sections/registry";
import type { Theme } from "@/lib/theme/schema";

interface Snapshot {
  content: PageContent;
  theme: Theme;
}

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface BuilderState {
  pageId: string;
  status: string;
  content: PageContent;
  theme: Theme;
  templateDefault: Theme | null;
  past: Snapshot[];
  future: Snapshot[];
  lastKey: string | null;
  lastAt: number;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: number | null;
  version: number;
  savedVersion: number;
  selectedId: string | null;

  init: (d: { pageId: string; status: string; content: PageContent; theme: Theme; templateDefault?: Theme | null }) => void;
  setContent: (fn: (c: PageContent) => PageContent, key?: string) => void;
  setTheme: (fn: (t: Theme) => Theme, key?: string) => void;
  updateSection: <T extends SectionType>(id: string, fn: (data: SectionData<T>) => SectionData<T>, key?: string) => void;
  updateSectionMeta: (id: string, patch: Partial<Pick<Section, "visible" | "style">>, key?: string) => void;
  addSection: (type: SectionType) => string | null;
  removeSection: (id: string) => void;
  moveSection: (from: number, to: number) => void;
  duplicateSection: (id: string) => void;
  select: (id: string | null) => void;
  applyTemplate: (theme: Theme) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => number;
  markSaved: (version: number) => void;
  markError: (msg: string) => void;
}

const HISTORY_MAX = 100;
const COALESCE_MS = 900;

/** Registra um passo no histórico; digitação rápida no mesmo campo vira um único passo. */
function withHistory(s: BuilderState, key: string | undefined): Partial<BuilderState> {
  const now = Date.now();
  const coalesce = key && key === s.lastKey && now - s.lastAt < COALESCE_MS;
  return {
    past: coalesce ? s.past : [...s.past.slice(-HISTORY_MAX + 1), { content: s.content, theme: s.theme }],
    future: [],
    lastKey: key ?? null,
    lastAt: now,
    version: s.version + 1,
    saveState: "dirty",
  };
}

export const useBuilder = create<BuilderState>((set, get) => ({
  pageId: "",
  status: "DRAFT",
  content: null as unknown as PageContent,
  theme: null as unknown as Theme,
  templateDefault: null,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  saveState: "idle",
  saveError: null,
  lastSavedAt: null,
  version: 0,
  savedVersion: 0,
  selectedId: null,

  init: (d) =>
    set({
      pageId: d.pageId,
      status: d.status,
      content: d.content,
      theme: d.theme,
      templateDefault: d.templateDefault ?? null,
      past: [],
      future: [],
      version: 0,
      savedVersion: 0,
      saveState: "idle",
      selectedId: null,
    }),

  setContent: (fn, key) => set((s) => ({ ...withHistory(s, key), content: fn(s.content) })),
  setTheme: (fn, key) => set((s) => ({ ...withHistory(s, key), theme: fn(s.theme) })),

  updateSection: (id, fn, key) =>
    set((s) => ({
      ...withHistory(s, key ?? `sec:${id}`),
      content: {
        ...s.content,
        sections: s.content.sections.map((sec) => (sec.id === id ? ({ ...sec, data: fn(sec.data as never) } as Section) : sec)),
      },
    })),

  updateSectionMeta: (id, patch, key) =>
    set((s) => ({
      ...withHistory(s, key),
      content: { ...s.content, sections: s.content.sections.map((sec) => (sec.id === id ? ({ ...sec, ...patch } as Section) : sec)) },
    })),

  addSection: (type) => {
    const s = get();
    const count = s.content.sections.filter((x) => x.type === type).length;
    if (count >= sectionRegistry[type].maxInstances) return null;
    const section = createSection(type);
    const sections = [...s.content.sections];
    // novas seções entram antes da frase final (se existir)
    const finaleIdx = sections.findIndex((x) => x.type === "finale");
    sections.splice(finaleIdx === -1 ? sections.length : finaleIdx, 0, section);
    set({ ...withHistory(s, undefined), content: { ...s.content, sections }, selectedId: section.id });
    return section.id;
  },

  removeSection: (id) =>
    set((s) => ({
      ...withHistory(s, undefined),
      content: { ...s.content, sections: s.content.sections.filter((x) => x.id !== id) },
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  moveSection: (from, to) =>
    set((s) => {
      const sections = [...s.content.sections];
      const [moved] = sections.splice(from, 1);
      if (!moved) return {};
      sections.splice(to, 0, moved);
      return { ...withHistory(s, undefined), content: { ...s.content, sections } };
    }),

  duplicateSection: (id) =>
    set((s) => {
      const idx = s.content.sections.findIndex((x) => x.id === id);
      const src = s.content.sections[idx];
      if (!src || s.content.sections.filter((x) => x.type === src.type).length >= sectionRegistry[src.type].maxInstances) return {};
      const copy = { ...structuredClone(src), id: `${src.type.slice(0, 3)}-${Math.random().toString(36).slice(2, 10)}` } as Section;
      const sections = [...s.content.sections];
      sections.splice(idx + 1, 0, copy);
      return { ...withHistory(s, undefined), content: { ...s.content, sections }, selectedId: copy.id };
    }),

  select: (id) => set({ selectedId: id }),

  applyTemplate: (theme) => set((s) => ({ ...withHistory(s, undefined), theme, templateDefault: theme })),

  undo: () =>
    set((s) => {
      const prev = s.past.at(-1);
      if (!prev) return {};
      return {
        past: s.past.slice(0, -1),
        future: [{ content: s.content, theme: s.theme }, ...s.future],
        content: prev.content,
        theme: prev.theme,
        version: s.version + 1,
        saveState: "dirty",
        lastKey: null,
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return {};
      return {
        future: s.future.slice(1),
        past: [...s.past, { content: s.content, theme: s.theme }],
        content: next.content,
        theme: next.theme,
        version: s.version + 1,
        saveState: "dirty",
        lastKey: null,
      };
    }),

  markSaving: () => {
    set({ saveState: "saving" });
    return get().version;
  },
  markSaved: (version) =>
    set((s) => ({ savedVersion: version, lastSavedAt: Date.now(), saveError: null, saveState: s.version === version ? "saved" : "dirty" })),
  markError: (msg) => set({ saveState: "error", saveError: msg }),
}));
