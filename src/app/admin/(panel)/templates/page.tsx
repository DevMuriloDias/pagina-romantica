import { revalidatePath } from "next/cache";
import { SmallButton, Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseTheme } from "@/lib/theme";

async function toggle(formData: FormData) {
  "use server";
  await requireAdmin();
  const t = await db.template.findUniqueOrThrow({ where: { id: String(formData.get("id")) } });
  await db.template.update({ where: { id: t.id }, data: { active: !t.active } });
  revalidatePath("/admin/templates");
}

async function move(formData: FormData) {
  "use server";
  await requireAdmin();
  const all = await db.template.findMany({ orderBy: { sortOrder: "asc" } });
  const idx = all.findIndex((t) => t.id === formData.get("id"));
  const swap = idx + Number(formData.get("dir"));
  if (idx < 0 || swap < 0 || swap >= all.length) return;
  const order = [...all];
  [order[idx], order[swap]] = [order[swap]!, order[idx]!];
  await db.$transaction(order.map((t, i) => db.template.update({ where: { id: t.id }, data: { sortOrder: i } })));
  revalidatePath("/admin/templates");
}

export default async function Templates() {
  const templates = await db.template.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Templates</h1>
      <Table head={["Ordem", "Template", "Cores", "Status", "Ações"]}>
        {templates.map((t, i) => {
          const theme = parseTheme(t.theme);
          return (
            <tr key={t.id}>
              <Td>{i + 1}</Td>
              <Td><strong>{t.name}</strong><div className="text-xs text-ink-soft">{t.description}</div></Td>
              <Td><div className="flex gap-1">{Object.values(theme.colors).map((c, j) => <span key={j} className="size-4 rounded-full ring-1 ring-line" style={{ background: c }} />)}</div></Td>
              <Td><Badge tone={t.active ? "success" : "muted"}>{t.active ? "ativo" : "inativo"}</Badge></Td>
              <Td>
                <div className="flex gap-1">
                  <form action={move}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="-1" /><SmallButton disabled={i === 0}>↑</SmallButton></form>
                  <form action={move}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="1" /><SmallButton disabled={i === templates.length - 1}>↓</SmallButton></form>
                  <form action={toggle}><input type="hidden" name="id" value={t.id} /><SmallButton>{t.active ? "Desativar" : "Ativar"}</SmallButton></form>
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
