import { json, route } from "@/lib/api";
import { db } from "@/lib/db";
import { requireEditablePage } from "@/lib/pages/access";

type Ctx = { params: Promise<{ id: string }> };

/** Recados, respostas do pedido e cupons resgatados — visíveis só para o dono da página. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireEditablePage(id);
  const events = await db.pageEvent.findMany({
    where: { pageId: id, type: { in: ["GUESTBOOK", "PROPOSAL_ANSWER", "COUPON_REDEEMED", "OPENED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, type: true, data: true, createdAt: true },
  });
  return json({ events });
});
