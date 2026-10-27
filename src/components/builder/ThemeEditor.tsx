"use client";
import { Check, ImageIcon, RotateCcw, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import type { ImageRef } from "@/lib/content/schema";
import { contrastLevel, mix, readableOn } from "@/lib/theme/color";
import { gradientCss, safeImageUrl } from "@/lib/theme/css";
import { FONTS, fontStack, googleFontsUrl, type FontCategory } from "@/lib/theme/fonts";
import { EFFECT_TYPES, type Theme } from "@/lib/theme/schema";
import { SUGGESTED_PALETTES, type TemplateDef } from "@/lib/theme/templates";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";
import { ChoiceChips, ColorField } from "./fields";
import { ImageField } from "./media";
import { ToggleRow } from "./editors/simple";

const EFFECT_LABEL: Record<(typeof EFFECT_TYPES)[number], string> = {
  none: "Nenhum",
  hearts: "Corações",
  petals: "Pétalas",
  stars: "Estrelas",
  confetti: "Confete",
  bubbles: "Bolhas",
  snow: "Neve",
  particles: "Partículas",
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h3 className="font-display text-lg">{title}</h3>
      {children}
    </section>
  );
}

export function ThemeEditor({ templates }: { templates: TemplateDef[] }) {
  const theme = useBuilder((s) => s.theme);
  const setTheme = useBuilder((s) => s.setTheme);
  const applyTemplate = useBuilder((s) => s.applyTemplate);
  const templateDefault = useBuilder((s) => s.templateDefault);
  const content = useBuilder((s) => s.content);
  const [paletteMsg, setPaletteMsg] = useState<string | null>(null);
  const set = (fn: (t: Theme) => Theme, key?: string) => setTheme(fn, key);
  const allFontsUrl = useMemo(() => googleFontsUrl(FONTS.map((f) => f.id)), []);

  const photos: ImageRef[] = useMemo(
    () =>
      content.sections.flatMap((s) => (s.type === "photos" ? s.data.photos.map((p) => p.image) : s.type === "hero" && s.data.photo ? [s.data.photo] : [])).slice(0, 12),
    [content.sections],
  );

  const paletteFromPhoto = async (img: ImageRef) => {
    setPaletteMsg("Analisando as cores da foto...");
    try {
      const { Vibrant } = await import("node-vibrant/browser");
      const src = safeImageUrl(img.url);
      if (!src) throw new Error("Imagem inválida");
      const p = await Vibrant.from(src).getPalette();
      const hex = (sw: { hex: string } | null | undefined, fb: string) => sw?.hex ?? fb;
      const primary = hex(p.Vibrant ?? p.DarkVibrant, theme.colors.primary);
      const bg = hex(p.LightMuted ?? p.LightVibrant, "#fffaf7");
      const background = mix(bg, "#ffffff", 0.55);
      set((t) => ({
        ...t,
        colors: {
          primary,
          secondary: hex(p.LightVibrant ?? p.Muted, theme.colors.secondary),
          accent: hex(p.DarkVibrant ?? p.Muted, theme.colors.accent),
          background,
          surface: mix(background, "#ffffff", 0.6),
          text: readableOn(background) === "#ffffff" ? "#ffffff" : hex(p.DarkMuted, "#2a1418"),
        },
      }));
      setPaletteMsg("Paleta aplicada! Ajuste o que quiser 🎨");
    } catch {
      setPaletteMsg("Não conseguimos ler as cores desta foto.");
    }
  };

  const c = theme.colors;
  const contrastWarnings = [
    contrastLevel(c.text, c.background) === "fail" || contrastLevel(c.text, c.background) === "AA-large" ? "O texto está com pouco contraste com o fundo — pode ficar difícil de ler." : null,
    contrastLevel(c.text, c.surface) === "fail" ? "O texto está com pouco contraste com os cartões (superfície)." : null,
    contrastLevel("#ffffff", c.primary) === "fail" ? "Botões com a cor primária podem ficar ilegíveis (texto branco)." : null,
  ].filter(Boolean) as string[];

  const fontSelect = (cat: FontCategory, key: keyof Theme["fonts"], label: string) => (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <NativeSelect value={theme.fonts[key]} onChange={(e) => set((t) => ({ ...t, fonts: { ...t.fonts, [key]: e.target.value } }))} style={{ fontFamily: fontStack(theme.fonts[key]) }} aria-label={label}>
        {FONTS.filter((f) => f.category === cat || (cat === "heading" && f.category === "body")).map((f) => (
          <option key={f.id} value={f.id} style={{ fontFamily: fontStack(f.id) }}>{f.family}</option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="space-y-4">
      {allFontsUrl ? <link rel="stylesheet" href={allFontsUrl} precedence="default" /> : null}
      <Group title="Estilo (template)">
        <p className="text-xs text-ink-soft">Trocar de estilo muda cores, fontes e fundo — seus textos e fotos continuam iguais.</p>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => {
            const active = theme.templateId === t.id;
            const bg = t.theme.background.type === "gradient" ? gradientCss(t.theme.background.gradient.colors, t.theme.background.gradient.angle) : t.theme.colors.background;
            return (
              <button key={t.id} type="button" onClick={() => applyTemplate(t.theme)} className={cn("relative overflow-hidden rounded-xl text-left ring-1 transition", active ? "ring-2 ring-rose" : "ring-line hover:ring-ink/30")} aria-pressed={active}>
                <div className="flex h-16 items-center justify-center" style={{ background: bg }}>
                  <span style={{ fontFamily: fontStack(t.theme.fonts.heading), color: t.theme.colors.text }} className="text-lg">Aa</span>
                  <span className="ml-2 size-3 rounded-full" style={{ background: t.theme.colors.primary }} />
                </div>
                <p className="px-2 py-1.5 text-xs font-medium">{t.name}</p>
                {active ? <Check className="absolute right-1.5 top-1.5 size-4 rounded-full bg-rose p-0.5 text-white" /> : null}
              </button>
            );
          })}
        </div>
        {templateDefault ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => applyTemplate(templateDefault)}>
            <RotateCcw /> Restaurar padrão do template
          </Button>
        ) : null}
      </Group>

      <Group title="Cores">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ColorField label="Primária" value={c.primary} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, primary: v } }), "c-primary")} against={{ color: "#ffffff", label: "texto branco" }} />
          <ColorField label="Secundária" value={c.secondary} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, secondary: v } }), "c-secondary")} />
          <ColorField label="Destaque" value={c.accent} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, accent: v } }), "c-accent")} />
          <ColorField label="Fundo" value={c.background} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, background: v } }), "c-bg")} />
          <ColorField label="Superfície (cartões)" value={c.surface} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, surface: v } }), "c-surface")} />
          <ColorField label="Texto" value={c.text} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, text: v } }), "c-text")} against={{ color: c.background, label: "o fundo" }} />
        </div>
        {contrastWarnings.map((w) => (
          <Alert key={w} tone="warning">⚠️ {w}</Alert>
        ))}
        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">Paletas sugeridas</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PALETTES.map((p) => (
              <button key={p.name} type="button" title={p.name} onClick={() => set((t) => ({ ...t, colors: p.colors }))} className="flex overflow-hidden rounded-full ring-1 ring-line hover:ring-ink/40" aria-label={`Aplicar paleta ${p.name}`}>
                {[p.colors.primary, p.colors.secondary, p.colors.accent, p.colors.background].map((col, i) => (
                  <span key={i} className="size-5" style={{ background: col }} />
                ))}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-ink-soft"><Wand2 className="size-3.5" /> Gerar paleta a partir de uma foto</p>
          {photos.length ? (
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <button key={p.url} type="button" onClick={() => paletteFromPhoto(p)} className="size-11 overflow-hidden rounded-lg ring-1 ring-line hover:ring-rose" aria-label="Usar as cores desta foto">
                  <img src={safeImageUrl(p.url) ?? ""} alt="" className="size-full object-cover" crossOrigin="anonymous" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft"><ImageIcon className="mr-1 inline size-3.5" />Adicione fotos na seção “Fotos do casal” para usar este recurso.</p>
          )}
          {paletteMsg ? <p className="mt-2 text-xs text-ink-soft">{paletteMsg}</p> : null}
        </div>
      </Group>

      <Group title="Fundo">
        <ChoiceChips value={theme.background.type} onChange={(v) => set((t) => ({ ...t, background: { ...t.background, type: v } }))} options={[{ value: "solid", label: "Cor sólida" }, { value: "gradient", label: "Degradê" }, { value: "image", label: "Imagem" }, { value: "pattern", label: "Padrão" }]} />
        {theme.background.type === "gradient" ? (
          <div className="space-y-3">
            <div className="h-10 rounded-xl ring-1 ring-line" style={{ background: gradientCss(theme.background.gradient.colors, theme.background.gradient.angle) }} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {theme.background.gradient.colors.map((col, i) => (
                <ColorField key={i} label={`Cor ${i + 1}`} value={col} onChange={(v) => set((t) => ({ ...t, background: { ...t.background, gradient: { ...t.background.gradient, colors: t.background.gradient.colors.map((x, j) => (j === i ? v : x)) } } }), `grad-${i}`)} />
              ))}
            </div>
            <div className="flex gap-2">
              {theme.background.gradient.colors.length < 3 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => set((t) => ({ ...t, background: { ...t.background, gradient: { ...t.background.gradient, colors: [...t.background.gradient.colors, t.colors.secondary] } } }))}>+ 3ª cor</Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => set((t) => ({ ...t, background: { ...t.background, gradient: { ...t.background.gradient, colors: t.background.gradient.colors.slice(0, 2) } } }))}>Usar só 2 cores</Button>
              )}
            </div>
            <div>
              <p className="text-xs font-medium">Ângulo: {theme.background.gradient.angle}°</p>
              <Slider value={[theme.background.gradient.angle]} min={0} max={360} step={5} onValueChange={([v]) => set((t) => ({ ...t, background: { ...t.background, gradient: { ...t.background.gradient, angle: v ?? 0 } } }), "grad-angle")} aria-label="Ângulo do degradê" />
            </div>
          </div>
        ) : null}
        {theme.background.type === "image" ? (
          <div className="space-y-3">
            <ImageField label="Imagem de fundo" value={theme.background.image.url ? { url: theme.background.image.url, alt: "" } : undefined} onChange={(img) => set((t) => ({ ...t, background: { ...t.background, image: { ...t.background.image, url: img?.url ?? "" } } }))} />
            <ColorField label="Cor da sobreposição" value={theme.background.image.overlayColor} onChange={(v) => set((t) => ({ ...t, background: { ...t.background, image: { ...t.background.image, overlayColor: v } } }))} />
            <div>
              <p className="text-xs font-medium">Opacidade da sobreposição: {Math.round(theme.background.image.overlayOpacity * 100)}%</p>
              <Slider value={[theme.background.image.overlayOpacity]} min={0} max={0.9} step={0.05} onValueChange={([v]) => set((t) => ({ ...t, background: { ...t.background, image: { ...t.background.image, overlayOpacity: v ?? 0 } } }), "overlay")} aria-label="Opacidade da sobreposição" />
            </div>
          </div>
        ) : null}
        {theme.background.type === "pattern" ? (
          <div className="space-y-3">
            <ChoiceChips value={theme.background.pattern} onChange={(v) => set((t) => ({ ...t, background: { ...t.background, pattern: v } }))} options={[{ value: "hearts", label: "Corações" }, { value: "dots", label: "Bolinhas" }, { value: "stars", label: "Estrelas" }, { value: "waves", label: "Ondas" }]} />
            <ToggleRow label="Padrão animado" help="O padrão se move devagar ao fundo." checked={theme.background.animatedPattern} onChange={(v) => set((t) => ({ ...t, background: { ...t.background, animatedPattern: v } }))} />
          </div>
        ) : null}
        {theme.background.type === "solid" ? <ColorField label="Cor de fundo" value={c.background} onChange={(v) => set((t) => ({ ...t, colors: { ...t.colors, background: v } }), "c-bg")} /> : null}
      </Group>

      <Group title="Tipografia">
        {fontSelect("heading", "heading", "Títulos")}
        {fontSelect("body", "body", "Texto")}
        {fontSelect("script", "script", "Manuscrita (assinaturas e detalhes)")}
        <div>
          <p className="text-xs font-medium">Tamanho do texto: {theme.baseSize}px</p>
          <Slider value={[theme.baseSize]} min={14} max={20} step={1} onValueChange={([v]) => set((t) => ({ ...t, baseSize: v ?? 16 }), "size")} aria-label="Tamanho do texto" />
        </div>
        <ChoiceChips label="Peso do texto" value={String(theme.bodyWeight) as "300" | "400" | "500"} onChange={(v) => set((t) => ({ ...t, bodyWeight: Number(v) as 300 | 400 | 500 }))} options={[{ value: "300", label: "Leve" }, { value: "400", label: "Normal" }, { value: "500", label: "Médio" }]} />
      </Group>

      <Group title="Forma">
        <div>
          <p className="text-xs font-medium">Arredondamento: {theme.radius}px</p>
          <Slider value={[theme.radius]} min={0} max={32} step={1} onValueChange={([v]) => set((t) => ({ ...t, radius: v ?? 0 }), "radius")} aria-label="Arredondamento das bordas" />
        </div>
        <ChoiceChips label="Sombras" value={theme.shadow} onChange={(v) => set((t) => ({ ...t, shadow: v }))} options={[{ value: "none", label: "Sem" }, { value: "soft", label: "Suaves" }, { value: "strong", label: "Fortes" }]} />
        <ChoiceChips label="Estilo dos cartões" value={theme.cardStyle} onChange={(v) => set((t) => ({ ...t, cardStyle: v }))} options={[{ value: "solid", label: "Sólido" }, { value: "glass", label: "Vidro" }, { value: "paper", label: "Papel" }, { value: "outline", label: "Contorno" }]} />
      </Group>

      <Group title="Animações e efeitos">
        <ChoiceChips label="Entrada das seções" value={theme.animation.entrance} onChange={(v) => set((t) => ({ ...t, animation: { ...t.animation, entrance: v } }))} options={[{ value: "fade", label: "Surgir" }, { value: "slide", label: "Deslizar" }, { value: "zoom", label: "Zoom" }, { value: "none", label: "Nenhuma" }]} />
        <ChoiceChips label="Velocidade" value={theme.animation.speed} onChange={(v) => set((t) => ({ ...t, animation: { ...t.animation, speed: v } }))} options={[{ value: "slow", label: "Lenta" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Rápida" }]} />
        <ChoiceChips label="Efeito de fundo" value={theme.effects.type} onChange={(v) => set((t) => ({ ...t, effects: { ...t.effects, type: v } }))} options={EFFECT_TYPES.map((e) => ({ value: e, label: EFFECT_LABEL[e] }))} />
        {theme.effects.type !== "none" ? (
          <div>
            <p className="text-xs font-medium">Intensidade: {theme.effects.intensity}</p>
            <Slider value={[theme.effects.intensity]} min={1} max={10} step={1} onValueChange={([v]) => set((t) => ({ ...t, effects: { ...t.effects, intensity: v ?? 4 } }), "fx")} aria-label="Intensidade do efeito" />
          </div>
        ) : null}
        <p className="text-xs text-ink-soft">Quem tem “reduzir movimento” ativado no celular vê a página sem animações — por acessibilidade.</p>
        <ToggleRow label="Cursor de coração 💗" help="No computador, o cursor vira um coraçãozinho." checked={theme.heartCursor} onChange={(v) => set((t) => ({ ...t, heartCursor: v }))} />
      </Group>
    </div>
  );
}
