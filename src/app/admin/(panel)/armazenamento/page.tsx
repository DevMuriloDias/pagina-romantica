import Link from "next/link";
import { checkStorage } from "@/lib/storage-check";

export const dynamic = "force-dynamic";

/** Diagnóstico do Cloudflare R2 / S3: mostra a mensagem exata de erro do provedor (sem expor as chaves). */
export default async function StorageCheck({ searchParams }: { searchParams: Promise<{ rodar?: string }> }) {
  const { rodar } = await searchParams;
  const result = rodar ? await checkStorage() : null;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl">Testar armazenamento de fotos</h1>
      <p className="text-sm text-ink-soft">Grava, envia, lê e apaga um arquivo de teste no bucket, pelo servidor. As chaves aparecem mascaradas.</p>
      <Link href="/admin/armazenamento?rodar=1" className="inline-block rounded-full bg-rose px-5 py-2 text-sm font-medium text-white">Rodar teste</Link>
      {result ? (
        <>
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-xl">Configuração lida</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[220px_1fr]">
              {Object.entries(result.config).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-xs text-ink-soft">{k}</dt>
                  <dd className="break-all font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <ul className="space-y-2">
            {result.steps.map((s) => (
              <li key={s.name} className={`rounded-xl border p-3 text-sm ${s.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <strong>{s.ok ? "✅" : "❌"} {s.name}</strong>
                <p className="mt-1 break-all">{s.detail}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
