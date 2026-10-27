"use client";
import { ChevronDown, Copy, Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/misc";
import type { Section, SectionType } from "@/lib/content/schema";
import { SECTION_ORDER, sectionRegistry } from "@/lib/sections/registry";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";
import { sectionEditors } from "./editors";
import { RemoveButton, SortableList } from "./fields";
import { usePlans } from "./plans-context";
import { SectionStyleEditor } from "./SectionStyleEditor";
import type { EditorProps } from "./editors/types";
import type { ComponentType } from "react";

export function SectionsPanel({ onFocusSection }: { onFocusSection: (id: string) => void }) {
  const sections = useBuilder((s) => s.content.sections);
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const setContent = useBuilder((s) => s.setContent);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Seções da página</h2>
          <p className="text-xs text-ink-soft">Arraste para mudar a ordem. Toque para editar.</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}><Plus /> Adicionar</Button>
      </div>
      <SortableList
        items={sections}
        onReorder={(next) => setContent((c) => ({ ...c, sections: next }))}
        className="space-y-2"
        render={(s, _i, handle) => (
          <SectionRow
            section={s}
            handle={handle}
            open={selectedId === s.id}
            onToggle={() => {
              const next = selectedId === s.id ? null : s.id;
              select(next);
              if (next) onFocusSection(next);
            }}
          />
        )}
      />
      <AddSectionDialog open={adding} onClose={() => setAdding(false)} onAdded={onFocusSection} />
    </div>
  );
}

function SectionRow({ section, handle, open, onToggle }: { section: Section; handle: React.ReactNode; open: boolean; onToggle: () => void }) {
  const meta = sectionRegistry[section.type];
  const plans = usePlans();
  const updateMeta = useBuilder((s) => s.updateSectionMeta);
  const updateSection = useBuilder((s) => s.updateSection);
  const remove = useBuilder((s) => s.removeSection);
  const duplicate = useBuilder((s) => s.duplicateSection);
  const Editor = sectionEditors[section.type] as ComponentType<EditorProps<SectionType>>;

  return (
    <div className={cn("rounded-2xl border bg-white transition-shadow", open ? "border-rose/40 shadow-[0_10px_30px_-18px_rgba(194,38,79,0.6)]" : "border-line", !section.visible && "opacity-60")} data-section-row={section.type}>
      <div className="flex items-center gap-1 p-2">
        {handle}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left" onClick={onToggle} aria-expanded={open}>
          <span className="text-xl" aria-hidden>{meta.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {meta.label}
              {plans.premiumSections.has(section.type) ? <Badge tone="premium">Premium</Badge> : null}
            </span>
            <span className="block truncate text-xs text-ink-soft">{meta.description}</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform", open && "rotate-180")} />
        </button>
        <button type="button" onClick={() => updateMeta(section.id, { visible: !section.visible })} className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5" aria-label={section.visible ? "Ocultar seção" : "Mostrar seção"} title={section.visible ? "Ocultar" : "Mostrar"}>
          {section.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </div>
      {open ? (
        <div className="space-y-4 border-t border-line p-4">
          <Editor section={section as never} update={(fn, key) => updateSection(section.id, fn as never, key)} />
          <SectionStyleEditor section={section} />
          <div className="flex justify-end gap-1">
            {meta.maxInstances > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => duplicate(section.id)}><Copy /> Duplicar</Button>
            ) : null}
            {meta.removable ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                Remover seção <RemoveButton onClick={() => { if (confirm(`Remover a seção “${meta.label}”? Você pode desfazer com Ctrl+Z.`)) remove(section.id); }} />
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddSectionDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const sections = useBuilder((s) => s.content.sections);
  const add = useBuilder((s) => s.addSection);
  const plans = usePlans();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader title="Adicionar uma seção" description="Escolha o que mais combina com a história de vocês." />
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTION_ORDER.map((type) => {
            const meta = sectionRegistry[type];
            const count = sections.filter((s) => s.type === type).length;
            const full = count >= meta.maxInstances;
            return (
              <button
                key={type}
                type="button"
                disabled={full}
                onClick={() => {
                  const id = add(type);
                  onClose();
                  if (id) onAdded(id);
                }}
                className="flex items-start gap-3 rounded-xl border border-line bg-white p-3 text-left transition hover:border-rose/40 hover:bg-blush/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {meta.label} {plans.premiumSections.has(type) ? <Badge tone="premium">Premium</Badge> : null}
                  </span>
                  <span className="text-xs text-ink-soft">{full ? "Já está na página" : meta.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
