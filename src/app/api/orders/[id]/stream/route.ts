import { db } from "@/lib/db";
import { maybeRefreshFromProvider, orderStatusView, requireOrderAccess } from "@/lib/payments/orders";
import { ApiError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TERMINAL = new Set(["APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "REFUNDED", "CHARGED_BACK"]);

/**
 * Server-Sent Events: a tela de pagamento recebe a mudança de status em tempo real.
 * O servidor verifica o banco a cada 2s (o webhook atualiza o banco) e encerra ao chegar num estado final.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await requireOrderAccess(id);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return new Response("event: error\ndata: {}\n\n", { status, headers: { "Content-Type": "text/event-stream" } });
  }
  const encoder = new TextEncoder();
  let closed = false;
  req.signal.addEventListener("abort", () => (closed = true));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let last = "";
      const started = Date.now();
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      while (!closed && Date.now() - started < 280_000) {
        const order = await db.order.findUnique({ where: { id } });
        if (!order) break;
        await maybeRefreshFromProvider(order);
        const view = await orderStatusView(id);
        const sig = `${view.status}:${view.slug ?? ""}`;
        if (sig !== last) {
          send("status", view);
          last = sig;
        } else {
          controller.enqueue(encoder.encode(": ping\n\n"));
        }
        if (TERMINAL.has(view.status) && (view.status !== "APPROVED" || view.slug)) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!closed) controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
