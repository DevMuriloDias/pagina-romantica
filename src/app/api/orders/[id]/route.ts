import { json, route } from "@/lib/api";
import { maybeRefreshFromProvider, orderStatusView, requireOrderAccess } from "@/lib/payments/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Status do pedido (fallback de polling a cada 3s quando o SSE não está disponível). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const order = await requireOrderAccess(id);
  await maybeRefreshFromProvider(order);
  return json(await orderStatusView(id));
});
