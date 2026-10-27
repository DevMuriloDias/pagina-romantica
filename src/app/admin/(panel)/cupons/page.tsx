import { revalidatePath } from "next/cache";
import { field, SmallButton, Table, Td } from "@/components/admin";
import { ConfirmSubmit } from "@/components/admin-confirm";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { formatBRL, formatDate } from "@/lib/format";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  const type = formData.get("type") === "FIXED" ? "FIXED" : "PERCENT";
  const raw = Number(String(formData.get("value") ?? "0").replace(",", "."));
  await db.coupon.create({
    data: {
      code: String(formData.get("code")).trim().toUpperCase(),
      type,
      value: type === "FIXED" ? Math.round(raw * 100) : Math.min(100, Math.max(1, Math.round(raw))),
      validFrom: formData.get("validFrom") ? new Date(`${formData.get("validFrom")}T00:00:00-03:00`) : null,
      validUntil: formData.get("validUntil") ? new Date(`${formData.get("validUntil")}T23:59:59-03:00`) : null,
      maxUses: formData.get("maxUses") ? Number(formData.get("maxUses")) : null,
    },
  });
  revalidatePath("/admin/cupons");
}

async function toggle(formData: FormData) {
  "use server";
  await requireAdmin();
  const c = await db.coupon.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  await db.coupon.update({ where: { id: c.id }, data: { active: !c.active } });
  revalidatePath("/admin/cupons");
}

async function remove(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const used = await db.order.count({ where: { couponId: id } });
  if (used) await db.coupon.update({ where: { id }, data: { active: false } });
  else await db.coupon.delete({ where: { id } });
  revalidatePath("/admin/cupons");
}

export default async function Coupons() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Cupons</h1>
      <form action={create} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-4">
        <label className="text-xs">Código<input name="code" required className={`${field} block w-32 uppercase`} /></label>
        <label className="text-xs">Tipo<select name="type" className={`${field} block`}><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></select></label>
        <label className="text-xs">Valor<input name="value" required className={`${field} block w-24`} placeholder="10" /></label>
        <label className="text-xs">Válido de<input name="validFrom" type="date" className={`${field} block`} /></label>
        <label className="text-xs">até<input name="validUntil" type="date" className={`${field} block`} /></label>
        <label className="text-xs">Limite de usos<input name="maxUses" type="number" min={1} className={`${field} block w-24`} /></label>
        <button className="h-9 rounded-full bg-rose px-4 text-sm font-medium text-white">Criar cupom</button>
      </form>
      <Table head={["Código", "Desconto", "Validade", "Usos", "Status", "Ações"]}>
        {coupons.map((c) => (
          <tr key={c.id}>
            <Td className="font-mono">{c.code}</Td>
            <Td>{c.type === "PERCENT" ? `${c.value}%` : formatBRL(c.value)}</Td>
            <Td>{c.validFrom ? formatDate(c.validFrom) : "—"} → {c.validUntil ? formatDate(c.validUntil) : "sem fim"}</Td>
            <Td>{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</Td>
            <Td><Badge tone={c.active ? "success" : "muted"}>{c.active ? "ativo" : "inativo"}</Badge></Td>
            <Td>
              <div className="flex gap-1">
                <form action={toggle}><input type="hidden" name="id" value={c.id} /><SmallButton>{c.active ? "Desativar" : "Ativar"}</SmallButton></form>
                <form action={remove}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit message="Excluir este cupom? (se já foi usado, será apenas desativado)">Excluir</ConfirmSubmit></form>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
