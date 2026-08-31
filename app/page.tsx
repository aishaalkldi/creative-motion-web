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

function ArcMark({ size = 20, animate = false }: { size?: number; animate?: boolean }) {
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
        className={animate ? "rasq-arc-outer" : ""}
      />
      <path
        d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5"
        stroke="var(--rasq-mint, #5DCAA5)"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={animate ? "rasq-arc-inner" : ""}
      />
      <circle
        cx="10"
        cy="10"
        r="1.5"
        fill="var(--rasq-teal, #1D9E75)"
        className={animate ? "rasq-arc-dot" : ""}
      />
    </svg>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--rasq-border)] bg-[var(--rasq-void)]/95">
      <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <ArcMark size={20} animate />
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

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
      <div
        className="rasq-hero-ambient absolute -left-8 top-6 h-[360px] w-[360px] opacity-80 lg:-left-12 lg:top-0 lg:h-[440px] lg:w-[440px]"
        aria-hidden="true"
      />

      <div className="rasq-preview-stack relative">
        <div
          className="absolute right-0 top-6 z-0 w-[78%] rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-base)] p-4 shadow-[0_24px_48px_-32px_rgba(0,0,0,0.75)] lg:right-2 lg:top-8"
          aria-hidden="true"
        >
          <p
            className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/30"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Session progress
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { label: "Guided session 8", state: "Completed" },
              { label: "Guided session 9", state: "Scheduled" },
            ].map(({ label, state }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[6px] border border-[var(--rasq-border)] bg-[var(--rasq-card)] px-3 py-2"
              >
                <span className="text-xs text-white/55">{label}</span>
                <span
                  className={`text-[10px] font-medium ${
                    state === "Completed" ? "text-[var(--rasq-mint)]" : "text-white/30"
                  }`}
                >
                  {state}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative z-10 rounded-[var(--rasq-r-lg)] border border-[var(--rasq-border)] bg-[var(--rasq-base)] p-5 shadow-[0_32px_64px_-40px_rgba(0,0,0,0.85)] lg:p-6"
          aria-hidden="true"
        >
          <div className="rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-card)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/30"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  Clinician workspace
                </p>
                <p className="mt-2 text-sm font-medium text-white">Recovery plan</p>
                <p className="mt-0.5 text-xs text-white/40">Lower limb rehabilitation</p>
              </div>
              <span className="rounded-[5px] border border-[var(--rasq-teal)]/25 bg-[var(--rasq-teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--rasq-mint)]">
                Active
              </span>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-white/40">
                <span>Plan status</span>
                <span style={{ fontFamily: "var(--rasq-font-mono)" }}>In progress</span>
              </div>
              <div className="rasq-progress-sweep h-1.5 w-full rounded-full bg-[var(--rasq-border)]">
                <div
                  className="h-full rounded-full bg-[var(--rasq-teal)]"
                  style={{ width: "62%" }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--rasq-border)] pt-5">
              {[
                { label: "Sessions completed", value: "8 of 12" },
                { label: "Next review", value: "Week 5" },
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

            <div className="mt-4 rounded-[6px] border border-[var(--rasq-border)] bg-[var(--rasq-void)] px-3 py-2.5">
              <p className="text-[11px] text-white/45">
                Therapist review · Draft notes ready for clinician review
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-5 text-[11px] leading-5 text-white/30">
        Illustrative demo UI — example workspace views only, not live patient data.
      </p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--rasq-void)]" id="hero">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <div
              className="rasq-stagger-item inline-flex items-center rounded-[6px] border border-[var(--rasq-border)] bg-[var(--rasq-base)] px-3 py-1.5"
              style={{ animationDelay: "0ms" }}
            >
              <span
                className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--rasq-mint)]/75"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                Clinic-led rehabilitation platform
              </span>
            </div>

            <h1
              className="rasq-stagger-item mt-6 max-w-xl text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.025em] text-white lg:text-[2.85rem]"
              style={{
                animationDelay: "60ms",
                fontFamily: "var(--rasq-font-display)",
              }}
            >
              Rehabilitation, connected from assessment to progress.
            </h1>

            <p
              className="rasq-stagger-item mt-5 max-w-lg text-base leading-7 text-white/55"
              style={{ animationDelay: "120ms" }}
            >
              AI-assisted rehabilitation that helps clinicians assess, guide rehabilitation,
              and follow patient progress — with the clinician at the center of care.
            </p>

            <p
              className="rasq-stagger-item mt-4 text-sm font-medium tracking-[0.06em] text-white/30"
              style={{ animationDelay: "160ms" }}
            >
              Rehabilitation, precisely.
            </p>

            <div
              className="rasq-stagger-item mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "200ms" }}
            >
              <Link
                href="/login?role=clinician"
                className="rounded-[var(--rasq-r-btn)] bg-[var(--rasq-teal)] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#179165]"
              >
                For providers
              </Link>
              <a
                href="#patients"
                className="rounded-[var(--rasq-r-btn)] border border-[var(--rasq-border)] bg-[var(--rasq-base)] px-6 py-2.5 text-sm font-medium text-white/75 transition hover:border-[var(--rasq-teal)]/30 hover:text-white"
              >
                Patient access
              </a>
            </div>
          </div>

          <div className="rasq-stagger-item" style={{ animationDelay: "100ms" }}>
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueSection() {
  const [ref, revealed] = useReveal(0.2);
  const items = [
    {
      label: "Assess",
      text: "Structured functional assessments in clinic or through secure remote links.",
    },
    {
      label: "Guide rehabilitation",
      text: "Assign plans and support guided sessions with the clinician directing care.",
    },
    {
      label: "Track progress",
      text: "Review session completion, adherence, and progress for therapist follow-up.",
    },
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`border-y border-[var(--rasq-border)] bg-[var(--rasq-base)] rasq-reveal ${revealed ? "is-revealed" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-14 lg:py-16">
        <p
          className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--rasq-mint)]/75"
          style={{ fontFamily: "var(--rasq-font-mono)" }}
        >
          Clinical workflow
        </p>
        <h2
          className="mt-3 max-w-2xl text-xl font-semibold tracking-tight text-white lg:text-2xl"
          style={{ fontFamily: "var(--rasq-font-display)" }}
        >
          From assessment through recovery — with the therapist in control.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {items.map((item, index) => (
            <div
              key={item.label}
              className="rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-card)] p-5"
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              <p
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--rasq-mint)]/70"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-2 text-sm font-medium text-white">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/40">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLATFORM_STEPS = [
  {
    label: "Assess",
    desc: "Run structured assessments and review patient submissions in one workspace.",
  },
  {
    label: "Plan",
    desc: "Prescribe rehabilitation plans and issue secure patient portal access.",
  },
  {
    label: "Track",
    desc: "Monitor guided sessions, adherence, and progress across the care pathway.",
  },
  {
    label: "Report",
    desc: "Export clinical reports structured for review, referral, and records.",
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
            One platform for clinical rehabilitation teams.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
            A connected workspace for assessment, plan assignment, session review,
            and export-ready reporting.
          </p>
        </div>

        <div
          className={`rasq-reveal-children mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 ${revealed ? "is-revealed" : ""}`}
        >
          {PLATFORM_STEPS.map((step, index) => (
            <div
              key={step.label}
              className="relative rounded-[var(--rasq-r-card)] border border-[var(--rasq-border)] bg-[var(--rasq-base)] p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--rasq-border)] bg-[var(--rasq-card)]">
                <span
                  className="text-[11px] font-medium text-[var(--rasq-mint)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-white">{step.label}</p>
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
          className={`rasq-reveal mt-10 grid grid-cols-1 overflow-hidden rounded-[var(--rasq-r-lg)] border border-[var(--rasq-border)] shadow-[0_32px_64px_-48px_rgba(0,0,0,0.8)] lg:grid-cols-2 ${revealed ? "is-revealed" : ""}`}
          style={{ transitionDelay: "80ms" }}
        >
          <div className="flex flex-col p-8 lg:p-10" style={{ background: "var(--rasq-void)" }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--rasq-border)] bg-[var(--rasq-card)] text-[var(--rasq-mint)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.1em] text-white/35">
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
                <span aria-hidden="true" className="text-white/25">→</span>
              </Link>
              <Link
                href="/login?role=admin"
                className="flex items-center justify-between rounded-[var(--rasq-r-btn)] border border-[var(--rasq-border)] bg-[var(--rasq-card)] px-4 py-3 transition hover:border-[var(--rasq-teal)]/20"
              >
                <div>
                  <p className="text-sm font-medium text-white/80">Admin workspace</p>
                  <p className="text-xs text-white/30">Clinicians · Assignments · Overview</p>
                </div>
                <span aria-hidden="true" className="text-white/20">→</span>
              </Link>
            </div>
          </div>

          <div
            id="patients"
            className="flex flex-col border-t border-[var(--rasq-border)] p-8 lg:border-l lg:border-t-0 lg:p-10"
            style={{ background: "var(--rasq-warm)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--rasq-warm-bd)] bg-white text-[var(--rasq-teal)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.1em] text-[var(--rasq-warm-tx2)]">
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
                <span aria-hidden="true" className="opacity-30">→</span>
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
              Rehabilitation, precisely. Supports therapist review — not a substitute
              for clinical judgment.
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
        <ValueSection />
        <WorkflowSection />
        <AccessSection />
      </main>
      <Footer />
    </div>
  );
}
