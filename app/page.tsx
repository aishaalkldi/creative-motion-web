import Link from "next/link";
import { Manrope } from "next/font/google";

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const coreModules = [
  {
    title: "Clinician Dashboard",
    description:
      "Operational entry point for care teams to manage patients, sessions, and assessment decisions.",
    href: "/clinician",
  },
  {
    title: "Patient Profile",
    description:
      "Central patient record with assessment context, quick actions, and linked rehabilitation history.",
    href: "/clinician/patients",
  },
  {
    title: "Assessment Workflow",
    description:
      "Structured assessment setup supporting body region, visit type, and clinically selected PT tests.",
    href: "/clinician/assessment/start",
  },
  {
    title: "Remote & In-Clinic Sessions",
    description:
      "Unified workflow for in-person and remote assessments with secure patient-linked session access.",
    href: "/clinician/request",
  },
  {
    title: "Body Axis AI Session",
    description:
      "Capture-focused assessment session layer for movement recording and future computer vision expansion.",
    href: "/body-axis-ai",
  },
  {
    title: "Results & Outcomes",
    description:
      "Assessment outputs and session summaries ready for clinical follow-up and progress tracking.",
    href: "/assessment/success",
  },
];

const trustSignals = [
  "Clinician-first workflow architecture",
  "Patient-linked assessment continuity",
  "In-clinic and remote session support",
  "Structured results and follow-up flow",
];

export default function HomePage() {
  return (
    <main className={`${bodyFont.className} min-h-screen bg-[#071a2f] text-white`}>
      <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#08172d_0%,#0b1f3f_42%,#0a203e_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:38px_38px] opacity-15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_34%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-6 md:py-8">
          <header className="flex items-center justify-between">
            <div className="text-base font-semibold tracking-wide text-cyan-300 md:text-lg">
              Creative Motion Lab
            </div>

            <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
              <a href="#platform-overview" className="transition hover:text-white">
                Platform
              </a>
              <a href="#how-it-works" className="transition hover:text-white">
                Workflow
              </a>
              <a href="#modules" className="transition hover:text-white">
                Modules
              </a>
              <a href="#direction" className="transition hover:text-white">
                Direction
              </a>
              <a href="#cta" className="transition hover:text-white">
                Get Started
              </a>
            </nav>
          </header>

          <div className="grid gap-8 py-20 md:grid-cols-[1.2fr_0.8fr] md:items-center md:py-24">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Clinician-Centered Rehabilitation SaaS
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
                Structured rehabilitation workflows for modern clinics.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
                Creative Motion Lab helps clinicians manage patient assessments across
                in-clinic and remote settings, from session setup to linked outcomes and
                follow-up decisions.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/clinician"
                  className="rounded-2xl bg-cyan-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Open Clinician Workspace
                </Link>

                <a
                  href="#platform-overview"
                  className="rounded-2xl border border-white/20 bg-white/5 px-7 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Explore Platform
                </a>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.05] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <p className="text-sm font-semibold text-cyan-200">Platform Positioning</p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Product-first foundation for sports rehabilitation.
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Built for operational reliability now, with roadmap continuity toward
                computer vision, measurable outcomes, and broader patient engagement.
              </p>
              <div className="mt-5 space-y-2">
                {trustSignals.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform-overview" className="mx-auto max-w-7xl px-6 pb-8 pt-14">
        <SectionHeader
          eyebrow="What the Platform Does"
          title="One workflow connecting clinicians, patients, and assessment sessions."
          description="The current implementation prioritizes practical clinical operations while keeping the architecture ready for broader rehabilitation expansion."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <ContentCard
            title="Clinician Workflow"
            items={[
              "Create and manage patient records from a centralized dashboard.",
              "Start in-clinic or remote assessments with structured test selection.",
              "Generate secure patient links and track completion status.",
              "Review outcomes and continue follow-up decisions from linked records.",
            ]}
          />
          <ContentCard
            title="Patient Journey"
            items={[
              "Receive secure session access from the clinic.",
              "Open the assessment landing page and start session flow.",
              "Complete Body Axis AI capture session and submit assessment.",
              "Return data to clinician-side records for review and progression.",
            ]}
          />
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-6 pb-8 pt-10">
        <SectionHeader
          eyebrow="Core Modules"
          title="Product sections supporting the rehabilitation lifecycle."
          description="Each module reflects the current working frontend flow and keeps continuity with your clinician-first architecture."
        />

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {coreModules.map((component) => (
            <Link
              key={component.title}
              href={component.href}
              className="group rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md transition hover:border-cyan-300/30 hover:bg-white/[0.05]"
            >
              <div className="inline-flex rounded-2xl border border-cyan-300/18 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                Module
              </div>

              <h3 className="mt-5 text-xl font-semibold text-white">{component.title}</h3>

              <p className="mt-3 text-sm leading-6 text-white/70">
                {component.description}
              </p>

              <div className="mt-8 inline-flex items-center text-sm font-semibold text-cyan-300 transition group-hover:text-cyan-200">
                Open module
                <span className="ml-2">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-8 pt-10">
        <SectionHeader
          eyebrow="Why It Is Different"
          title="Designed around clinical structure, not generic wellness flows."
          description="The platform keeps session continuity from request to results, with clear expansion paths for Body Axis AI and measurable outcomes."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Clinician-first"
            text="Workflow design begins with operational care-team needs and practical session management."
          />
          <InfoCard
            title="Patient-linked"
            text="Assessments remain connected to each patient profile for clear clinical continuity."
          />
          <InfoCard
            title="Hybrid delivery"
            text="In-clinic and remote sessions run within one consistent care pathway."
          />
          <InfoCard
            title="Future-ready"
            text="Architecture supports later layers for computer vision and measurable reporting."
          />
        </div>
      </section>

      <section id="direction" className="mx-auto max-w-7xl px-6 pb-14 pt-10">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <p className="text-sm font-semibold text-cyan-200">Current Focus</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Sports rehabilitation first.
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Creative Motion Lab currently prioritizes sports rehabilitation workflows
              for clinics, with frontend continuity across patient setup, assessment,
              capture, and results review.
            </p>
          </div>

          <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <p className="text-sm font-semibold text-cyan-200">Future Direction</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Expand across care models and modalities.
            </h3>
            <p className="mt-3 text-sm leading-7 text-white/72">
              Next phases include broader rehab domains, stronger patient-facing
              experiences, computer vision capabilities, and long-term sensor/device
              integration readiness.
            </p>
          </div>
        </div>
      </section>

      <section id="cta" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <h2 className="text-3xl font-semibold text-cyan-200 md:text-4xl">
            Built for clinics now. Ready for scale next.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
            Explore the clinician workspace, review patient and assessment workflows,
            and align with the next phase of rehabilitation product growth.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/clinician"
              className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Open Clinician Platform
            </Link>

            <Link
              href="/patient"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Patient Entry
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-cyan-200">{eyebrow}</p>
      <h2 className="mt-2 max-w-4xl text-3xl font-semibold text-white md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-white/70 md:text-base">
        {description}
      </p>
    </div>
  );
}

function ContentCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <p
            key={item}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/75"
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-white/70">{text}</p>
    </div>
  );
}