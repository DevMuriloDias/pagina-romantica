import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const s3Origins = [
  "https://*.r2.cloudflarestorage.com",
  "https://*.amazonaws.com",
  process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL).origin : "",
]
  .filter(Boolean)
  .join(" ");

const mp = "https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com https://*.mlstatic.com https://http2.mlstatic.com";

// CSP compatível com YouTube, Spotify, Mercado Pago (Bricks), Google Fonts e tiles do OpenStreetMap.
// 'unsafe-inline' em scripts é necessário para o bootstrap do Next sem nonce; ver DECISIONS.md.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://www.youtube.com https://s.ytimg.com https://sdk.mercadopago.com ${mp}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // compressão de fotos no navegador roda num Web Worker criado a partir de blob:
  "worker-src 'self' blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${s3Origins} ${mp} https://api.mercadopago.com ${isDev ? "ws:" : ""}`,
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com ${mp}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
]
  .join("; ")
  .replace(/\s+/g, " ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@prisma/client", "bcryptjs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/p/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
