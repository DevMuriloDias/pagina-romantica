"use client";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PageContent } from "@/lib/content/schema";
import { backgroundCss, googleFontsUrl, themeToCssVars } from "@/lib/theme";
import type { Theme } from "@/lib/theme/schema";
import { cn } from "@/lib/utils";
import { Effects } from "./Effects";
import { Gate, type VerifyFn } from "./Gate";
import { MusicPlayer, type MusicHandle } from "./MusicPlayer";
import { Overlay, OverlayProvider } from "./Overlay";
import { renderSection } from "./renderSection";
import { RuntimeProvider, type PageRuntime } from "./runtime";

export interface PageRendererProps {
  content: PageContent;
  theme: Theme;
  runtime: PageRuntime;
  /** Exibe a tela de entrada antes do conteúdo. */
  showGate?: boolean;
  verify?: VerifyFn;
  onOpened?: () => void;
  /** Dentro de uma moldura (editor/landing): a página rola dentro de um container. */
  contained?: boolean;
  /**
   * Elemento posicionado sobre a área visível da moldura (fora do container que rola).
   * Sem ele, a camada de sobreposição usa position: fixed (viewport).
   */
  overlayRoot?: HTMLElement | null;
  watermark?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

/**
 * Renderer único da página romântica. O preview do editor e a página pública
 * usam exatamente este componente — o que o cliente vê é o que o destinatário recebe.
 */
export function PageRenderer({ content, theme, runtime, showGate, verify, onOpened, contained, overlayRoot, watermark, className, footer }: PageRendererProps) {
  const music = useRef<MusicHandle>(null);
  const [entered, setEntered] = useState(!showGate);
  const [layer, setLayer] = useState<HTMLElement | null>(null);

  const fontsUrl = useMemo(() => {
    const ids = new Set<string>([theme.fonts.heading, theme.fonts.body, theme.fonts.script]);
    for (const s of content.sections) {
      if (s.type === "letters") s.data.letters.forEach((l) => ids.add(l.font));
      if (s.style.headingFont) ids.add(s.style.headingFont);
    }
    return googleFontsUrl(ids);
  }, [theme.fonts, content.sections]);

  const effectColors = useMemo(() => [theme.colors.primary, theme.colors.secondary, theme.colors.accent], [theme.colors]);
  const vars = useMemo(() => themeToCssVars(theme), [theme]);
  const style = useMemo(() => ({ ...vars, ...backgroundCss(theme) }), [vars, theme]);
  const hasMusic = content.music.provider !== "none" && Boolean(content.music.mediaId);

  // Camada de sobreposição: presa à área visível (não à página inteira).
  const layerEl = (
    <div
      ref={setLayer}
      className={cn("love-page pointer-events-none inset-0 z-[60] overflow-hidden", overlayRoot ? "absolute" : "fixed")}
      data-card={theme.cardStyle}
      style={{ ...vars, background: "transparent" }}
    />
  );

  return (
    <RuntimeProvider value={runtime}>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} precedence="default" /> : null}
      <div
        className={cn("love-page relative min-h-full overflow-x-clip", contained ? "isolate" : "min-h-svh", theme.background.type === "pattern" && theme.background.animatedPattern && "bg-drift", className)}
        data-card={theme.cardStyle}
        data-cursor={theme.heartCursor ? "heart" : undefined}
        style={style}
      >
        <MusicPlayer ref={music} music={content.music} contained={contained} />
        <OverlayProvider value={layer}>
          <main className="relative z-[2]">
            {content.sections.filter((s) => s.visible).map((s) => renderSection(s, theme, content))}
          </main>
        </OverlayProvider>
        {footer}
        {overlayRoot ? createPortal(layerEl, overlayRoot) : layerEl}
        <OverlayProvider value={layer}>
          <Overlay>
            <Effects type={theme.effects.type} intensity={theme.effects.intensity} colors={effectColors} />
            {watermark ? <Watermark /> : null}
            {showGate && !entered ? (
              <Gate
                gate={content.gate}
                recipientName={content.meta.recipientName}
                hasMusic={hasMusic}
                verify={verify}
                onOpen={() => {
                  music.current?.play();
                  setEntered(true);
                  onOpened?.();
                }}
              />
            ) : null}
          </Overlay>
        </OverlayProvider>
      </div>
    </RuntimeProvider>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[90] overflow-hidden" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-28 opacity-[0.05]">
        {Array.from({ length: 120 }).map((_, i) => (
          <span key={i} className="text-2xl font-black uppercase tracking-[0.3em] text-black">prévia</span>
        ))}
      </div>
    </div>
  );
}
