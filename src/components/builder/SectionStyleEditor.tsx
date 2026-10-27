"use client";
import { Paintbrush } from "lucide-react";
import { NativeSelect } from "@/components/ui/input";
import type { Section, SectionStyle } from "@/lib/content/schema";
import { FONTS } from "@/lib/theme/fonts";
import { Slider } from "@/components/ui/slider";
import { useBuilder } from "@/stores/builder";
import { ChoiceChips, ColorField } from "./fields";

/** Overrides de estilo por seção, em cima do tema global. */
export function SectionStyleEditor({ section }: { section: Section }) {
  const theme = useBuilder((s) => s.theme);
  const updateMeta = useBuilder((s) => s.updateSectionMeta);
  const st = section.style;
  const set = (patch: Partial<SectionStyle>) => updateMeta(section.id, { style: { ...st, ...patch } }, `style-${section.id}`);
  const grad = st.bgGradient ?? { colors: [theme.colors.secondary, theme.colors.background], angle: 180 };
  return (
    <details className="group rounded-xl border border-line bg-cream/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Paintbrush className="size-4 text-rose" /> Estilo desta seção <span className="ml-auto text-xs text-ink-soft group-open:hidden">fundo, cores, fonte...</span>
      </summary>
      <div className="space-y-4 border-t border-line p-3">
        <ChoiceChips label="Fundo" value={st.bgType} onChange={(v) => set({ bgType: v, bgColor: st.bgColor ?? theme.colors.surface })} options={[{ value: "inherit", label: "Igual à página" }, { value: "solid", label: "Cor" }, { value: "gradient", label: "Degradê" }, { value: "transparent", label: "Transparente" }]} />
        {st.bgType === "solid" ? <ColorField label="Cor de fundo" value={st.bgColor ?? theme.colors.surface} onChange={(v) => set({ bgColor: v })} /> : null}
        {st.bgType === "gradient" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {grad.colors.slice(0, 2).map((c, i) => (
                <ColorField key={i} label={`Cor ${i + 1}`} value={c} onChange={(v) => set({ bgGradient: { ...grad, colors: grad.colors.map((x, j) => (j === i ? v : x)) } })} />
              ))}
            </div>
            <div>
              <p className="text-xs font-medium">Ângulo: {grad.angle}°</p>
              <Slider value={[grad.angle]} min={0} max={360} step={5} onValueChange={([v]) => set({ bgGradient: { ...grad, angle: v ?? 180 } })} aria-label="Ângulo do degradê" />
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Texto" value={st.textColor ?? theme.colors.text} onChange={(v) => set({ textColor: v })} against={{ color: st.bgType === "solid" && st.bgColor ? st.bgColor : theme.colors.background, label: "o fundo" }} />
          <ColorField label="Destaque" value={st.accentColor ?? theme.colors.primary} onChange={(v) => set({ accentColor: v })} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Fonte dos títulos</p>
          <NativeSelect value={st.headingFont ?? ""} onChange={(e) => set({ headingFont: (e.target.value || undefined) as SectionStyle["headingFont"] })} aria-label="Fonte dos títulos da seção">
            <option value="">Igual à página</option>
            {FONTS.map((f) => <option key={f.id} value={f.id}>{f.family}</option>)}
          </NativeSelect>
        </div>
        <ChoiceChips label="Espaçamento" value={st.spacing} onChange={(v) => set({ spacing: v })} options={[{ value: "compact", label: "Compacto" }, { value: "normal", label: "Normal" }, { value: "spacious", label: "Amplo" }]} />
        <ChoiceChips label="Animação de entrada" value={st.animation} onChange={(v) => set({ animation: v })} options={[{ value: "inherit", label: "Padrão" }, { value: "fade", label: "Surgir" }, { value: "slide", label: "Deslizar" }, { value: "zoom", label: "Zoom" }, { value: "none", label: "Nenhuma" }]} />
        <button type="button" className="text-xs text-ink-soft underline" onClick={() => updateMeta(section.id, { style: { bgType: "inherit", spacing: "normal", animation: "inherit" } })}>
          Voltar ao estilo padrão
        </button>
      </div>
    </details>
  );
}
