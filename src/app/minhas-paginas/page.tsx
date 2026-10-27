import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getCustomerSession } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";
import { MyPagesForm } from "./MyPagesForm";
import { logout } from "./actions";

export const metadata = { title: "Minhas páginas", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "muted" | "danger" }> = {
  PUBLISHED: { label: "No ar", tone: "success" },
  PENDING_PAYMENT: { label: "Aguardando pagamento", tone: "warning" },
  DRAFT: { label: "Rascunho", tone: "muted" },
  UNPUBLISHED: { label: "Despublicada", tone: "danger" },
};

export default async function MyPages({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const email = await getCustomerSession();
  const pages = email
    ? await db.page.findMany({ where: { customer: { email }, status: { not: "DELETED" } }, orderBy: { updatedAt: "desc" } })
    : [];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60svh] max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl">Minhas páginas</h1>
        {erro ? <Alert tone="warning" className="mt-4">{erro === "link-invalido" ? "Esse link de edição não é mais válido. Peça um novo acesso abaixo." : "O link expirou. Peça um novo abaixo."}</Alert> : null}
        {!email ? (
          <div className="mt-6 max-w-md">
            <p className="text-ink-soft">Sem senha: informe o e-mail usado na compra e enviaremos um link de acesso.</p>
            <MyPagesForm />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-ink-soft">
              Conectado como <strong>{email}</strong> · <form action={logout} className="inline"><button className="underline">sair</button></form>
            </p>
            {pages.length === 0 ? <p className="text-ink-soft">Nenhuma página encontrada para este e-mail.</p> : null}
            {pages.map((p) => {
              const { content } = pageView(p);
              const s = STATUS[p.status] ?? STATUS.DRAFT!;
              return (
                <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl">Para {content.meta.recipientName || "seu amor"}</p>
                    <p className="text-sm text-ink-soft">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {p.publishedAt ? ` · publicada em ${formatDate(p.publishedAt)}` : ""}
                      {p.expiresAt ? ` · ativa até ${formatDate(p.expiresAt)}` : p.status === "PUBLISHED" ? " · vitalícia" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {p.status === "PUBLISHED" && p.slug ? <Button asChild size="sm" variant="outline"><a href={`/p/${p.slug}`} target="_blank" rel="noreferrer">Ver</a></Button> : null}
                    <Button asChild size="sm"><Link href={`/criar/editor?page=${p.id}`}>Editar</Link></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
