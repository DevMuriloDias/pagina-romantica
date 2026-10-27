import { env } from "@/lib/env";
import { getObject } from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

/** Serve arquivos processados no modo local (em produção as imagens vêm do CDN do bucket). */
export async function GET(_req: Request, { params }: Ctx) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Not found", { status: 404 });
  const { key } = await params;
  const path = key.join("/");
  if (path.includes("/raw/") || !path.endsWith(".webp")) return new Response("Not found", { status: 404 });
  const file = await getObject(path).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
