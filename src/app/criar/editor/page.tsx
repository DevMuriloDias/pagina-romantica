import { redirect } from "next/navigation";
import { Builder } from "@/components/builder/Builder";
import { activeTemplates } from "@/lib/catalog";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";
import { plansInfoForBuilder } from "@/lib/plans-info";

export const metadata = { title: "Editor", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageId } = await searchParams;
  const page = pageId ? await getEditablePage(pageId) : null;
  if (!page) redirect("/criar");
  const [templates, plans, pending] = await Promise.all([
    activeTemplates(),
    plansInfoForBuilder(),
    db.order.findFirst({ where: { pageId: page.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  const { content, theme } = pageView(page);
  return (
    <Builder
      page={{
        id: page.id,
        status: page.status,
        content,
        theme,
        slug: page.slug,
        publicUrl: page.status === "PUBLISHED" && page.slug ? appUrl(`/p/${page.slug}`) : null,
        pendingOrderId: pending?.id ?? null,
      }}
      templates={templates}
      plans={plans}
    />
  );
}
