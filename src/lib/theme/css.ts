import type { CSSProperties } from "react";
import { mix, withAlpha } from "./color";
import { fontStack } from "./fonts";
import type { Theme } from "./schema";

const SHADOWS: Record<Theme["shadow"], string> = {
  none: "none",
  soft: "0 10px 30px -12px rgba(0,0,0,0.18)",
  strong: "0 18px 50px -12px rgba(0,0,0,0.38)",
};

const SPEEDS: Record<Theme["animation"]["speed"], string> = { slow: "1.1s", normal: "0.7s", fast: "0.4s" };

export function gradientCss(colors: string[], angle: number): string {
  return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
}

const PATTERN_SVG: Record<Theme["background"]["pattern"], (c: string) => string> = {
  hearts: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><path d='M24 34s-9-5.6-9-11.2A5 5 0 0 1 24 20a5 5 0 0 1 9 2.8C33 28.4 24 34 24 34z' fill='${c}'/></svg>`,
  dots: (c) => `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='3' cy='3' r='1.6' fill='${c}'/></svg>`,
  stars: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><path d='M30 22l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z' fill='${c}'/></svg>`,
  waves: (c) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='20'><path d='M0 10 Q20 0 40 10 T80 10' fill='none' stroke='${c}' stroke-width='1.5'/></svg>`,
};

export function patternUrl(pattern: Theme["background"]["pattern"], color: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(PATTERN_SVG[pattern](color))}")`;
}

/** Imagens de fundo só podem vir do nosso storage (https ou caminho relativo). */
export function safeImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/uploads/")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function backgroundCss(theme: Theme): CSSProperties {
  const b = theme.background;
  switch (b.type) {
    case "gradient":
      return { background: gradientCss(b.gradient.colors, b.gradient.angle) };
    case "image": {
      const url = safeImageUrl(b.image.url);
      if (!url) return { background: theme.colors.background };
      const overlay = withAlpha(b.image.overlayColor, b.image.overlayOpacity);
      return {
        backgroundColor: theme.colors.background,
        backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${url.replace(/"/g, "%22")}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "scroll",
      };
    }
    case "pattern":
      return {
        backgroundColor: theme.colors.background,
        backgroundImage: patternUrl(b.pattern, withAlpha(theme.colors.primary, 0.12)),
      };
    default:
      return { background: theme.colors.background };
  }
}

/** Converte os design tokens em CSS variables aplicadas na raiz da página. */
export function themeToCssVars(theme: Theme): CSSProperties {
  const c = theme.colors;
  return {
    "--c-primary": c.primary,
    "--c-secondary": c.secondary,
    "--c-accent": c.accent,
    "--c-bg": c.background,
    "--c-surface": c.surface,
    "--c-text": c.text,
    "--c-muted": mix(c.text, c.background, 0.35),
    "--c-primary-soft": withAlpha(c.primary, 0.12),
    "--c-border": withAlpha(c.text, 0.12),
    "--font-heading": fontStack(theme.fonts.heading),
    "--font-body": fontStack(theme.fonts.body),
    "--font-script": fontStack(theme.fonts.script),
    "--base-size": `${theme.baseSize}px`,
    "--body-weight": String(theme.bodyWeight),
    "--radius": `${theme.radius}px`,
    "--shadow": SHADOWS[theme.shadow],
    "--anim-speed": SPEEDS[theme.animation.speed],
  } as CSSProperties;
}
