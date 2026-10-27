import { Table, Td } from "@/components/admin";
import { Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function Webhooks() {
  const events = await db.paymentEvent.findMany({ orderBy: { createdAt: "desc" }, take: 150 });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Webhooks recebidos</h1>
      <Table head={["Recebido", "Tópico / ação", "ID do pagamento", "Assinatura", "Resultado", "Payload"]}>
        {events.map((e) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
            <Td>{e.topic ?? "—"}<div className="text-xs text-ink-soft">{e.action}</div></Td>
            <Td className="font-mono text-xs">{e.dataId}</Td>
            <Td><Badge tone={e.signatureValid ? "success" : "danger"}>{e.signatureValid ? "válida" : "inválida"}</Badge></Td>
            <Td>{e.error ? <span className="text-red-700">{e.error}</span> : e.result ?? (e.processedAt ? "ok" : "pendente")}</Td>
            <Td><details><summary className="cursor-pointer text-xs text-ink-soft">ver</summary><pre className="max-w-md overflow-x-auto text-[10px]">{JSON.stringify(e.payload, null, 2)}</pre></details></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
