import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="paper-grain flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl" aria-hidden>💔</p>
      <h1 className="mt-6 font-display text-4xl">Esta página não existe (ou não está mais no ar)</h1>
      <p className="mt-3 max-w-md text-ink-soft">Confira se o link foi copiado inteirinho. Se a página foi criada por você, acesse “Minhas páginas”.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/">Ir para o início</Link></Button>
        <Button asChild variant="outline"><Link href="/minhas-paginas">Minhas páginas</Link></Button>
      </div>
    </main>
  );
}
