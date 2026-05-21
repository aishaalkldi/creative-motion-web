"use client";

import Link from "next/link";

const STAT_CARDS = [
  { label: "Total Clinicians",  value: "—",   note: "Connect backend" },
  { label: "Active Patients",   value: "—",   note: "Connect backend" },
  { label: "Assessments This Week", value: "—", note: "Connect backend" },
  { label: "Sessions This Week",    value: "—", note: "Connect backend" },
];

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/admin",           active: true  },
  { label: "Clinicians", href: "/admin/clinicians", active: false },
  { label: "Patients",   href: "/admin/patients",   active: false },
  { label: "Settings",   href: "/admin/settings",   active: false },
];

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen bg-[#0B1220]" style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}>

      {/* Sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#1E2D42] bg-[#0B1220] md:flex">
        <div className="flex h-14 items-center border-b border-[#1E2D42] px-5">
          <Link href="/" className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="10" cy="10" r="1.5" fill="#1D9E75"/>
            </svg>
            <span className="text-[15px] font-bold tracking-[-0.03em] text-white">RASQ</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 min-h-[44px] rounded-[7px] px-3 py-2.5 text-sm transition ${
                item.active
                  ? "border border-[#1D9E75]/20 bg-[#1D9E75]/12 font-semibold text-[#5DCAA5]"
                  : "border border-transparent font-medium text-white/45 hover:bg-[#0F1825] hover:text-white/80"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#1E2D42] p-3">
          <div className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2.5">
            <p className="text-xs font-semibold text-white/60">Admin Portal</p>
            <p className="text-[11px] text-white/30">System management</p>
          </div>
          <Link
            href="/login"
            className="mt-2 flex w-full items-center gap-2 rounded-[7px] px-3 py-2.5 text-sm font-medium text-white/30 transition hover:bg-[#0F1825] hover:text-rose-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">

        {/* Top bar */}
        <div className="flex h-14 items-center justify-between border-b border-[#1E2D42] px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white">Admin Dashboard</h1>
            <span className="rounded-[5px] border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              MVP
            </span>
          </div>
          <Link href="/clinician" className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:text-white">
            Clinician Portal →
          </Link>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-5xl px-6 py-7">

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STAT_CARDS.map((s) => (
              <div key={s.label} className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-5 py-4">
                <p className="text-[11px] font-medium text-white/40">{s.label}</p>
                <p
                  className="mt-2 text-2xl font-bold text-white/30"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                >
                  {s.value}
                </p>
                <p className="mt-1 text-[10px] text-white/20">{s.note}</p>
              </div>
            ))}
          </div>

          {/* Coming soon notice */}
          <div className="mt-8 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0B1220]">
              <svg className="h-6 w-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-base font-bold text-white/40">Admin portal in development</p>
            <p className="mt-1.5 text-sm text-white/25">
              Clinician management, patient overview, and system settings will appear here.
            </p>
            <Link
              href="/clinician"
              className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165]"
            >
              Go to Clinician Portal →
            </Link>
          </div>

          {/* Quick links */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Manage Clinicians", href: "/admin/clinicians", note: "Coming soon" },
              { label: "Patient Overview",  href: "/admin/patients",   note: "Coming soon" },
              { label: "System Settings",   href: "/admin/settings",   note: "Coming soon" },
            ].map(({ label, href, note }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded-[10px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3.5 transition hover:border-[#1D9E75]/25"
              >
                <div>
                  <p className="text-sm font-semibold text-white/60">{label}</p>
                  <p className="mt-0.5 text-[11px] text-white/25">{note}</p>
                </div>
                <svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
