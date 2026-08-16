"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import { ThemeToggle } from "@/app/components/ThemeToggle";

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

type UiLanguage = "en" | "ar";

const uiCopy = {
  en: {
    nav: {
      how: "How it works",
      providers: "For Providers",
      patients: "For Patients",
      login: "Login",
    },
    hero: {
      headline: "Clinic-led remote rehabilitation",
      headlineAccent: "from assessment to progress tracking.",
      tagline: "Rehabilitation, precisely.",
      subheadline:
        "RASQ by Creative Motion Lab — a clinic-led remote rehabilitation platform. Assess patients, assign plans, track adherence, and export clinical reports from one clinician workspace.",
      providers: "For Providers",
      patients: "For Patients",
      statsLabel: "Illustrative data",
      adherence: "Session adherence",
      templates: "Assessment templates",
      rehab: "Specialty rehab",
      panelPatient: "Patient",
      panelWeek: "Week 4 / 8",
      recovery: "Recovery Progress",
      knee: "Knee Bend",
      balance: "Leg Balance",
      sessions: "Sessions",
      intelligence: "RASQ Intelligence",
      aiDraft: "AI · Draft",
      aiBlurb1: "Phase 2 clearance criteria met. Consider advancing to dynamic control exercises next session.",
      aiBlurb2: "Load symmetry improved 11% since last assessment. Single-leg progression recommended.",
      decisionSupport: "Clinical decision support · Therapist review required before implementing",
    },
    trust: [
      "Clinical workflows co-designed with rehabilitation specialists",
      "Tokenised patient access — no login required for remote assessments",
      "Export-ready clinical reports — structured for clinician review and referral",
    ],
    workflow: {
      label: "Platform",
      title: "One platform. Assessment through recovery.",
      steps: [
        { num: "01", label: "Assess", desc: "Structured MSK and functional assessments — in-clinic or via secure remote links." },
        { num: "02", label: "Report", desc: "Review patient submissions and generate clinician-reviewed clinical reports." },
        { num: "03", label: "Plan", desc: "Assign rehabilitation plans and share secure patient portal access." },
        { num: "04", label: "Track", desc: "Patient sessions and adherence tracking with session-level outcome data." },
        { num: "05", label: "Export", desc: "Progress snapshots and export-ready clinical reports for your records." },
      ],
    },
    intelligence: {
      label: "Intelligence proof",
      title: "From first session to full recovery.",
      intro:
        "RASQ supports the clinician workflow from remote assessment through plan assignment and progress review — with decision-support drafts for therapist review.",
      patientJourney: "Patient journey — Sarah Al-Ahmad",
      signals: {
        movement: "Movement quality",
        load: "Load symmetry",
        rom: "Range of motion",
      },
      draft: "Week 8 · Draft",
      status: "On track",
      improving: "Improving",
    },
    access: {
      label: "Access",
      title: "Built for providers and patients.",
      provider: "For Providers",
      providerTitle: "Provider Workspace",
      providerDesc: "Manage patients, run assessments, prescribe rehabilitation plans, review clinical reports, and track outcomes — for solo therapists to multidisciplinary teams.",
      clinicianWorkspace: "Clinician Workspace",
      clinicianSub: "Patients · Assessments · Plans · Sessions",
      adminWorkspace: "Admin Workspace",
      adminSub: "Clinicians · Assignments · Overview",
      patient: "For Patients",
      patientTitle: "Patient Portal",
      patientDesc: "View your plan, complete guided sessions, track progress, and access appointments through a secure clinic invitation.",
      patientNote: "Use the secure link from your therapist",
      patientNoteSub: "Real patients receive a unique clinic link — not this website's demo pages.",
      assessmentLink: "I have an assessment link",
      assessmentLinkSub: "Enter your token to begin a remote assessment",
    },
    future: {
      label: "What's next",
      title: "Rehabilitation intelligence, extended.",
      intro: "Rehabilitation intelligence, wherever care happens.",
      sense: "RASQ Sense",
      senseTag: "Wearable motion intelligence",
      senseDesc:
        "Continuous biomechanical data beyond the session — IMU-based motion capture, real-time load tracking, and movement quality scoring between clinic visits.",
      motion: "RASQ Motion",
      motionTag: "Extended reality rehabilitation",
      motionDesc:
        "Immersive, XR-guided rehabilitation sessions. Guided movement. Measurable outcomes. Clinician-prescribed protocols delivered in extended reality.",
      coming: "Coming 2026",
    },
    footer: {
      platform: "Platform",
      product: "Product",
      trust: "Trust",
      privacy: "Privacy-conscious",
      secure: "Tokenised patient access",
      reports: "Export-ready reports",
      ux: "Clinical-grade UX",
      copyright: "© 2026 Creative Motion Lab. All rights reserved.",
      secureText: "Secure · Privacy-conscious · Built for clinical workflows",
    },
  },
  ar: {
    nav: {
      how: "كيف تعمل",
      providers: "لمقدمي الرعاية",
      patients: "للمرضى",
      login: "تسجيل الدخول",
    },
    hero: {
      headline: "إعادة تأهيل عن بُعد بقيادة العيادة",
      headlineAccent: "من التقييم إلى متابعة التقدم.",
      tagline: "إعادة التأهيل بدقة.",
      subheadline:
        "RASQ من Creative Motion Lab — منصة إعادة التأهيل عن بُعد بقيادة العيادة. قيّم المرضى، وقم بتعيين الخطط، ومتابعة الالتزام، وتصدير التقارير السريرية من واجهة واحدة.",
      providers: "للمقدمي الرعاية",
      patients: "للمرضى",
      statsLabel: "بيانات توضيحية",
      adherence: "التزام الجلسات",
      templates: "قوالب التقييم",
      rehab: "إعادة التأهيل المتخصصة",
      panelPatient: "المريض",
      panelWeek: "الأسبوع 4 / 8",
      recovery: "تقدم التعافي",
      knee: "انثناء الركبة",
      balance: "توازن الساق",
      sessions: "الجلسات",
      intelligence: "ذكاء RASQ",
      aiDraft: "ذكاء · مسودة",
      aiBlurb1: "تم تحقيق معايير الموافقة على المرحلة 2. فكر في التقدم إلى تمارين التحكم الديناميكي في الجلسة القادمة.",
      aiBlurb2: "تحسن تناسق الحمل بنسبة 11٪ منذ آخر تقييم. موصى بالتقدم على ساق واحدة.",
      decisionSupport: "دعم القرار السريري · يلزم مراجعة الطبيب قبل التنفيذ",
    },
    trust: [
      "مسارات سريرية تم تصميمها بالتعاون مع متخصصي إعادة التأهيل",
      "وصول مُميز للمرضى — لا يلزم تسجيل الدخول للتقييمات عن بُعد",
      "تقارير سريرية جاهزة للتصدير — منظمة لمراجعة الأطباء وإحالة المرضى",
    ],
    workflow: {
      label: "المنصة",
      title: "منصة واحدة. من التقييم إلى التعافي.",
      steps: [
        { num: "01", label: "التقييم", desc: "تقييمات هيكلية ووظيفية — داخل العيادة أو عبر روابط آمنة عن بُعد." },
        { num: "02", label: "التقرير", desc: "مراجعة طلبات المرضى وإنشاء تقارير سريرية مُراجعة من قبل الأطباء." },
        { num: "03", label: "الخطة", desc: "تعيين خطط إعادة التأهيل ومشاركة بوابة المريض الآمنة." },
        { num: "04", label: "المتابعة", desc: "جلسات المرضى ومتابعة الالتزام مع بيانات النتائج على مستوى الجلسة." },
        { num: "05", label: "التصدير", desc: "لقطات التقدم وتقارير سريرية جاهزة للتصدير لسجلاتك." },
      ],
    },
    intelligence: {
      label: "دليل الذكاء",
      title: "من الجلسة الأولى إلى التعافي الكامل.",
      intro:
        "يدعم RASQ سير عمل الطبيب من التقييم عن بُعد إلى تعيين الخطة ومراجعة التقدم — مع مسودات لدعم القرار تحتاج إلى مراجعة الطبيب.",
      patientJourney: "رحلة المريض — سارة الأحمد",
      signals: {
        movement: "جودة الحركة",
        load: "تناسق الحمل",
        rom: "نطاق الحركة",
      },
      draft: "الأسبوع 8 · مسودة",
      status: "على المسار الصحيح",
      improving: "يتحسن",
    },
    access: {
      label: "الوصول",
      title: "مصمم لمقدمي الرعاية والمرضى.",
      provider: "لمقدمي الرعاية",
      providerTitle: "مساحة مقدم الرعاية",
      providerDesc: "إدارة المرضى، تشغيل التقييمات، وصف خطط إعادة التأهيل، مراجعة التقارير السريرية، وتتبع النتائج — سواء لك فرديًا أو لفريق متعدد التخصصات.",
      clinicianWorkspace: "مساحة الطبيب",
      clinicianSub: "المرضى · التقييمات · الخطط · الجلسات",
      adminWorkspace: "مساحة الإدارة",
      adminSub: "الأطباء · التعيينات · النظرة العامة",
      patient: "للمرضى",
      patientTitle: "بوابة المريض",
      patientDesc: "اعرض خطتك، أكمل الجلسات الموجهة، وتتبع التقدم، وافتح المواعيد عبر رابط عيادة آمن.",
      patientNote: "استخدم الرابط الآمن من طبيبك",
      patientNoteSub: "يحصل المرضى الحقيقيون على رابط فريد من العيادة — وليس صفحات العرض التوضيحيّة في هذا الموقع.",
      assessmentLink: "لدي رابط تقييم",
      assessmentLinkSub: "أدخل رمزك للبدء بتقييم عن بعد",
    },
    future: {
      label: "ماذا بعد",
      title: "ذكاء إعادة التأهيل، ممتد.",
      intro: "ذكاء إعادة التأهيل، أينما يحدث الرعاية.",
      sense: "RASQ Sense",
      senseTag: "ذكاء الحركة القابل للارتداء",
      senseDesc:
        "بيانات حركية مستمرة ما بعد الجلسة — التقاط حركة IMU، وتتبع الحمل في الوقت الفعلي، وتقييم جودة الحركة بين زيارات العيادة.",
      motion: "RASQ Motion",
      motionTag: "إعادة التأهيل عبر الواقع الممتد",
      motionDesc:
        "جلسات إعادة تأهيل غامرة وموجهة عبر XR. حركة موجهة. نتائج قابلة للقياس. بروتوكولات موصى بها من الطبيب وتُقدَّم عبر الواقع الممتد.",
      coming: "قادم 2026",
    },
    footer: {
      platform: "المنصة",
      product: "المنتج",
      trust: "الثقة",
      privacy: "حساس للخصوصية",
      secure: "وصول مميز للمرضى",
      reports: "تقارير جاهزة للتصدير",
      ux: "تجربة سريرية متقدمة",
      copyright: "© 2026 Creative Motion Lab. جميع الحقوق محفوظة.",
      secureText: "آمن · حساس للخصوصية · مبني لسير العمل السريري",
    },
  },
} as const;

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
        stroke="var(--brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
        className={animate ? "rasq-arc-outer" : ""}
      />
      <path
        d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5"
        stroke="var(--brand)"
        strokeOpacity="0.55"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={animate ? "rasq-arc-inner" : ""}
      />
      <circle
        cx="10"
        cy="10"
        r="1.5"
        fill="var(--brand)"
        className={animate ? "rasq-arc-dot" : ""}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 1 — Navbar (60px sticky)
   ═══════════════════════════════════════════════════════════════════════════ */

function Navbar({ language }: { language: UiLanguage }) {
  const copy = uiCopy[language];
  const isArabic = language === "ar";

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur"
      style={{ height: "60px" }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <ArcMark size={22} animate />
          <span
            className="text-[16px] font-bold tracking-[-0.03em] text-[var(--foreground)]"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            RASQ
          </span>
        </Link>

        {/* Primary nav — simplified: How it works / Providers / Patients */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {(
            [
              [copy.nav.how, "#platform"],
              [copy.nav.providers, "#providers"],
              [copy.nav.patients, "#patients"],
            ] as [string, string][]
          ).map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-[9px] px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle isArabic={isArabic} />
          <Link
            href="/login"
            className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
          >
            {copy.nav.login}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 2 — Hero (55 / 45 grid)
   ═══════════════════════════════════════════════════════════════════════════ */

function HeroSection({ language }: { language: UiLanguage }) {
  const copy = uiCopy[language];
  const [statsRef, statsRevealed] = useReveal(0.4);
  const c1 = useCountUp(94, 600, statsRevealed);
  const c2 = useCountUp(12, 600, statsRevealed);
  const c3 = useCountUp(6, 600, statsRevealed);

  return (
    <section
      className="relative overflow-hidden bg-[var(--background)]"
      id="hero"
    >
      {/* Subtle ambient glow — behind left copy only */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px]"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, var(--brand-glow) 0%, transparent 68%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[55fr_45fr] lg:gap-16">

          {/* ── Left: Copy ── */}
          <div className="flex flex-col">

            {/* Headline */}
            <h1
              className="rasq-stagger-item text-[2.4rem] font-bold leading-[1.08] tracking-[-0.025em] text-[var(--foreground)] lg:text-[2.85rem]"
              style={{
                animationDelay: "0ms",
                fontFamily: "var(--rasq-font-display)",
              }}
            >
              {copy.hero.headline}
              <br />
              <span className="text-[var(--muted)]">{copy.hero.headlineAccent}</span>
            </h1>

            {/* Tagline — muted, below headline, not competing */}
            <p
              className="rasq-stagger-item mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-soft)]"
              style={{ animationDelay: "80ms" }}
            >
              {copy.hero.tagline}
            </p>

            {/* Subheadline */}
            <p
              className="rasq-stagger-item mt-4 max-w-xl text-base leading-7 text-[var(--muted)]"
              style={{ animationDelay: "120ms" }}
            >
              {copy.hero.subheadline}
            </p>

            {/* CTAs */}
            <div
              className="rasq-stagger-item mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "160ms" }}
            >
              <Link
                href="/login?role=clinician"
                className="rounded-[11px] bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-dark)]"
              >
                {copy.hero.providers}
              </Link>
              <a
                href="#patients"
                className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-6 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
              >
                {copy.hero.patients}
              </a>
            </div>

            {/* Stats */}
            <p
              className="rasq-stagger-item mt-10 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-soft)]"
              style={{ animationDelay: "200ms" }}
            >
              {copy.hero.statsLabel}
            </p>
            <div
              ref={statsRef as React.RefObject<HTMLDivElement>}
              className="rasq-stagger-item mt-2 grid grid-cols-3 divide-x divide-[var(--border)] border border-[var(--border)] rounded-[14px] overflow-hidden"
              style={{ animationDelay: "200ms" }}
            >
              {[
                { val: c1, suffix: "%", label: copy.hero.adherence },
                { val: c2, suffix: "+", label: copy.hero.templates },
                { val: c3, suffix: language === "ar" ? " مسارات" : " pathways", label: copy.hero.rehab },
              ].map(({ val, suffix, label }) => (
                <div key={label} className="flex flex-col items-center px-4 py-4 bg-[var(--surface-alt)]">
                  <span
                    className="text-2xl font-bold text-[var(--foreground)]"
                    style={{ fontFamily: "var(--rasq-font-mono)" }}
                  >
                    {val}
                    <span className="text-sm text-[var(--brand)]">{suffix}</span>
                  </span>
                  <span className="mt-1 text-[11px] text-[var(--muted)] text-center leading-4">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Live product UI cards — in a styled viewport wrapper ── */}
          <div
            className="rasq-stagger-item rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)] p-8 flex flex-col gap-3 shadow-[var(--shadow-card)]"
            style={{ animationDelay: "100ms" }}
          >
            {/* Card 1 — Patient recovery card */}
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-soft)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {copy.hero.panelPatient}
                </span>
                <span
                  className="text-[10px] font-semibold text-[var(--brand)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {copy.hero.panelWeek}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--muted)]">{copy.hero.recovery}</span>
                  <span
                    className="text-[11px] font-semibold text-[var(--brand)]"
                    style={{ fontFamily: "var(--rasq-font-mono)" }}
                  >
                    67%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand)]"
                    style={{ width: "67%" }}
                  />
                </div>
              </div>

              {/* Metrics row */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--border)] rounded-[10px] border border-[var(--border)] overflow-hidden">
                {[
                  { label: copy.hero.knee, val: "108°" },
                  { label: copy.hero.balance, val: "74%" },
                  { label: copy.hero.sessions, val: "8/12" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col items-center px-2 py-2.5">
                    <span
                      className="text-sm font-bold text-[var(--foreground)]"
                      style={{ fontFamily: "var(--rasq-font-mono)" }}
                    >
                      {val}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[var(--muted-soft)] text-center leading-3">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2 — RASQ Intelligence */}
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-soft)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {copy.hero.intelligence}
                </span>
                <span className="rounded-full border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                  {copy.hero.aiDraft}
                </span>
              </div>

              <ul className="mt-4 space-y-3">
                {[copy.hero.aiBlurb1, copy.hero.aiBlurb2].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
                      style={{ marginTop: "5px" }}
                    />
                    <span className="text-xs leading-5 text-[var(--muted)]">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--muted-soft)]">
                {copy.hero.decisionSupport}
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

function TrustBar({ language }: { language: UiLanguage }) {
  const [ref, revealed] = useReveal(0.3);
  const items = uiCopy[language].trust;

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`border-y border-[var(--border)] bg-[var(--surface-alt)] rasq-reveal ${revealed ? "is-revealed" : ""}`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-[var(--border)] px-6 py-0 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((text) => (
          <div key={text} className="px-6 py-5">
            <span className="text-sm leading-5 text-[var(--muted)]">{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 4 — Workflow (5 steps + animated connector)
   ═══════════════════════════════════════════════════════════════════════════ */

function WorkflowSection({ language }: { language: UiLanguage }) {
  const [ref, revealed] = useReveal(0.2);
  const copy = uiCopy[language].workflow;

  return (
    <section
      id="platform"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[var(--background)] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            {copy.label}
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            {copy.title}
          </h2>
        </div>

        {/* Steps */}
        <div
          className={`rasq-reveal-children mt-12 grid grid-cols-1 gap-8 sm:grid-cols-5 ${revealed ? "is-revealed" : ""}`}
        >
          {copy.steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col">
              {/* Connector — rendered as sibling overlay, not inside the step */}
              {i < copy.steps.length - 1 && (
                <div
                  className={`rasq-connector absolute left-[calc(100%+0px)] top-[22px] hidden h-px w-full bg-[var(--border)] sm:block ${revealed ? "is-revealed" : ""}`}
                  style={{ width: "calc(100% - 44px)", left: "calc(50% + 22px)" }}
                />
              )}
              {/* Step badge */}
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)]">
                <span
                  className="text-xs font-bold text-[var(--brand)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {step.num}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{step.label}</p>
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{step.desc}</p>
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

const RECOVERY_TIMELINE = {
  en: [
    { week: "Week 1", title: "Initial Assessment", detail: "Pain 6/10 · ROM 72° · Phase 1 initiated", pending: false },
    { week: "Week 3", title: "Progress Check", detail: "Pain 3/10 · ROM 88° · Movement quality improving", pending: false },
    { week: "Week 6", title: "Phase Transition", detail: "Phase 1 complete · Cleared for Phase 2 exercises", pending: false },
    { week: "Week 8", title: "Strength Review", detail: "Load symmetry 74% · Dynamic control exercises added", pending: false },
    { week: "Week 10", title: "Return Assessment", detail: "Return to sport evaluation — scheduled", pending: true },
  ],
  ar: [
    { week: "الأسبوع 1", title: "التقييم الأولي", detail: "الألم 6/10 · المدى 72° · بدأت المرحلة 1", pending: false },
    { week: "الأسبوع 3", title: "فحص التقدم", detail: "الألم 3/10 · المدى 88° · جودة الحركة تتحسن", pending: false },
    { week: "الأسبوع 6", title: "انتقال المرحلة", detail: "اكتملت المرحلة 1 · تم السماح بتمارين المرحلة 2", pending: false },
    { week: "الأسبوع 8", title: "مراجعة القوة", detail: "تناسق الحمل 74% · تم إضافة تمارين التحكم الديناميكي", pending: false },
    { week: "الأسبوع 10", title: "تقييم العودة", detail: "تقييم العودة إلى الرياضة — مجدول", pending: true },
  ],
} as const;

const INTELLIGENCE_ITEMS = {
  en: [
    { signal: "Movement quality", value: "87/100", status: "On track", note: "Consistent with Phase 2 progression targets" },
    { signal: "Load symmetry", value: "74%", status: "Improving", note: "+11% since initial assessment · Single-leg progression indicated" },
    { signal: "Range of motion", value: "108°", status: "On track", note: "Target 130° · Continue current exercise protocol" },
  ],
  ar: [
    { signal: "جودة الحركة", value: "87/100", status: "على المسار الصحيح", note: "متوافق مع أهداف تقدم المرحلة 2" },
    { signal: "تناسق الحمل", value: "74%", status: "يتحسن", note: "+11٪ منذ التقييم الأولي · تشير إلى التقدم على ساق واحدة" },
    { signal: "نطاق الحركة", value: "108°", status: "على المسار الصحيح", note: "الهدف 130° · استمر في بروتوكول التمرين الحالي" },
  ],
} as const;

function IntelligenceSection({ language }: { language: UiLanguage }) {
  const [ref, revealed] = useReveal(0.15);
  const copy = uiCopy[language].intelligence;
  const recoveryItems = RECOVERY_TIMELINE[language];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[var(--surface-alt)] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            {copy.label}
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            {copy.title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
            {copy.intro}
          </p>
        </div>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
          {/* Recovery timeline */}
          <div className={`rasq-reveal rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] ${revealed ? "is-revealed" : ""}`} style={{ transitionDelay: "80ms" }}>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
              {copy.patientJourney}
            </p>
            <div className="relative space-y-0">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[var(--border)]" />
              {recoveryItems.map((item) => (
                <div key={item.week} className="relative flex gap-5 pb-6 last:pb-0">
                  <div
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      item.pending
                        ? "border-[var(--border)] bg-[var(--surface-alt)]"
                        : "border-[var(--brand)]/40 bg-[var(--surface-alt)]"
                    }`}
                  >
                    {item.pending ? (
                      <span className="h-2 w-2 rounded-full border border-[var(--border)]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[10px] font-bold text-[var(--brand)]"
                        style={{ fontFamily: "var(--rasq-font-mono)" }}
                      >
                        {item.week}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">{item.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RASQ Intelligence panel */}
          <div
            className={`rasq-reveal rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] ${revealed ? "is-revealed" : ""}`}
            style={{ transitionDelay: "140ms" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <ArcMark size={14} />
                <span
                  className="text-xs font-bold text-[var(--foreground)]"
                  style={{ fontFamily: "var(--rasq-font-mono)" }}
                >
                  {copy.label === "Intelligence proof" ? "RASQ Intelligence" : "ذكاء RASQ"}
                </span>
              </div>
              <span className="rounded-full border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                {copy.draft}
              </span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {INTELLIGENCE_ITEMS[language].map((item) => (
                <div key={item.signal} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--muted)]">{item.signal}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold text-[var(--foreground)]"
                        style={{ fontFamily: "var(--rasq-font-mono)" }}
                      >
                        {item.value}
                      </span>
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--muted-soft)]">{item.note}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)] px-5 py-3">
              <p className="text-[10px] text-[var(--muted-soft)]">
                {language === "ar"
                  ? "دعم القرار السريري · ليس تشخيصًا · يلزم مراجعة الطبيب"
                  : "Clinical decision support · Not a diagnosis · Therapist review required"}
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

function DualPathwaySection({ language }: { language: UiLanguage }) {
  const [ref, revealed] = useReveal(0.15);
  const copy = uiCopy[language].access;

  return (
    <section
      id="providers"
      ref={ref as React.RefObject<HTMLElement>}
      className={`rasq-reveal overflow-hidden bg-[var(--background)] ${revealed ? "is-revealed" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            {copy.label}
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            {copy.title}
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 overflow-hidden rounded-[18px] border border-[var(--border)] shadow-[var(--shadow-card)] lg:grid-cols-2">

          {/* Provider */}
          <div
            className={`rasq-reveal flex flex-col bg-[var(--surface)] p-8 ${revealed ? "is-revealed" : ""}`}
            style={{ transitionDelay: "80ms" }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] text-[var(--brand)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-soft)]">
              {copy.provider}
            </p>
            <h3
              className="mt-1.5 text-xl font-bold text-[var(--foreground)]"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              {copy.providerTitle}
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-[var(--muted)]">
              {copy.providerDesc}
            </p>
            <div className="mt-6 space-y-2">
              <Link
                href="/login?role=clinician"
                className="group flex items-center justify-between rounded-[11px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-4 py-3 transition hover:border-[var(--brand)]/50"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{copy.clinicianWorkspace}</p>
                  <p className="text-xs text-[var(--muted)]">{copy.clinicianSub}</p>
                </div>
                <svg className="h-4 w-4 text-[var(--brand)] transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link
                href="/login?role=admin"
                className="group flex items-center justify-between rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 transition hover:border-[var(--brand)]/30"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{copy.adminWorkspace}</p>
                  <p className="text-xs text-[var(--muted-soft)]">{copy.adminSub}</p>
                </div>
                <svg className="h-4 w-4 text-[var(--muted-soft)] transition group-hover:text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Patient — distinct warm light accent panel (brand differentiation, intentional across themes) */}
          <div
            id="patients"
            className={`rasq-reveal flex flex-col border-t border-[var(--border)] p-8 lg:border-l lg:border-t-0 ${revealed ? "is-revealed" : ""}`}
            style={{ background: "#F4F6F5", transitionDelay: "140ms" }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#d1dbd6] bg-white text-[#1D9E75]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4a7060]">
              {copy.patient}
            </p>
            <h3
              className="mt-1.5 text-xl font-bold text-[#0f2e22]"
              style={{ fontFamily: "var(--rasq-font-display)" }}
            >
              {copy.patientTitle}
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-[#4a7060]">
              {copy.patientDesc}
            </p>
            <div className="mt-6 space-y-2">
              <div
                className="rounded-[11px] border border-[#d1dbd6] bg-white px-4 py-3 text-[#0f2e22]"
                role="note"
              >
                <p className="text-sm font-semibold">{copy.patientNote}</p>
                <p className="mt-0.5 text-xs text-[#4a7060]">
                  {copy.patientNoteSub}
                </p>
              </div>
              <Link
                href="/assessment-access"
                className="group flex items-center justify-between rounded-[11px] border border-[#d1dbd6] bg-white px-4 py-3 text-[#0f2e22] transition hover:border-[#1D9E75]/40"
              >
                <div>
                  <p className="text-sm font-semibold">{copy.assessmentLink}</p>
                  <p className="text-xs text-[#4a7060]">
                    {copy.assessmentLinkSub}
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

function FutureVisionSection({ language }: { language: UiLanguage }) {
  const [ref, revealed] = useReveal(0.15);
  const copy = uiCopy[language].future;

  const cards = [
    {
      id: "sense",
      name: copy.sense,
      tagline: copy.senseTag,
      desc: copy.senseDesc,
      specs: language === "ar" ? ["التقاط الحركة عبر IMU", "تحليل الحمل في الوقت الفعلي", "بيانات ما بين الجلسات"] : ["IMU motion capture", "Real-time load analysis", "Between-session data"],
    },
    {
      id: "motion",
      name: copy.motion,
      tagline: copy.motionTag,
      desc: copy.motionDesc,
      specs: language === "ar" ? ["جلسات موجهة عبر XR", "موصى بها من الطبيب", "نتائج قابلة للقياس"] : ["XR-guided sessions", "Clinician-prescribed", "Measurable outcomes"],
    },
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-[var(--background)] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className={`rasq-reveal ${revealed ? "is-revealed" : ""}`}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            {copy.label}
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] lg:text-3xl"
            style={{ fontFamily: "var(--rasq-font-display)" }}
          >
            {copy.title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
            {copy.intro}
          </p>
        </div>

        <div
          className={`mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 rasq-reveal-children ${revealed ? "is-revealed" : ""}`}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative flex flex-col rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)] p-6 shadow-[var(--shadow-card)]"
            >
              {/* Coming soon badge */}
              <span
                className="absolute right-4 top-4 rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--muted-soft)]"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                {copy.coming}
              </span>

              {/* Icon */}
              <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[var(--brand)]">
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
                className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--brand)]"
                style={{ fontFamily: "var(--rasq-font-mono)" }}
              >
                {card.tagline}
              </p>
              <h3
                className="mt-1 text-lg font-bold text-[var(--foreground)]"
                style={{ fontFamily: "var(--rasq-font-display)" }}
              >
                {card.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.desc}</p>

              <ul className="mt-5 space-y-1.5">
                {card.specs.map((spec) => (
                  <li key={spec} className="flex items-center gap-2 text-xs text-[var(--muted-soft)]">
                    <span className="h-1 w-1 rounded-full bg-[var(--brand)]/60" />
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

function Footer({ language }: { language: UiLanguage }) {
  const copy = uiCopy[language].footer;
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface-alt)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1fr_auto_auto_auto]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <ArcMark size={18} />
              <span
                className="text-[15px] font-bold tracking-[-0.03em] text-[var(--foreground)]"
                style={{ fontFamily: "var(--rasq-font-display)" }}
              >
                RASQ
              </span>
            </div>
            <p className="mt-2.5 text-xs leading-5 text-[var(--muted)]">
              {language === "ar" ? "إعادة التأهيل بدقة." : "Rehabilitation, precisely."}
            </p>
            <p className="mt-4 text-[11px] text-[var(--muted-soft)]">
              {language === "ar" ? "RASQ من Creative Motion Lab" : "RASQ by Creative Motion Lab"}
            </p>
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-soft)]">{copy.platform}</p>
            <ul className="mt-3 space-y-2.5">
              {[
                [language === "ar" ? "مساحة الطبيب" : "Clinician Workspace", "/login?role=clinician"],
                [language === "ar" ? "وصول المريض" : "Patient access", "#patients"],
                [language === "ar" ? "مساحة الإدارة" : "Admin Workspace", "/login?role=admin"],
                [language === "ar" ? "التقييم عن بُعد" : "Remote Assessment", "/assessment-access"],
              ].map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">{l}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Product */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-soft)]">{copy.product}</p>
            <ul className="mt-3 space-y-2.5">
              {[
                [language === "ar" ? "التقييمات" : "Assessments", "#platform"],
                [language === "ar" ? "خطط العلاج" : "Treatment Plans", "#platform"],
                [language === "ar" ? "جلسات العلاج" : "Therapy Sessions", "#platform"],
                ["RASQ Sense", "#"],
                ["RASQ Motion", "#"],
              ].map(([l, h]) => (
                <li key={l}>
                  <a href={h} className="text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Security */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted-soft)]">{copy.trust}</p>
            <ul className="mt-3 space-y-2.5">
              {[copy.privacy, copy.secure, copy.reports, copy.ux].map((l) => (
                <li key={l} className="text-xs text-[var(--muted)]">{l}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[var(--border)] pt-8 sm:flex-row sm:items-center">
          <p className="text-[11px] text-[var(--muted-soft)]">
            {copy.copyright}
          </p>
          <p
            className="text-[11px] text-[var(--muted-soft)]"
            style={{ fontFamily: "var(--rasq-font-mono)" }}
          >
            {copy.secureText}
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
  const { language } = useGlobalLanguage();

  return (
    <div
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      style={{ fontFamily: "var(--rasq-font-body)" }}
      dir={language === "ar" ? "rtl" : "ltr"}
      lang={language}
    >
      <Navbar language={language} />
      <HeroSection language={language} />
      <TrustBar language={language} />
      <DualPathwaySection language={language} />
      <WorkflowSection language={language} />
      <IntelligenceSection language={language} />
      <FutureVisionSection language={language} />
      <Footer language={language} />
    </div>
  );
}
