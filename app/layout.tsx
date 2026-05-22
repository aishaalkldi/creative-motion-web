import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

/* ── Fonts ────────────────────────────────────────────────────────────────── */

// Body — Inter (clean, readable, widely trusted in medical-tech SaaS)
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Display / Hero — Space Grotesk (geometric, premium, used by modern health-tech)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",  // keep --font-geist var name for @theme compatibility
  display: "swap",
});

// Data / Reports — IBM Plex Mono (clinical precision for numbers and reports)
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/* ── Metadata ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "RASQ — Rehabilitation, precisely.",
  description:
    "RASQ by Creative Motion Lab — clinic-led remote rehabilitation platform. Assess patients, assign plans, track adherence, and export clinical reports.",
  openGraph: {
    title: "RASQ — Rehabilitation, precisely.",
    description:
      "RASQ by Creative Motion Lab — clinic-led remote rehabilitation platform. Assess patients, assign plans, track adherence, and export clinical reports.",
  },
};

/* ── Root layout ──────────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${ibmPlexMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#080E14] text-[#e8edf2]" style={{ fontFamily: "var(--font-inter, ui-sans-serif, system-ui, sans-serif)" }}>
        {children}
      </body>
    </html>
  );
}
