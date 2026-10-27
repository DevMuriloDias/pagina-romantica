import QRCode from "qrcode";
import { appUrl } from "@/lib/env";
import { getPublicPage } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { contrastRatio } from "@/lib/theme";

type Ctx = { params: Promise<{ slug: string }> };

/** QR Code da página em PNG ou SVG, com as cores do tema (garantindo contraste para leitura). */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) return new Response("Not found", { status: 404 });
  const { theme } = pageView(page);
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const dark = contrastRatio(theme.colors.primary, "#ffffff") >= 3 ? theme.colors.primary : theme.colors.text;
  const dl = new URL(req.url).searchParams.get("download") === "1";
  const opts = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark, light: "#ffffff" } };
  const url = appUrl(`/p/${slug}`);
  const headers: Record<string, string> = { "Cache-Control": "public, max-age=3600" };
  if (dl) headers["Content-Disposition"] = `attachment; filename="qrcode-${slug}.${format}"`;
  if (format === "svg") {
    return new Response(await QRCode.toString(url, { ...opts, type: "svg", width: 1024 }), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  const buf = await QRCode.toBuffer(url, { ...opts, type: "png", width: 1024 });
  return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Type": "image/png" } });
}
