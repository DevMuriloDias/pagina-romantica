import { redirect } from "next/navigation";
import { ReviewView } from "@/components/builder/ReviewView";
import { getEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

export const metadata = { title: "Revisão final", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageId } = await searchParams;
  const page = pageId ? await getEditablePage(pageId) : null;
  if (!page) redirect("/criar");
  const { content, theme } = pageView(page);
  return <ReviewView pageId={page.id} content={content} theme={theme} />;
}
