"use client";
import { useMemo, useRef, useState } from "react";
import type { PageContent } from "@/lib/content/schema";
import { backgroundCss, googleFontsUrl, themeToCssVars } from "@/lib/theme";
import type { Theme } from "@/lib/theme/schema";
import { cn } from "@/lib/utils";
import { Effects } from "./Effects";
import { Gate, type VerifyFn } from "./Gate";
import { MusicPlayer, type MusicHandle } from "./MusicPlayer";
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
  /** Dentro do editor: elementos "fixed" ficam presos à moldura do preview. */
  contained?: boolean;
  watermark?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

/**
 * Renderer único da página romântica. O preview do editor e a página pública
 * usam exatamente este componente — o que o cliente vê é o que o destinatário recebe.
 */
export function PageRenderer({ content, theme, runtime, showGate, verify, onOpened, contained, watermark, className, footer }: PageRendererProps) {
  const music = useRef<MusicHandle>(null);
  const [entered, setEntered] = useState(!showGate);

  const fontsUrl = useMemo(() => {
    const ids = new Set<string>([theme.fonts.heading, theme.fonts.body, theme.fonts.script]);
    for (const s of content.sections) {
      if (s.type === "letters") s.data.letters.forEach((l) => ids.add(l.font));
      if (s.style.headingFont) ids.add(s.style.headingFont);
    }
    return googleFontsUrl(ids);
  }, [theme.fonts, content.sections]);

  const effectColors = useMemo(() => [theme.colors.primary, theme.colors.secondary, theme.colors.accent], [theme.colors]);
  const style = useMemo(() => ({ ...themeToCssVars(theme), ...backgroundCss(theme) }), [theme]);

  return (
    <RuntimeProvider value={runtime}>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} precedence="default" /> : null}
      <div
        className={cn("love-page relative min-h-full overflow-x-clip", contained ? "isolate" : "min-h-svh", theme.background.type === "pattern" && theme.background.animatedPattern && "bg-drift", className)}
        data-card={theme.cardStyle}
        data-cursor={theme.heartCursor ? "heart" : undefined}
        style={style}
      >
        <Effects type={theme.effects.type} intensity={theme.effects.intensity} colors={effectColors} contained={contained} />
        <main className="relative z-[2]">
          {content.sections.filter((s) => s.visible).map((s) => renderSection(s, theme, content))}
        </main>
        {footer}
        <MusicPlayer ref={music} music={content.music} contained={contained} />
        {watermark ? <Watermark contained={contained} /> : null}
        {showGate && !entered ? (
          <Gate
            gate={content.gate}
            recipientName={content.meta.recipientName}
            contained={contained}
            verify={verify}
            onOpen={() => {
              music.current?.play();
              setEntered(true);
              onOpened?.();
            }}
          />
        ) : null}
      </div>
    </RuntimeProvider>
  );
}

function Watermark({ contained }: { contained?: boolean }) {
  return (
    <div className={cn(contained ? "absolute" : "fixed", "pointer-events-none inset-0 z-[90] overflow-hidden")} aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-28 opacity-[0.07]">
        {Array.from({ length: 120 }).map((_, i) => (
          <span key={i} className="text-2xl font-black uppercase tracking-[0.3em] text-black">prévia</span>
        ))}
      </div>
    </div>
  );
}
