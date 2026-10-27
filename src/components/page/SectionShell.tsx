"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import type { SectionStyle } from "@/lib/content/schema";
import { fontStack, gradientCss } from "@/lib/theme";
import type { Theme } from "@/lib/theme/schema";
import { cn } from "@/lib/utils";

const VARIANTS: Record<"fade" | "slide" | "zoom" | "none", Variants> = {
  fade: { hidden: { opacity: 0 }, show: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 48 }, show: { opacity: 1, y: 0 } },
  zoom: { hidden: { opacity: 0, scale: 0.92 }, show: { opacity: 1, scale: 1 } },
  none: { hidden: { opacity: 1 }, show: { opacity: 1 } },
};

const DURATION = { slow: 1.1, normal: 0.7, fast: 0.4 } as const;
const SPACING = { compact: "py-10", normal: "py-16 @md:py-20", spacious: "py-24 @md:py-32" } as const;

export function sectionStyleVars(style: SectionStyle): CSSProperties {
  const out: Record<string, string> = {};
  if (style.bgType === "solid" && style.bgColor) out.background = style.bgColor;
  if (style.bgType === "gradient" && style.bgGradient) out.background = gradientCss(style.bgGradient.colors, style.bgGradient.angle);
  if (style.bgType === "transparent") out.background = "transparent";
  if (style.textColor) out["--c-text"] = style.textColor;
  if (style.accentColor) out["--c-primary"] = style.accentColor;
  if (style.headingFont) out["--font-heading"] = fontStack(style.headingFont);
  if (style.textColor) out.color = style.textColor;
  return out as CSSProperties;
}

export function SectionShell({
  id,
  style,
  theme,
  children,
  className,
  ariaLabel,
}: {
  id: string;
  style: SectionStyle;
  theme: Theme;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const reduced = useReducedMotion();
  const entrance = reduced ? "none" : style.animation === "inherit" ? theme.animation.entrance : style.animation;
  return (
    <section
      id={`s-${id}`}
      aria-label={ariaLabel}
      className={cn("relative px-5 @md:px-10", SPACING[style.spacing], className)}
      style={sectionStyleVars(style)}
    >
      <motion.div
        className="mx-auto w-full max-w-3xl"
        variants={VARIANTS[entrance]}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: DURATION[theme.animation.speed], ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export function SectionTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  if (!children) return null;
  return (
    <header className="mb-10 text-center">
      {eyebrow ? <p className="font-script mb-1 text-2xl text-[var(--c-primary)]">{eyebrow}</p> : null}
      <h2 className="text-3xl @md:text-5xl font-semibold text-[var(--c-text)] text-balance">{children}</h2>
      <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-[var(--c-primary)]" aria-hidden>
        <span className="h-px w-10 bg-current opacity-40" />
        <span className="text-sm">♥</span>
        <span className="h-px w-10 bg-current opacity-40" />
      </div>
    </header>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="love-card mx-auto max-w-md border-dashed! p-6 text-center text-sm opacity-70" data-empty-hint>
      {children}
    </div>
  );
}
