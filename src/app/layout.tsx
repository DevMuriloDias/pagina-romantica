import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Instrument_Sans } from "next/font/google";
import { BRAND } from "@/config";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "WONK", "opsz"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `${BRAND.name} — páginas românticas personalizadas`, template: `%s · ${BRAND.name}` },
  description: "Crie uma página romântica única para quem você ama: cartinhas, fotos, música, linha do tempo e surpresas. Pronta em minutos, com ajuda de IA.",
  openGraph: { type: "website", locale: "pt_BR", siteName: BRAND.name },
};

export const viewport: Viewport = {
  themeColor: "#fbf6f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${instrument.variable} ${caveat.variable}`}>
      <body className="min-h-svh">{children}</body>
    </html>
  );
}
