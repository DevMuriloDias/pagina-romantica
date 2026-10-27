import { redirect } from "next/navigation";
import { Logo } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { clientIp } from "@/lib/api";
import { adminLogin, getAdmin } from "@/lib/admin/auth";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const ip = await clientIp();
  const rl = await rateLimit("admin-login", ip, LIMITS.adminLogin.limit, LIMITS.adminLogin.window);
  if (!rl.ok) redirect("/admin/login?erro=limite");
  const ok = await adminLogin(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin/login?erro=1");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center bg-cream px-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-white p-6">
        <Logo />
        <h1 className="font-display text-2xl">Painel administrativo</h1>
        {erro ? <Alert tone="danger">{erro === "limite" ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha incorretos."}</Alert> : null}
        <Input name="email" type="email" placeholder="E-mail" required autoComplete="username" aria-label="E-mail" />
        <Input name="password" type="password" placeholder="Senha" required autoComplete="current-password" aria-label="Senha" />
        <Button type="submit" className="w-full">Entrar</Button>
      </form>
    </main>
  );
}
