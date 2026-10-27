"use client";
import type { ComponentType } from "react";
import type { PageContent, Section } from "@/lib/content/schema";
import type { Theme } from "@/lib/theme/schema";
import { sectionRenderers } from "./renderers";
import type { SectionProps } from "./types";

export function renderSection(section: Section, theme: Theme, content: PageContent) {
  const Component = sectionRenderers[section.type] as ComponentType<SectionProps<typeof section.type>>;
  return <Component key={section.id} section={section as never} theme={theme} content={content} />;
}
