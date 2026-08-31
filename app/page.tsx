"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, revealed] as const;
}

function ArcMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8"
        stroke="var(--rasq-teal, #1D9E75)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5"
        stroke="var(--rasq-mint, #5DCAA5)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.5" fill="var(--rasq-teal, #1D9E75)" />
    </svg>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--rasq-border)] bg-[var(--rasq-void)]">
      <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <ArcMark size={20} />
          <span
            className="text-[15px] font-semibold tracking-[-0.02em] text-white"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            RASQ
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {(
            [
              ["Platform", "#platform"],
              ["Providers", "#providers"],
              ["Patients", "#patients"],
            ] as [string, string][]
          ).map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-[var(--rasq-r-btn)] px-3.5 py-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <Link
          href="/login"
          className="rounded-[var(--rasq-r-btn)] border border-[var(--rasq-border)] px-4 py-2 text-sm font-medium text-white transition hover:border-[var(--rasq-teal)]/35"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="bg-[var(--rasq-void)]" id="hero">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--rasq-mint)]/70"
              style={{ fontFamily: "var(--rasq-font-mono)" }}
            >
              Clinic-led rehabilitation platform
            </p>

            <h1
              className="mt-5 max-w-xl text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.025em] text-white lg:text-[2.75rem]"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              Connected rehabilitation from assessment to progress.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-white/55">
              RASQ supports clinicians with structured assessments, rehabilitation
              plans, and progress review — with the therapist at the center of care.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login?role=clinician"
                className="rounded-[var(--rasq-r-btn)] bg-[var(--rasq-teal)] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#179165]"
              >
                Clinician sign in
              </Link>
              <a
                href="#patients"
                className="rounded-[var(--rasq-r-btn)] border border-[var(--rasq-border)] px-6 py-2.5 text-sm font-medium text-white/75 transition hover:border-[var(--rasq-teal)]/30 hover:text-white"
              >
                Patient access
              </a>
            </div>
          </div>

          <div
            className="rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-base)] p-6 lg:p-7"
            aria-hidden="true"
          >
            <div className="rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-card)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Recovery plan</p>
                  <p className="mt-0.5 text-xs text-white/40">ACL rehabilitation · Phase 2</p>
                </div>
                <span className="rounded-[5px] border border-[var(--rasq-teal)]/25 bg-[var(--rasq-teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--rasq-mint)]">
                  In progress
                </span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-white/40">
                  <span>Plan completion</span>
                  <span style={{ fontFamily: "var(--rasq-font-mono)" }}>67%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--rasq-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--rasq-teal)]"
                    style={{ width: "67%" }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--rasq-border)] pt-5">
                {[
                  { label: "Sessions completed", value: "8 of 12" },
                  { label: "Last assessment", value: "Week 4" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[11px] text-white/35">{label}</p>
                    <p
                      className="mt-1 text-sm font-medium text-white"
                      style={{ fontFamily: "var(--rasq-font-mono)" }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[11px] leading-5 text-white/25">
              Illustrative workspace view. Measured values and AI-assisted drafts
              remain separate and require clinician review.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    "Co-designed with rehabilitation specialists",
    "Secure patient access via clinic-issued links",
    "Export-ready reports for clinical records",
  ];

  return (
    <section className="border-y border-[var(--rasq-border)] bg-[var(--rasq-base)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-[var(--rasq-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((text) => (
          <p key={text} className="px-6 py-5 text-sm leading-6 text-white/50">
            {text}
          </p>
        ))}
      </div>
    </section>
  );
}

const WORKFLOW_STEPS = [
  {
    label: "Assess",
    desc: "Structured functional assessments in clinic or through secure remote links.",
  },
  {
    label: "Plan",
    desc: "Assign rehabilitation plans and share patient portal access from your workspace.",
  },
  {
    label: "Track",
    desc: "Review sessions, adherence, and outcome data across the recovery pathway.",
  },
  {
    label: "Report",
    desc: "Generate export-ready clinical reports for review, referral, and records.",
  },
];

function WorkflowSection() {
  const [ref, revealed] = useReveal();

  return (
    <section
      id="platform"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[var(--rasq-void)] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--rasq-mint)]/75"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Platform
          </p>
          <h2
            className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-white lg:text-[1.75rem]"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            One workflow from assessment through recovery.
          </h2>
        </div>

        <div
          className={`rasq-reveal mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 ${revealed ? "is-revealed" : ""}`}
          style={{ transitionDelay: "60ms" }}
        >
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.label} className="border-t border-[var(--rasq-border)] pt-5">
              <p className="text-sm font-medium text-white">{step.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/40">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessSection() {
  const [ref, revealed] = useReveal();

  return (
    <section
      id="providers"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[var(--rasq-base)] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--rasq-mint)]/75"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Access
          </p>
          <h2
            className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-white lg:text-[1.75rem]"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            Built for clinical teams and patients.
          </h2>
        </div>

        <div
          className={`rasq-reveal mt-10 grid grid-cols-1 overflow-hidden rounded-[var(--rasq-r-lg)] border border-[var(--rasq-border)] lg:grid-cols-2 ${revealed ? "is-revealed" : ""}`}
          style={{ transitionDelay: "80ms" }}
        >
          <div className="flex flex-col p-8 lg:p-10" style={{ background: "var(--rasq-void)" }}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/35">
              For providers
            </p>
            <h3
              className="mt-2 text-xl font-semibold text-white"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              Clinician workspace
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
              Manage patients, run assessments, assign plans, and review progress
              from a single clinical workspace.
            </p>
            <div className="mt-7 space-y-2">
              <Link
                href="/login?role=clinician"
                className="flex items-center justify-between rounded-[var(--rasq-r-btn)] border border-[var(--rasq-teal)]/25 bg-[var(--rasq-teal)]/10 px-4 py-3 transition hover:bg-[var(--rasq-teal)]/14"
              >
                <div>
                  <p className="text-sm font-medium text-white">Clinician sign in</p>
                  <p className="text-xs text-white/40">Patients · Assessments · Plans · Sessions</p>
                </div>
                <span aria-hidden="true" className="text-white/25">
                  →
                </span>
              </Link>
              <Link
                href="/login?role=admin"
                className="flex items-center justify-between rounded-[var(--rasq-r-btn)] border border-[var(--rasq-border)] bg-[var(--rasq-card)] px-4 py-3 transition hover:border-[var(--rasq-teal)]/20"
              >
                <div>
                  <p className="text-sm font-medium text-white/80">Admin workspace</p>
                  <p className="text-xs text-white/30">Clinicians · Assignments · Overview</p>
                </div>
                <span aria-hidden="true" className="text-white/20">
                  →
                </span>
              </Link>
            </div>
          </div>

          <div
            id="patients"
            className="flex flex-col border-t border-[var(--rasq-border)] p-8 lg:border-l lg:border-t-0 lg:p-10"
            style={{ background: "var(--rasq-warm)" }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--rasq-warm-tx2)]">
              For patients
            </p>
            <h3
              className="mt-2 text-xl font-semibold text-[var(--rasq-warm-tx)]"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              Patient portal
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--rasq-warm-tx2)]">
              View your plan, complete guided sessions, and track progress through
              the secure link provided by your clinic.
            </p>
            <div className="mt-7 space-y-2">
              <div
                className="rounded-[var(--rasq-r-btn)] border border-[var(--rasq-warm-bd)] bg-white px-4 py-3"
                role="note"
              >
                <p className="text-sm font-medium text-[var(--rasq-warm-tx)]">
                  Use the link from your therapist
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--rasq-warm-tx2)]">
                  Patient access is issued by your clinic — not through public sign-up.
                </p>
              </div>
              <Link
                href="/assessment-access"
                className="flex items-center justify-between rounded-[var(--rasq-r-btn)] border border-[var(--rasq-warm-bd)] bg-white px-4 py-3 text-[var(--rasq-warm-tx)] transition hover:border-[var(--rasq-teal)]/35"
              >
                <div>
                  <p className="text-sm font-medium">I have an assessment link</p>
                  <p className="text-xs text-[var(--rasq-warm-tx2)]">
                    Enter your token to begin a remote assessment
                  </p>
                </div>
                <span aria-hidden="true" className="opacity-30">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--rasq-border)] bg-[var(--rasq-void)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.2fr_auto_auto]">
          <div>
            <div className="flex items-center gap-2.5">
              <ArcMark size={18} />
              <span
                className="text-[15px] font-semibold tracking-[-0.02em] text-white"
                style={{ fontFamily: "var(--rasq-font-display)" }}
              >
                RASQ
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
              Rehabilitation intelligence for clinical teams. Supports therapist
              review — not a substitute for clinical judgment.
            </p>
            <p className="mt-5 text-xs text-white/25">RASQ by Creative Motion Lab</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/30">
              Access
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                ["Clinician sign in", "/login?role=clinician"],
                ["Patient assessment link", "/assessment-access"],
                ["Admin sign in", "/login?role=admin"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/45 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/30">
              Governance
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                ["Clinical safety", "/clinical-safety"],
                ["Intended use", "/intended-use"],
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/45 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--rasq-border)] pt-6">
          <p className="text-xs text-white/25">
            © 2026 Creative Motion Lab. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div
      className="min-h-screen bg-[var(--rasq-void)] text-white"
      style={{ fontFamily: "var(--rasq-font-body)" }}
    >
      <Navbar />
      <main>
        <HeroSection />
        <TrustBar />
        <WorkflowSection />
        <AccessSection />
      </main>
      <Footer />
    </div>
  );
}
