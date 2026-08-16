import type { Metadata } from "next";
import Script from "next/script";
import { Inter, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { GlobalLanguageProvider } from "@/app/components/GlobalLanguageProvider";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import "./globals.css";

/* Runs before hydration to set the .dark class synchronously — avoids a flash of the wrong theme. */
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('rasq-theme');
    var resolved = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

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
      suppressHydrationWarning
      className={`h-full antialiased ${inter.variable} ${ibmPlexMono.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <Script id="rasq-no-flash-theme" strategy="beforeInteractive">
          {NO_FLASH_THEME_SCRIPT}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]"
        style={{ fontFamily: "var(--font-inter, ui-sans-serif, system-ui, sans-serif)" }}
      >
        <ThemeProvider>
          <GlobalLanguageProvider>{children}</GlobalLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
