import { ImageResponse } from "next/og";
import { getPublicPage } from "@/lib/pages/public";
import { pageView } from "@/lib/pages/service";
import { DEFAULT_TEMPLATE } from "@/lib/theme";

export const alt = "Uma surpresa para você 💌";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagem de prévia bonita, nas cores do tema, SEM revelar nomes, fotos ou textos. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug).catch(() => null);
  const theme = page ? pageView(page).theme : DEFAULT_TEMPLATE.theme;
  const { primary, secondary, background, text } = theme.colors;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${background}, ${secondary})`, color: text }}>
        <svg width="180" height="180" viewBox="0 0 24 24">
          <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.4 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.4 0 5.8 3.3 4.3 6.8C19.5 16.4 12 21 12 21z" fill={primary} />
        </svg>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, marginTop: 24 }}>Uma surpresa para você</div>
        <div style={{ display: "flex", fontSize: 34, marginTop: 18, color: primary }}>Abra com carinho — e com o som ligado</div>
      </div>
    ),
    size,
  );
}
