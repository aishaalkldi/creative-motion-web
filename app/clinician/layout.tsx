"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { clearAuthSession, getClinician, type ClinicianInfo } from "../lib/auth";
import { hasDevAuthSession } from "../lib/dev-auth";
import { supabaseSignOut } from "../lib/supabase/provider";

// ── Nav items ──────────────────────────────────────────────────────────────────

const NAV_ITEMS_EN = [
  {
    href: "/clinician",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/clinician/patients",
    label: "Patients",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/clinician/assessments",
    label: "Assessment Center",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v.008H9v-.008zm0 3.75v.008H9V15zm0 3.75v.008H9v-.008zM15 11.25v.008h-.008V11.25zm0 3.75v.008h-.008V15zm0 3.75v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: "/clinician/plans/new",
    label: "Plans",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/clinician/results",
    label: "Results",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const NAV_ITEMS_AR = [
  {
    href: "/clinician",
    label: "لوحة التحكم",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/clinician/patients",
    label: "المرضى",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/clinician/assessments",
    label: "مركز التقييم",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v.008H9v-.008zm0 3.75v.008H9V15zm0 3.75v.008H9v-.008zM15 11.25v.008h-.008V11.25zm0 3.75v.008h-.008V15zm0 3.75v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: "/clinician/plans/new",
    label: "الخطط",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/clinician/results",
    label: "النتائج",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

// ── NavLink ────────────────────────────────────────────────────────────────────

function NavLink({ href, children, icon }: { href: string; children: React.ReactNode; icon: React.ReactNode }) {
  const pathname = usePathname();
  // Dashboard links are exact-match; section roots use prefix match
  const isActive =
    href === "/clinician"
      ? pathname === "/clinician" || pathname === "/clinician/dashboard"
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`relative flex min-h-[44px] items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-sm transition ${
        isActive
          ? "border-[var(--brand)]/25 bg-[var(--brand-soft)] font-semibold text-[var(--brand)] shadow-sm"
          : "border-transparent font-medium text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      {isActive && (
        <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-[var(--brand)]" aria-hidden />
      )}
      {icon}
      {children}
    </Link>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { language } = useGlobalLanguage();
  const [clinician] = useState<ClinicianInfo | null>(() => getClinician());
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDevBypass] = useState(() => hasDevAuthSession());

  const NAV_ITEMS = language === "ar" ? NAV_ITEMS_AR : NAV_ITEMS_EN;

  function handleLogout() {
    // Sign out from Supabase (clears Supabase session cookies)
    void supabaseSignOut();
    // Clear FastAPI JWT + localStorage auth keys
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  const initials = clinician?.full_name
    ? clinician.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* ── Sidebar ── */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface)] md:flex">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
          <Link href="/clinician" className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="shrink-0">
              <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="var(--brand)" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="10" cy="10" r="1.5" fill="var(--brand)"/>
            </svg>
            <span className="text-[16px] font-bold tracking-[-0.03em] text-[var(--foreground)]">RASQ</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Theme + Dev badge */}
        <div className="mx-3 mb-3 flex items-center justify-between gap-2">
          <ThemeToggle isArabic={language === "ar"} />
          {isDevBypass && (
            <span className="flex items-center gap-1.5 rounded-[8px] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-2.5 py-1">
              <svg className="h-3 w-3 shrink-0 text-[var(--warning)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-[11px] font-semibold text-[var(--warning)]">{language === "ar" ? "وضع التطوير" : "DEV"}</span>
            </span>
          )}
        </div>

        {/* User chip */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--brand-soft)] text-xs font-bold text-[var(--brand)]">
                {initials}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{clinician?.full_name ?? (language === "ar" ? "طبيب" : "Clinician")}</p>
                <p className="truncate text-[11px] text-[var(--muted)]">{clinician?.email ?? "—"}</p>
              </div>
              <svg className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-card-hover)]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  {language === "ar" ? "تسجيل الخروج" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
        <Link href="/clinician" className="flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="var(--brand)" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="1.5" fill="var(--brand)"/>
          </svg>
          <span className="text-sm font-bold tracking-[-0.03em] text-[var(--foreground)]">RASQ</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle isArabic={language === "ar"} />
          {isDevBypass && (
            <span className="rounded-[6px] border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">DEV</span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40"
          >
            {language === "ar" ? "تسجيل الخروج" : "Sign out"}
          </button>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
        {NAV_ITEMS.map((item) => (
          <MobileNavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 bg-[var(--background)] pb-16 pt-14 md:pb-0 md:pt-0">
        {children}
      </main>
    </div>
  );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const pathname = usePathname();
  const isActive = href === "/clinician" ? pathname === "/clinician" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${
        isActive ? "text-[var(--brand)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
