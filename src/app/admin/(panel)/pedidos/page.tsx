import type { OrderStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { field, SmallButton, Table, Td } from "@/components/admin";
import { ConfirmSubmit } from "@/components/admin-confirm";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { formatBRL, formatDateTime } from "@/lib/format";
import { log } from "@/lib/log";
import { paymentProvider } from "@/lib/payments";
import { sendApprovalEmail, syncOrderWithPayment } from "@/lib/payments/fulfill";

const STATUSES: OrderStatus[] = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "REFUNDED", "CHARGED_BACK"];
const TONE: Record<OrderStatus, "success" | "warning" | "muted" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", EXPIRED: "muted", CANCELLED: "muted", REFUNDED: "danger", CHARGED_BACK: "danger" };

async function resend(formData: FormData) {
  "use server";
  await requireAdmin();
  await sendApprovalEmail(String(formData.get("orderId")));
  revalidatePath("/admin/pedidos");
}

async function refund(formData: FormData) {
  "use server";
  await requireAdmin();
  const order = await db.order.findUnique({ where: { id: String(formData.get("orderId")) } });
  if (!order?.mpPaymentId || order.status !== "APPROVED") return;
  await paymentProvider().refund(order.mpPaymentId);
  // confirma direto na API (o webhook também chegará; o processamento é idempotente)
  const payment = await paymentProvider().getPayment(order.mpPaymentId);
  await syncOrderWithPayment(order.id, payment);
  log.info("admin.refund", { orderId: order.id });
  revalidatePath("/admin/pedidos");
}

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; method?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(sp.status && STATUSES.includes(sp.status as OrderStatus) ? { status: sp.status as OrderStatus } : {}),
    ...(sp.method === "PIX" || sp.method === "CARD" ? { method: sp.method } : {}),
    ...(sp.q ? { OR: [{ id: sp.q }, { mpPaymentId: sp.q }, { customer: { email: { contains: sp.q.toLowerCase() } } }] } : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { customer: true, plan: true, page: { select: { slug: true, status: true } }, coupon: true } }),
    db.order.count({ where }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Pedidos <span className="text-base text-ink-soft">({total})</span></h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="E-mail, ID do pedido ou do pagamento" className={`${field} w-72`} />
        <select name="status" defaultValue={sp.status ?? ""} className={field}>
          <option value="">Todos os status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="method" defaultValue={sp.method ?? ""} className={field}>
          <option value="">Pix e cartão</option>
          <option value="PIX">Pix</option>
          <option value="CARD">Cartão</option>
        </select>
        <button className="rounded-full bg-ink px-4 text-sm text-white">Filtrar</button>
      </form>
      <Table head={["Data", "Cliente", "Plano", "Valor", "Método", "Status", "Página", "Ações"]}>
        {orders.map((o) => (
          <tr key={o.id}>
            <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}<div className="text-[10px] text-ink-soft">{o.id}</div></Td>
            <Td>{o.customer.email}</Td>
            <Td>{o.plan.name}</Td>
            <Td className="whitespace-nowrap">{formatBRL(o.amountCents)}{o.coupon ? <div className="text-[10px] text-emerald-700">{o.coupon.code} −{formatBRL(o.discountCents)}</div> : null}</Td>
            <Td>{o.method === "PIX" ? "Pix" : `Cartão ${o.installments}x`}</Td>
            <Td><Badge tone={TONE[o.status]}>{o.status}</Badge>{o.statusDetail ? <div className="text-[10px] text-ink-soft">{o.statusDetail}</div> : null}</Td>
            <Td>{o.page.slug ? <Link className="text-rose underline" href={`/p/${o.page.slug}`} target="_blank">ver</Link> : "—"} <span className="text-[10px] text-ink-soft">{o.page.status}</span></Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {o.status === "APPROVED" ? (
                  <>
                    <form action={resend}><input type="hidden" name="orderId" value={o.id} /><SmallButton>Reenviar e-mail</SmallButton></form>
                    <form action={refund}><input type="hidden" name="orderId" value={o.id} /><ConfirmSubmit message="Reembolsar este pagamento? A página será despublicada.">Reembolsar</ConfirmSubmit></form>
                  </>
                ) : null}
              </div>
              {o.emailSentAt ? <div className="mt-1 text-[10px] text-ink-soft">e-mail enviado {formatDateTime(o.emailSentAt)}</div> : null}
            </Td>
          </tr>
        ))}
      </Table>
      <div className="flex gap-3 text-sm">
        {page > 1 ? <Link href={{ query: { ...sp, page: page - 1 } }} className="underline">← Anterior</Link> : null}
        {page * 50 < total ? <Link href={{ query: { ...sp, page: page + 1 } }} className="underline">Próxima →</Link> : null}
      </div>
    </div>
  );
}
