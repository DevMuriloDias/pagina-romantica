import { Stat } from "@/components/admin";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";

/** Início do dia/mês no fuso de São Paulo (UTC-3). */
function spStart(kind: "day" | "month") {
  const now = new Date(Date.now() - 3 * 3600_000);
  const d = kind === "day" ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return new Date(d + 3 * 3600_000);
}

export default async function Dashboard() {
  const day = spStart("day");
  const month = spStart("month");
  const last30 = new Date(Date.now() - 30 * 86_400_000);
  const [today, monthAgg, drafts30, paid30, pending, reports, failedEmails] = await Promise.all([
    db.order.aggregate({ where: { status: "APPROVED", paidAt: { gte: day } }, _sum: { amountCents: true }, _count: true }),
    db.order.aggregate({ where: { status: "APPROVED", paidAt: { gte: month } }, _sum: { amountCents: true }, _count: true, _avg: { amountCents: true } }),
    db.page.count({ where: { createdAt: { gte: last30 } } }),
    db.page.count({ where: { createdAt: { gte: last30 }, publishedAt: { not: null } } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.pageEvent.count({ where: { type: "REPORT", createdAt: { gte: last30 } } }),
    db.emailLog.count({ where: { status: "FAILED" } }),
  ]);
  const conversion = drafts30 ? (paid30 / drafts30) * 100 : 0;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vendas hoje" value={formatBRL(today._sum.amountCents ?? 0)} hint={`${today._count} pedido(s)`} />
        <Stat label="Vendas no mês" value={formatBRL(monthAgg._sum.amountCents ?? 0)} hint={`${monthAgg._count} pedido(s)`} />
        <Stat label="Ticket médio (mês)" value={formatBRL(Math.round(monthAgg._avg.amountCents ?? 0))} />
        <Stat label="Conversão (30 dias)" value={`${conversion.toFixed(1)}%`} hint={`${paid30} pagos de ${drafts30} rascunhos`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pedidos pendentes" value={String(pending)} />
        <Stat label="Denúncias (30 dias)" value={String(reports)} />
        <Stat label="E-mails com falha" value={String(failedEmails)} hint="O cron tenta reenviar automaticamente" />
      </div>
    </div>
  );
}
