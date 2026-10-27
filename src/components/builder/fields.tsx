"use client";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { streamText } from "@/lib/client/api";
import { normalizeHex, contrastLevel } from "@/lib/theme/color";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";

// ───────────── Texto com IA ─────────────

const IMPROVE = [
  { mode: "romantico", label: "Mais romântico" },
  { mode: "divertido", label: "Mais divertido" },
  { mode: "poetico", label: "Mais poético" },
  { mode: "curto", label: "Mais curto" },
  { mode: "corrigir", label: "Corrigir português" },
] as const;

export function AiTextArea({
  label,
  value,
  onChange,
  help,
  placeholder,
  rows = 6,
  maxLength,
  write,
  fieldKey,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string, key?: string) => void;
  help?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  /** Habilita "✨ Escrever com IA" (cartas). */
  write?: { context: string; openWhen?: string };
  fieldKey?: string;
  className?: string;
}) {
  const id = useId();
  const pageId = useBuilder((s) => s.pageId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const before = useRef<string | null>(null);

  const run = async (kind: "write" | "improve", mode?: string) => {
    setMenu(false);
    setError(null);
    before.current = value;
    setBusy(kind === "write" ? "Escrevendo..." : "Melhorando...");
    try {
      const url = kind === "write" ? "/api/ai/letter" : "/api/ai/improve";
      const body = kind === "write" ? { pageId, context: write?.context ?? "", openWhen: write?.openWhen } : { pageId, text: value, mode };
      await streamText(url, body, (full) => onChange(full.slice(0, maxLength ?? 6000), `ai:${fieldKey ?? id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "A IA não respondeu.");
      if (before.current !== null) onChange(before.current);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Field
      label={label}
      help={error ? <span className="text-destructive">{error}</span> : help}
      htmlFor={id}
      className={className}
      aside={
        <div className="relative flex items-center gap-1">
          {write ? (
            <Button type="button" variant="soft" size="sm" onClick={() => run("write")} disabled={Boolean(busy)}>
              <Sparkles /> Escrever com IA
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setMenu((m) => !m)} disabled={Boolean(busy) || !value.trim()} aria-expanded={menu}>
            <Wand2 /> Melhorar
          </Button>
          {menu ? (
            <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl" role="menu">
              {IMPROVE.map((o) => (
                <button key={o.mode} type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-sm hover:bg-blush/50" onClick={() => run("improve", o.mode)}>
                  ✨ {o.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      }
    >
      <div className="relative">
        <Textarea id={id} value={value} rows={rows} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value, fieldKey ?? id)} disabled={Boolean(busy)} className={cn(busy && "animate-pulse")} />
        {busy ? (
          <span className="absolute bottom-2 right-3 inline-flex items-center gap-1 text-xs text-rose">
            <Loader2 className="size-3 animate-spin" /> {busy}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

export function TextField({ label, value, onChange, help, placeholder, maxLength = 120, fieldKey }: { label: string; value: string; onChange: (v: string, key?: string) => void; help?: string; placeholder?: string; maxLength?: number; fieldKey?: string }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <Input id={id} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value, fieldKey ?? id)} />
    </Field>
  );
}

// ───────────── Cor ─────────────

export function ColorField({ label, value, onChange, against }: { label: string; value: string; onChange: (v: string) => void; against?: { color: string; label: string } }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : value;
  const level = against ? contrastLevel(value, against.color) : null;
  return (
    <div className="flex items-center gap-2.5">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-line" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label}: seletor de cor`} />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink">{label}</p>
        <div className="flex items-center gap-2">
          <input
            value={shown}
            onFocus={() => {
              setText(value);
              setFocused(true);
            }}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setText(e.target.value);
              const n = normalizeHex(e.target.value);
              if (n) onChange(n);
            }}
            className="w-24 rounded-md border border-line bg-white px-2 py-0.5 font-mono text-xs uppercase"
            aria-label={`${label}: código HEX`}
          />
          {level === "fail" || level === "AA-large" ? (
            <span className="text-[11px] text-amber-700" title={`Contraste com ${against?.label} abaixo do recomendado (WCAG AA)`}>
              ⚠️ contraste baixo
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ───────────── Datas ─────────────

export function DateField({ label, value, onChange, help, withTime }: { label: string; value: string; onChange: (v: string) => void; help?: string; withTime?: boolean }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <Input id={id} type={withTime ? "datetime-local" : "date"} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// ───────────── Lista reordenável (dnd-kit) ─────────────

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  grid,
  className,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  render: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  grid?: boolean;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem key={item.id} id={item.id}>
              {(handle) => render(item, i, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" className="cursor-grab touch-none rounded-md p-1 text-ink-soft/60 hover:bg-ink/5 hover:text-ink active:cursor-grabbing" aria-label="Arrastar para reordenar" {...attributes} {...listeners}>
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }} className={cn(isDragging && "opacity-80 drop-shadow-xl")}>
      {children(handle)}
    </div>
  );
}

export function RemoveButton({ onClick, label = "Remover" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md p-1.5 text-ink-soft/60 hover:bg-red-50 hover:text-red-600" aria-label={label} title={label}>
      <Trash2 className="size-4" />
    </button>
  );
}

export function ChoiceChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; emoji?: string }[]; label?: string }) {
  return (
    <div className="space-y-1.5">
      {label ? <p className="text-sm font-medium text-ink">{label}</p> : null}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", value === o.value ? "border-rose bg-rose text-white" : "border-line bg-white hover:border-ink/30")}
          >
            {o.emoji ? <span className="mr-1">{o.emoji}</span> : null}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
