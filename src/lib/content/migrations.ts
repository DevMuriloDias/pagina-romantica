import { CONTENT_SCHEMA_VERSION, ContentSchema, type PageContent } from "./schema";

/**
 * Migrações de conteúdo. Cada função recebe o JSON na versão N e devolve na versão N+1.
 * Nunca altere uma migração já publicada — crie uma nova.
 */
type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // v0 (protótipo, sem schemaVersion): título/subtítulo ficavam no topo e as seções em "blocks".
  0: (input) => {
    const { title, subtitle, blocks, ...rest } = input as {
      title?: string;
      subtitle?: string;
      blocks?: unknown[];
    } & Record<string, unknown>;
    const sections = Array.isArray(blocks) ? [...blocks] : [];
    if (title || subtitle) {
      sections.unshift({
        id: "hero-migrated",
        type: "hero",
        visible: true,
        data: { title: title ?? "", subtitle: subtitle ?? "" },
      });
    }
    return { ...rest, meta: rest.meta ?? {}, sections, schemaVersion: 1 };
  },
};

export function migrateContent(raw: unknown): PageContent {
  let data = (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}) as Record<
    string,
    unknown
  >;
  let version = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;
  if (version > CONTENT_SCHEMA_VERSION) {
    throw new Error(`Versão de conteúdo desconhecida: ${version}`);
  }
  while (version < CONTENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Migração ausente para a versão ${version}`);
    data = step(data);
    version = data.schemaVersion as number;
  }
  return ContentSchema.parse(data);
}

/** Versão tolerante: em caso de erro devolve null (a camada de cima decide o fallback). */
export function safeMigrateContent(raw: unknown): PageContent | null {
  try {
    return migrateContent(raw);
  } catch {
    return null;
  }
}
