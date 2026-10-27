import Link from "next/link";
import { BRAND } from "@/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2 font-display text-xl tracking-tight text-ink", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-full bg-rose text-white shadow-[0_6px_16px_-6px_rgba(194,38,79,0.8)] transition-transform group-hover:rotate-[-8deg]">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.4 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.4 0 5.8 3.3 4.3 6.8C19.5 16.4 12 21 12 21z" fill="currentColor" />
        </svg>
      </span>
      <span className="italic">{BRAND.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/#como-funciona" className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink sm:inline">Como funciona</Link>
          <Link href="/#modelos" className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink sm:inline">Modelos</Link>
          <Link href="/minhas-paginas" className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink">Minhas páginas</Link>
          <Button asChild size="sm" className="ml-1">
            <Link href="/criar">Criar página</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-cream/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">{BRAND.tagline}. Feito com carinho no Brasil.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-ink">Produto</p>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li><Link href="/criar" className="hover:text-rose">Criar minha página</Link></li>
            <li><Link href="/minhas-paginas" className="hover:text-rose">Minhas páginas</Link></li>
            <li><Link href="/#faq" className="hover:text-rose">Perguntas frequentes</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-ink">Legal</p>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li><Link href="/termos" className="hover:text-rose">Termos de Uso</Link></li>
            <li><Link href="/privacidade" className="hover:text-rose">Política de Privacidade</Link></li>
            <li><a href={`mailto:${BRAND.supportEmail}`} className="hover:text-rose">{BRAND.supportEmail}</a></li>
          </ul>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-ink-soft/70">© {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.</p>
    </footer>
  );
}
