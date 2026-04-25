"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuthSession, getClinician, type ClinicianInfo } from "../lib/auth";

export default function ClinicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [clinician, setClinician] = useState<ClinicianInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setClinician(getClinician());
  }, []);

  function handleLogout() {
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  const initials = clinician?.full_name
    ? clinician.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen flex-col bg-[#071a2f]">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/8 bg-[#071a2f]/90 px-5 backdrop-blur-md">
        {/* Left — logo / nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/clinician"
            className="text-sm font-bold tracking-wide text-cyan-300 hover:text-cyan-200"
          >
            Creative Motion
          </Link>

          <nav className="hidden items-center gap-4 md:flex">
            <NavLink href="/clinician/patients">Patients</NavLink>
            <NavLink href="/clinician/assessment/start">Assess</NavLink>
            <NavLink href="/live-results">Results</NavLink>
            <NavLink href="/library">Library</NavLink>
            {/* TODO: Gate /sessions behind feature flag or role when rehab assignments are persisted server-side. */}
            <NavLink href="/sessions">Programs</NavLink>
          </nav>
        </div>

        {/* Right — user chip */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
          >
            {/* Avatar */}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300">
              {initials}
            </span>

            {clinician ? (
              <span className="hidden max-w-[160px] truncate text-sm font-medium text-white sm:block">
                {clinician.full_name}
              </span>
            ) : (
              <span className="hidden text-sm text-white/50 sm:block">Loading…</span>
            )}

            {/* Chevron */}
            <svg
              className={`h-3.5 w-3.5 text-white/50 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0d2245] p-3 shadow-xl"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {/* User info */}
              <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-xs text-white/50">Signed in as</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">
                  {clinician?.full_name ?? "—"}
                </p>
                <p className="truncate text-xs text-cyan-300/80">
                  {clinician?.email ?? "—"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <Link
                  href="/clinician"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  href="/clinician/patients"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
                >
                  My Patients
                </Link>
                <Link
                  href="/sessions"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
                >
                  Programs / Sessions
                </Link>
                <Link
                  href="/therapy"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/8 hover:text-white"
                >
                  Gait therapy
                </Link>
                <div className="my-1 border-t border-white/8" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-sm text-white/65 transition hover:bg-white/8 hover:text-white"
    >
      {children}
    </Link>
  );
}
