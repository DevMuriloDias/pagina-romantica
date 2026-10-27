import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/SiteHeader";
import { adminLogout, requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/paginas", "Páginas"],
  ["/admin/planos", "Planos"],
  ["/admin/cupons", "Cupons"],
  ["/admin/templates", "Templates"],
  ["/admin/webhooks", "Webhooks"],
  ["/admin/emails", "E-mails"],
] as const;

async function logout() {
  "use server";
  await adminLogout();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-svh bg-cream/40">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Logo className="text-base" />
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-ink/5 hover:text-ink">{label}</Link>
            ))}
          </nav>
          <form action={logout} className="ml-auto text-sm text-ink-soft">
            {admin.email} · <button className="underline">sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
