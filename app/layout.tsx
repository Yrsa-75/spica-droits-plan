import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Plan SPICA Droits",
  description: "Plan de construction de la plateforme de gestion des droits SPICA, bloc par bloc.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
