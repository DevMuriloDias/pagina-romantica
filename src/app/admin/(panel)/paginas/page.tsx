import type { PageStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { field, SmallButton, Table, Td } from "@/components/admin";
import { ConfirmSubmit } from "@/components/admin-confirm";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { pageView, setPageStatus } from "@/lib/pages/service";
import { deletePrefix } from "@/lib/storage";

async function unpublish(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  await setPageStatus(id, "UNPUBLISHED", `Admin: ${String(formData.get("reason") || "denúncia")}`, { unpublishedReason: String(formData.get("reason") || "Denúncia") });
  revalidatePath("/admin/paginas");
}

async function republish(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const paid = await db.order.findFirst({ where: { pageId: id, status: "APPROVED" } });
  if (!paid) return;
  await setPageStatus(id, "PUBLISHED", "Admin: republicada", { unpublishedReason: null });
  revalidatePath("/admin/paginas");
}

async function destroy(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const assets = await db.asset.findMany({ where: { pageId: id }, select: { key: true } });
  await deletePrefix(assets.map((a) => a.key));
  await db.asset.deleteMany({ where: { pageId: id } });
  await setPageStatus(id, "DELETED", "Admin: excluída", { content: {}, theme: {}, slug: null, gateHashes: [], editTokenHash: null });
  revalidatePath("/admin/paginas");
}

export default async function Pages({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; reported?: string }> }) {
  const sp = await searchParams;
  const where: Prisma.PageWhereInput = {
    ...(sp.status ? { status: sp.status as PageStatus } : { status: { not: "DELETED" } }),
    ...(sp.q ? { OR: [{ id: sp.q }, { slug: { contains: sp.q.toLowerCase() } }, { customer: { email: { contains: sp.q.toLowerCase() } } }] } : {}),
    ...(sp.reported ? { events: { some: { type: "REPORT" } } } : {}),
  };
  const pages = await db.page.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { customer: { select: { email: true } }, _count: { select: { events: { where: { type: "REPORT" } } } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Páginas</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Slug, e-mail ou ID" className={`${field} w-64`} />
        <select name="status" defaultValue={sp.status ?? ""} className={field}>
          <option value="">Todas (exceto excluídas)</option>
          {["DRAFT", "PENDING_PAYMENT", "PUBLISHED", "UNPUBLISHED", "DELETED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="reported" value="1" defaultChecked={Boolean(sp.reported)} /> Só denunciadas</label>
        <button className="rounded-full bg-ink px-4 text-sm text-white">Buscar</button>
      </form>
      <Table head={["Atualizada", "Para", "Cliente", "Status", "Denúncias", "Link", "Ações"]}>
        {pages.map((p) => {
          const { content } = pageView(p);
          return (
            <tr key={p.id}>
              <Td className="whitespace-nowrap">{formatDateTime(p.updatedAt)}<div className="text-[10px] text-ink-soft">{p.id}</div></Td>
              <Td>{content.meta.recipientName || "—"}</Td>
              <Td>{p.customer?.email ?? "—"}</Td>
              <Td><Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "UNPUBLISHED" ? "danger" : "muted"}>{p.status}</Badge>{p.unpublishedReason ? <div className="text-[10px] text-red-700">{p.unpublishedReason}</div> : null}</Td>
              <Td>{p._count.events ? <Badge tone="danger">{p._count.events}</Badge> : "0"}</Td>
              <Td>{p.slug ? <Link href={`/p/${p.slug}`} target="_blank" className="text-rose underline">{p.slug}</Link> : "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {p.status === "PUBLISHED" ? (
                    <form action={unpublish} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><input name="reason" placeholder="Motivo" className="h-7 w-28 rounded border border-line px-1 text-xs" /><ConfirmSubmit message="Despublicar esta página?">Despublicar</ConfirmSubmit></form>
                  ) : null}
                  {p.status === "UNPUBLISHED" ? <form action={republish}><input type="hidden" name="id" value={p.id} /><SmallButton>Republicar</SmallButton></form> : null}
                  {p.status !== "DELETED" ? <form action={destroy}><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Excluir a página e todas as fotos? Não dá para desfazer.">Excluir</ConfirmSubmit></form> : null}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
