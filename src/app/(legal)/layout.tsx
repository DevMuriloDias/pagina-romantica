import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Rascunho com placeholders.</strong> Este texto é um modelo inicial e deve ser revisado por um(a) advogado(a) antes da publicação. Substitua os campos entre [colchetes].
        </div>
        <article className="space-y-4 leading-relaxed text-ink [&_h1]:font-display [&_h1]:text-4xl [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_p]:text-ink-soft [&_li]:text-ink-soft">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
