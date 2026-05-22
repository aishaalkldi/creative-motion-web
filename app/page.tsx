"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════════════
   Hooks
   ═══════════════════════════════════════════════════════════════════════════ */

function useReveal(threshold = 0.2) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRevealed(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, revealed] as const;
}

function useCountUp(target: number, duration = 600, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return val;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RASQ Arc Mark
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Section 1 — Navbar (52px sticky)
   ═══════════════════════════════════════════════════════════════════════════ */

function Navbar() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-[#1E2D42] bg-[#080E14]"
      style={{ height: "52px" }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <ArcMark size={20} animate />
          <span
            className="text-[15px] font-bold tracking-[-0.03em] text-white"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            RASQ
          </span>
        </Link>

        {/* Primary nav — action-oriented, no Solutions, no Support */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {(
            [
              ["Assess",    "#platform"],
              ["Treat",     "#platform"],
              ["Track",     "#platform"],
              ["Providers", "#providers"],
              ["Patients",  "#patients"],
            ] as [string, string][]
          ).map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-[7px] px-3.5 py-2 text-sm text-white/40 transition-colors hover:bg-[#0F1825] hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <Link
          href="/login"
          className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-5 py-2 text-sm font-semibold text-white transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5]"
        >
          Login
        </Link>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 2 — Hero (55 / 45 grid)
   ═══════════════════════════════════════════════════════════════════════════ */

function HeroSection() {
  const [statsRef, statsRevealed] = useReveal(0.4);
  const c1 = useCountUp(94, 600, statsRevealed);
  const c2 = useCountUp(12, 600, statsRevealed);
  const c3 = useCountUp(6, 600, statsRevealed);

  return (
    <section
      className="relative overflow-hidden bg-[#080E14]"
      id="hero"
    >
      {/* Subtle ambient glow — behind left copy only */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px] opacity-[0.06]"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, var(--rasq-teal) 0%, transparent 68%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[55fr_45fr] lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="flex flex-col">

            {/* Eyebrow */}
            <div
              className="rasq-stagger-item inline-flex w-fit items-center gap-2 rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-1.5"
              style={{ animationDelay: "0ms" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]"
                style={{ boxShadow: "0 0 6px #1D9E75" }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5DCAA5]/80"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                CLINIC-LED REMOTE REHABILITATION PLATFORM
              </span>
            </div>

            {/* Headline */}
            <h1
              className="rasq-stagger-item mt-6 text-[2.4rem] font-bold leading-[1.08] tracking-[-0.025em] text-white lg:text-[2.85rem]"
              style={{
                animationDelay: "40ms",
                fontFamily: "var(--rasq-font-display)",
              }}
            >
              Clinic-led remote rehabilitation<br />
              <span className="text-white/55">from assessment to progress tracking.</span>
            </h1>

            {/* Tagline — muted, below headline, not competing */}
            <p
              className="rasq-stagger-item mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-white/30"
              style={{ animationDelay: "80ms" }}
            >
              Rehabilitation, precisely.
            </p>

            {/* Subheadline */}
            <p
              className="rasq-stagger-item mt-4 max-w-xl text-base leading-7 text-white/45"
              style={{ animationDelay: "120ms" }}
            >
              RASQ by Creative Motion Lab — a clinic-led remote rehabilitation platform.
              Assess patients, assign plans, track adherence, and export clinical reports
              from one clinician workspace.
            </p>

            {/* CTAs */}
            <div
              className="rasq-stagger-item mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "160ms" }}
            >
              <Link
                href="/login?role=clinician"
                className="rounded-[7px] bg-[#1D9E75] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#179165]"
              >
                For Providers
              </Link>
              <a
                href="#patients"
                className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-6 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#1D9E75]/30 hover:text-white"
              >
                For Patients
              </a>
            </div>

            {/* Stats */}
            <div
              ref={statsRef as React.RefObject<HTMLDivElement>}
              className="rasq-stagger-item mt-10 grid grid-cols-3 divide-x divide-[#1E2D42] border border-[#1E2D42] rounded-[10px] overflow-hidden"
              style={{ animationDelay: "200ms" }}
            >
              {[
                { val: c1, suffix: "%", label: "Session adherence" },
                { val: c2, suffix: "+", label: "Assessment templates" },
                { val: c3, suffix: " pathways", label: "Specialty rehab" },
              ].map(({ val, suffix, label }) => (
                <div key={label} className="flex flex-col items-center px-4 py-4 bg-[#0F1825]">
                  <span
                    className="text-2xl font-bold text-white"
                    style={{ fontFamily: "var(--rasq-font-mono)" }}
                  >
                    {val}
                    <span className="text-sm text-[#5DCAA5]">{suffix}</span>
                  </span>
                  <span className="mt-1 text-[11px] text-white/35 text-center leading-4">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Live product UI cards — in a styled viewport wrapper ── */}
          <div
            className="rasq-stagger-item rounded-[10px] p-8 flex flex-col gap-3"
            style={{
              animationDelay: "100ms",
              background: "#0B1220",
              border: "0.5px solid #1E2D42",
            }}
          >
            {/* Card 1 — Patient recovery card */}
            <div
              className="rounded-[10px] p-5"
              style={{
                background: "var(--rasq-card)",
                border: "0.5px solid var(--rasq-border)",
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  Patient
                </span>
                <span
                  className="text-[10px] font-semibold text-[#5DCAA5]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  Week 4 / 8
                </span>
              </div>

              {/* Patient info */}
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Sarah Al-Ahmad</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    ACL Rehabilitation &nbsp;·&nbsp; Phase 2
                  </p>
                </div>
                <span className="mt-0.5 rounded-[5px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5DCAA5]">
                  Active
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-white/35">Recovery Progress</span>
                  <span
                    className="text-[11px] font-semibold text-[#5DCAA5]"
                    style={{ fontFamily: "var(--rasq-font-mono)" }}
                  >
                    67%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#1E2D42]">
                  <div
                    className="h-full rounded-full bg-[#1D9E75]"
                    style={{ width: "67%" }}
                  />
                </div>
              </div>

              {/* Metrics row */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-[#1E2D42] rounded-[8px] border border-[#1E2D42] overflow-hidden">
                {[
                  { label: "Knee Bend", val: "108°" },
                  { label: "Leg Balance", val: "74%" },
                  { label: "Sessions", val: "8/12" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col items-center px-2 py-2.5">
                    <span
                      className="text-sm font-bold text-white"
                      style={{ fontFamily: "var(--rasq-font-mono)" }}
                    >
                      {val}
                    </span>
                    <span className="mt-0.5 text-[10px] text-white/30 text-center leading-3">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2 — RASQ Intelligence */}
            <div
              className="rounded-[10px] p-5"
              style={{
                background: "var(--rasq-card)",
                border: "0.5px solid var(--rasq-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  RASQ Intelligence
                </span>
                <span className="rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#5DCAA5]/70">
                  AI · Draft
                </span>
              </div>

              <ul className="mt-4 space-y-3">
                {[
                  "Phase 2 clearance criteria met. Consider advancing to dynamic control exercises next session.",
                  "Load symmetry improved 11% since last assessment. Single-leg progression recommended.",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D9E75]"
                      style={{ marginTop: "5px" }}
                    />
                    <span className="text-xs leading-5 text-white/55">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 border-t border-[#1E2D42] pt-3 text-[10px] text-white/20">
                Clinical decision support · Therapist review required before implementing
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 3 — Trust bar
   ═══════════════════════════════════════════════════════════════════════════ */

function TrustBar() {
  const [ref, revealed] = useReveal(0.3);

  const items = [
    "Clinical workflows co-designed with rehabilitation specialists",
    "Tokenised patient access — no login required for remote assessments",
    "Export-ready clinical reports — structured for clinician review and referral",
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`border-y border-[#1E2D42] bg-[#0B1220] rasq-reveal ${revealed ? "is-revealed" : ""}`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-[#1E2D42] px-6 py-0 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((text) => (
          <div key={text} className="px-6 py-5">
            <span className="text-sm leading-5 text-white/45">{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 4 — Workflow (5 steps + animated connector)
   ═══════════════════════════════════════════════════════════════════════════ */

const WORKFLOW_STEPS = [
  { num: "01", label: "Assess", desc: "Structured MSK and functional assessments — in-clinic or via secure remote links." },
  { num: "02", label: "Report", desc: "Review patient submissions and generate clinician-reviewed clinical reports." },
  { num: "03", label: "Plan", desc: "Assign rehabilitation plans and share secure patient portal access." },
  { num: "04", label: "Track", desc: "Patient sessions and adherence tracking with session-level outcome data." },
  { num: "05", label: "Export", desc: "Progress snapshots and export-ready clinical reports for your records." },
];

function WorkflowSection() {
  const [ref, revealed] = useReveal(0.2);

  return (
    <section
      id="platform"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[#080E14] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Platform
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            One platform. Assessment through recovery.
          </h2>
        </div>

        {/* Steps */}
        <div
          className={`rasq-reveal-children mt-12 grid grid-cols-1 gap-8 sm:grid-cols-5 ${revealed ? "is-revealed" : ""}`}
        >
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.num} className="relative flex flex-col">
              {/* Connector — rendered as sibling overlay, not inside the step */}
              {i < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`rasq-connector absolute left-[calc(100%+0px)] top-[22px] hidden h-px w-full bg-[#1E2D42] sm:block ${revealed ? "is-revealed" : ""}`}
                  style={{ width: "calc(100% - 44px)", left: "calc(50% + 22px)" }}
                />
              )}
              {/* Step badge */}
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0F1825]">
                <span
                  className="text-xs font-bold text-[#5DCAA5]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {step.num}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{step.label}</p>
              <p className="mt-1.5 text-xs leading-5 text-white/35">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 5 — Intelligence proof
   ═══════════════════════════════════════════════════════════════════════════ */

const RECOVERY_TIMELINE = [
  { week: "Week 1", title: "Initial Assessment", detail: "Pain 6/10 · ROM 72° · Phase 1 initiated" },
  { week: "Week 3", title: "Progress Check", detail: "Pain 3/10 · ROM 88° · Movement quality improving" },
  { week: "Week 6", title: "Phase Transition", detail: "Phase 1 complete · Cleared for Phase 2 exercises" },
  { week: "Week 8", title: "Strength Review", detail: "Load symmetry 74% · Dynamic control exercises added" },
  { week: "Week 10", title: "Return Assessment", detail: "Return to sport evaluation — scheduled", pending: true },
];

const INTELLIGENCE_ITEMS = [
  { signal: "Movement quality", value: "87/100", status: "On track", note: "Consistent with Phase 2 progression targets" },
  { signal: "Load symmetry", value: "74%", status: "Improving", note: "+11% since initial assessment · Single-leg progression indicated" },
  { signal: "Range of motion", value: "108°", status: "On track", note: "Target 130° · Continue current exercise protocol" },
];

function IntelligenceSection() {
  const [ref, revealed] = useReveal(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[#0B1220] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Intelligence proof
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            From first session to full recovery.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">
            RASQ supports the clinician workflow from remote assessment through plan
            assignment and progress review — with decision-support drafts for therapist review.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
          {/* Recovery timeline */}
          <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`} style={{ transitionDelay: "80ms" }}>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.1em] text-white/30">
              Patient journey — Sarah Al-Ahmad
            </p>
            <div className="relative space-y-0">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[#1E2D42]" />
              {RECOVERY_TIMELINE.map((item) => (
                <div key={item.week} className="relative flex gap-5 pb-6 last:pb-0">
                  <div
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      item.pending
                        ? "border-[#1E2D42] bg-[#0B1220]"
                        : "border-[#1D9E75]/40 bg-[#0B1220]"
                    }`}
                  >
                    {item.pending ? (
                      <span className="h-2 w-2 rounded-full border border-[#1E2D42]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[#1D9E75]" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[10px] font-bold text-[#5DCAA5]"
                        style={{ fontFamily: "var(--rasq-font-mono)" }}
                      >
                        {item.week}
                      </span>
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/35">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RASQ Intelligence panel */}
          <div
            className={`rasq-reveal rounded-[10px] ${revealed ? "is-revealed" : ""}`}
            style={{
              background: "var(--rasq-card)",
              border: "0.5px solid var(--rasq-border)",
              transitionDelay: "140ms",
            }}
          >
            <div className="flex items-center justify-between border-b border-[#1E2D42] px-5 py-4">
              <div className="flex items-center gap-2">
                <ArcMark size={14} />
                <span
                  className="text-xs font-bold text-white"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  RASQ Intelligence
                </span>
              </div>
              <span className="rounded-[5px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#5DCAA5]/70">
                Week 8 · Draft
              </span>
            </div>

            <div className="divide-y divide-[#1E2D42]">
              {INTELLIGENCE_ITEMS.map((item) => (
                <div key={item.signal} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/55">{item.signal}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold text-white"
                        style={{ fontFamily: "var(--rasq-font-mono)" }}
                      >
                        {item.value}
                      </span>
                      <span className="rounded-[5px] bg-[#1D9E75]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5DCAA5]">
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-white/30">{item.note}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#1E2D42] px-5 py-3">
              <p className="text-[10px] text-white/20">
                Clinical decision support · Not a diagnosis · Therapist review required
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 6 — Dual pathway (dark provider / light patient)
   ═══════════════════════════════════════════════════════════════════════════ */

function DualPathwaySection() {
  const [ref, revealed] = useReveal(0.15);

  return (
    <section
      id="providers"
      ref={ref as React.RefObject<HTMLElement>}
      className={`rasq-reveal overflow-hidden ${revealed ? "is-revealed" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Access
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            Built for providers and patients.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 overflow-hidden rounded-[12px] border border-[#1E2D42] lg:grid-cols-2">

          {/* Provider — dark */}
          <div
            className={`rasq-reveal flex flex-col p-8 ${revealed ? "is-revealed" : ""}`}
            style={{ background: "var(--rasq-base)", transitionDelay: "80ms" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0F1825] text-[#5DCAA5]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">
              For Providers
            </p>
            <h3
              className="mt-1.5 text-xl font-bold text-white"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              Provider Workspace
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-white/40">
              Manage patients, run assessments, prescribe rehabilitation plans,
              review clinical reports, and track outcomes — for solo therapists
              to multidisciplinary teams.
            </p>
            <div className="mt-6 space-y-2">
              <Link
                href="/login?role=clinician"
                className="flex items-center justify-between rounded-[7px] border border-[#1D9E75]/25 bg-[#1D9E75]/10 px-4 py-3 transition hover:bg-[#1D9E75]/16 group"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Clinician Workspace</p>
                  <p className="text-xs text-white/35">Patients · Assessments · Plans · Sessions</p>
                </div>
                <svg className="h-4 w-4 text-white/20 transition group-hover:text-[#5DCAA5]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link
                href="/login?role=admin"
                className="flex items-center justify-between rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-4 py-3 transition hover:border-[#1D9E75]/20 group"
              >
                <div>
                  <p className="text-sm font-semibold text-white/70">Admin Workspace</p>
                  <p className="text-xs text-white/25">Clinicians · Assignments · Overview</p>
                </div>
                <svg className="h-4 w-4 text-white/15 transition group-hover:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Patient — light warm surface, all explicit hex values */}
          <div
            id="patients"
            className={`rasq-reveal flex flex-col border-t border-[#1E2D42] p-8 lg:border-l lg:border-t-0 ${revealed ? "is-revealed" : ""}`}
            style={{ background: "#F4F6F5", transitionDelay: "140ms" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#d1dbd6] bg-white text-[#1D9E75]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4a7060]">
              For Patients
            </p>
            <h3
              className="mt-1.5 text-xl font-bold text-[#0f2e22]"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              Patient Portal
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-[#4a7060]">
              View your plan, complete guided sessions, track progress, and access
              appointments through a secure clinic invitation.
            </p>
            <div className="mt-6 space-y-2">
              <Link
                href="/patient"
                className="group flex items-center justify-between rounded-[7px] border border-transparent bg-[#1D9E75] px-4 py-3 text-white transition hover:bg-[#179165]"
              >
                <div>
                  <p className="text-sm font-semibold">Open patient access</p>
                  <p className="text-xs opacity-70">Plan · Sessions · Progress · Results</p>
                </div>
                <svg className="h-4 w-4 opacity-50 transition group-hover:opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link
                href="/assessment-access"
                className="group flex items-center justify-between rounded-[7px] border border-[#d1dbd6] bg-white px-4 py-3 text-[#0f2e22] transition hover:border-[#1D9E75]/40"
              >
                <div>
                  <p className="text-sm font-semibold">I have an assessment link</p>
                  <p className="text-xs text-[#4a7060]">
                    Enter your token to begin a remote assessment
                  </p>
                </div>
                <svg className="h-4 w-4 text-[#0f2e22] opacity-25 transition group-hover:opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 7 — Future vision (RASQ Sense + RASQ Motion)
   ═══════════════════════════════════════════════════════════════════════════ */

function FutureVisionSection() {
  const [ref, revealed] = useReveal(0.15);

  const cards = [
    {
      id: "sense",
      name: "RASQ Sense",
      tagline: "Wearable motion intelligence",
      desc:
        "Continuous biomechanical data beyond the session — IMU-based motion capture, real-time load tracking, and movement quality scoring between clinic visits.",
      specs: ["IMU motion capture", "Real-time load analysis", "Between-session data"],
    },
    {
      id: "motion",
      name: "RASQ Motion",
      tagline: "Extended reality rehabilitation",
      desc:
        "Immersive, XR-guided rehabilitation sessions. Guided movement. Measurable outcomes. Clinician-prescribed protocols delivered in extended reality.",
      specs: ["XR-guided sessions", "Clinician-prescribed", "Measurable outcomes"],
    },
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[#080E14] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            What&apos;s next
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            Rehabilitation intelligence, extended.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/40">
            Rehabilitation intelligence, wherever care happens.
          </p>
        </div>

        <div
          className={`mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 rasq-reveal-children ${revealed ? "is-revealed" : ""}`}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative flex flex-col rounded-[10px] p-6"
              style={{
                background: "var(--rasq-card)",
                border: "0.5px solid var(--rasq-border)",
              }}
            >
              {/* Coming soon badge */}
              <span
                className="absolute right-4 top-4 rounded-[5px] border border-[#1E2D42] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/25"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                Coming 2026
              </span>

              {/* Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#1E2D42] bg-[#0B1220] text-[#5DCAA5]">
                {card.id === "sense" ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304-.002a3.75 3.75 0 010 5.304m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                  </svg>
                )}
              </div>

              <p
                className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#5DCAA5]/60"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                {card.tagline}
              </p>
              <h3
                className="mt-1 text-lg font-bold text-white"
                style={{ fontFamily: "var(--rasq-font-display)" }}
              >
                {card.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/40">{card.desc}</p>

              <ul className="mt-5 space-y-1.5">
                {card.specs.map((spec) => (
                  <li key={spec} className="flex items-center gap-2 text-xs text-white/30">
                    <span className="h-1 w-1 rounded-full bg-[#1D9E75]/50" />
                    {spec}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 8 — Footer
   ═══════════════════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-[#1E2D42] bg-[#080E14]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1fr_auto_auto_auto]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <ArcMark size={18} />
              <span
                className="text-[15px] font-bold tracking-[-0.03em] text-white"
                style={{ fontFamily: "var(--rasq-font-display)" }}
              >
                RASQ
              </span>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-white/30">
              Rehabilitation, precisely.
            </p>
            <p className="mt-4 text-[11px] text-white/20">
              RASQ by Creative Motion Lab
            </p>
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">Platform</p>
            <ul className="mt-3 space-y-2.5">
              {[["Clinician Workspace", "/login?role=clinician"], ["Patient Portal", "/patient"], ["Admin Workspace", "/login?role=admin"], ["Remote Assessment", "/assessment-access"]].map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="text-xs text-white/35 transition hover:text-white">{l}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">Product</p>
            <ul className="mt-3 space-y-2.5">
              {[["Assessments", "#platform"], ["Treatment Plans", "#platform"], ["Therapy Sessions", "#platform"], ["RASQ Sense", "#"], ["RASQ Motion", "#"]].map(([l, h]) => (
                <li key={l}>
                  <a href={h} className="text-xs text-white/35 transition hover:text-white">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Security */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">Trust</p>
            <ul className="mt-3 space-y-2.5">
              {["Privacy-conscious", "Tokenised patient access", "Export-ready reports", "Clinical-grade UX"].map((l) => (
                <li key={l} className="text-xs text-white/35">{l}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#1E2D42] pt-8 sm:flex-row sm:items-center">
          <p className="text-[11px] text-white/20">
            © 2026 Creative Motion Lab. All rights reserved.
          </p>
          <p
            className="text-[11px] text-white/15"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            Secure · Privacy-conscious · Built for clinical workflows
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div
      className="min-h-screen bg-[#080E14] text-white"
      style={{ fontFamily: "var(--rasq-font-body)" }}
    >
      <Navbar />
      <HeroSection />
      <TrustBar />
      <WorkflowSection />
      <IntelligenceSection />
      <DualPathwaySection />
      <FutureVisionSection />
      <Footer />
    </div>
  );
}
