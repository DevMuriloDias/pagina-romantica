import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/config";
import { getPublicPage, isUnlocked } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { PublicPageClient } from "./PublicPageClient";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** Metadados genéricos: a prévia no WhatsApp não revela nada íntimo. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  return {
    title: "Uma surpresa para você 💌",
    description: "Alguém preparou algo muito especial. Abra com carinho (e com o som ligado).",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title: "Uma surpresa para você 💌", description: "Alguém preparou algo muito especial para você.", type: "website", siteName: BRAND.name },
    twitter: { card: "summary_large_image", title: "Uma surpresa para você 💌" },
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();
  const { content, theme } = pageView(page);
  const protectedGate = content.gate.mode !== "none" && content.gate.answersCount > 0;
  const unlocked = !protectedGate || (await isUnlocked(page.id));

  // Bloqueada: o HTML não contém o conteúdo — só a porta, o tema e a música.
  const initial = unlocked ? content : { ...content, sections: [] };

  return <PublicPageClient slug={slug} initialContent={initial} theme={theme} locked={!unlocked} />;
}
