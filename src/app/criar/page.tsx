import { Questionnaire } from "@/components/wizard/Questionnaire";
import { activeTemplates } from "@/lib/catalog";
import { currentDraftId, getEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

export const metadata = { title: "Criar minha página", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ modelo?: string; novo?: string }> }) {
  const sp = await searchParams;
  const templates = await activeTemplates();
  let existing: { id: string; label: string } | null = null;
  const currentId = await currentDraftId();
  if (currentId && !sp.novo) {
    const page = await getEditablePage(currentId);
    if (page && (page.status === "DRAFT" || page.status === "PENDING_PAYMENT")) {
      const { content } = pageView(page);
      if (content.meta.recipientName || content.meta.senderName) {
        existing = { id: page.id, label: content.meta.recipientName ? `A página para ${content.meta.recipientName} está salva — é só continuar.` : "Seu rascunho está salvo." };
      }
    }
  }
  const initialTemplate = templates.some((t) => t.id === sp.modelo) ? sp.modelo : undefined;
  return <Questionnaire templates={templates} initialTemplate={initialTemplate} existing={existing} />;
}
