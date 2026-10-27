import type { SectionData, SectionOf, SectionType } from "@/lib/content/schema";

export interface EditorProps<T extends SectionType> {
  section: SectionOf<T>;
  update: (fn: (d: SectionData<T>) => SectionData<T>, key?: string) => void;
}
