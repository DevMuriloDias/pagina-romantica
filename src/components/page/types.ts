import type { PageContent, SectionOf, SectionType } from "@/lib/content/schema";
import type { Theme } from "@/lib/theme/schema";

export interface SectionProps<T extends SectionType> {
  section: SectionOf<T>;
  theme: Theme;
  content: PageContent;
}
