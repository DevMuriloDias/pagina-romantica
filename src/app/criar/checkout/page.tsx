import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { db } from "@/lib/db";
import { getEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

export const metadata = { title: "Finalizar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ page?: string; order?: string }> }) {
  const sp = await searchParams;
  const page = sp.page ? await getEditablePage(sp.page) : null;
  if (!page) redirect("/criar");
  const { content } = pageView(page);
  const order = sp.order ? await db.order.findFirst({ where: { id: sp.order, pageId: page.id }, select: { id: true } }) : null;
  const customer = page.customerId ? await db.customer.findUnique({ where: { id: page.customerId }, select: { email: true } }) : null;
  return <CheckoutView pageId={page.id} recipientName={content.meta.recipientName} initialOrderId={order?.id ?? null} initialEmail={customer?.email ?? ""} />;
}
