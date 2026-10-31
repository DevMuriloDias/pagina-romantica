import { clientIp, enforceRate } from "@/lib/api";
import { env } from "@/lib/env";
import { getObject } from "@/lib/storage";

/**
 * Serve uma foto do bucket pelo nosso próprio domínio. Usado no editor para recortar
 * e extrair a paleta: o navegador só deixa ler os pixels de imagens do mesmo domínio.
 * Aceita apenas URLs do bucket configurado (S3_PUBLIC_URL), nunca endereços arbitrários.
 */
export async function GET(req: Request) {
  const src = new URL(req.url).searchParams.get("src") ?? "";
  const base = env().S3_PUBLIC_URL?.replace(/\/$/, "");
  if (!base || !src.startsWith(`${base}/`)) return new Response("Not found", { status: 404 });
  const key = decodeURIComponent(src.slice(base.length + 1));
  if (!/^pages\/[a-zA-Z0-9/_.-]+\.webp$/.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  try {
    await enforceRate("img-proxy", await clientIp(), 300, 600);
  } catch {
    return new Response("Too many requests", { status: 429 });
  }
  const file = await getObject(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
