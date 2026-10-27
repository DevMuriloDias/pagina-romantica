import { revalidatePath } from "next/cache";
import { SmallButton, Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { retryDelivery } from "@/lib/email";
import { formatDateTime } from "@/lib/format";

async function retry(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  await db.emailLog.update({ where: { id }, data: { status: "PENDING" } });
  await retryDelivery(id, 1);
  revalidatePath("/admin/emails");
}

export default async function Emails() {
  const emails = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 150 });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">E-mails enviados</h1>
      <Table head={["Data", "Para", "Modelo", "Status", "Tentativas", ""]}>
        {emails.map((e) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
            <Td>{e.to}</Td>
            <Td>{e.template}<div className="text-xs text-ink-soft">{e.subject}</div></Td>
            <Td><Badge tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "warning"}>{e.status}</Badge>{e.error ? <div className="text-xs text-red-700">{e.error}</div> : null}</Td>
            <Td>{e.attempts}</Td>
            <Td>{e.status !== "SENT" ? <form action={retry}><input type="hidden" name="id" value={e.id} /><SmallButton>Tentar de novo</SmallButton></form> : null}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
