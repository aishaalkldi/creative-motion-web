import Link from "next/link";

type MetricTone = "default" | "attention" | "moderate";

const overviewCards: {
  title: string;
  value: string;
  subtitle: string;
  tone: MetricTone;
}[] = [
  {
    title: "Total Patients",
    value: "0",
    subtitle: "Connected patient records",
    tone: "default",
  },
  {
    title: "Active Cases",
    value: "0",
    subtitle: "Current active patients",
    tone: "default",
  },
  {
    title: "Pending Reviews",
    value: "0",
    subtitle: "Results awaiting clinician review",
    tone: "attention",
  },
  {
    title: "Remote Assessments Pending",
    value: "0",
    subtitle: "Patient links not completed yet",
    tone: "moderate",
  },
];

const quickActions = [
  {
    title: "Add Patient",
    description: "Create a new patient file",
    href: "/clinician/patients/new",
  },
  {
    title: "Patients",
    description: "Open all patient records",
    href: "/clinician/patients",
  },
  {
    title: "Start Assessment",
    description: "Begin in-clinic or remote workflow",
    href: "/clinician/assessment/start",
  },
  {
    title: "Generate Link",
    description: "Create a remote assessment request",
    href: "/clinician/request",
  },
  {
    title: "Review Results",
    description: "Open recent assessment outcomes",
    href: "/results",
  },
];

const activityQueue = [
  "No pending reviews yet",
  "No remote assessments awaiting completion",
  "No follow-up alerts yet",
];

const workflowSteps = [
  {
    title: "1. Add Patient",
    description: "Create a new patient file from the clinician portal.",
  },
  {
    title: "2. Open Patient Profile",
    description: "Review patient details, case status, and latest clinical context.",
  },
  {
    title: "3. Start Assessment",
    description: "Choose In-Clinic Guided Assessment or Remote Online Assessment.",
  },
  {
    title: "4. Review Results",
    description: "Open findings, summaries, and returned patient assessments.",
  },
  {
    title: "5. Assign Program",
    description: "Select the right rehabilitation plan and next clinical action.",
  },
  {
    title: "6. Track Progress",
    description: "Follow reassessment trends and recovery progress over time.",
  },
];

export default function ClinicianDashboardPage() {
  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[28px] border border-cyan-300/18 bg-gradient-to-br from-cyan-500/8 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Clinician Workspace
              </div>

              <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
                Creative Motion Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Monitor patient flow, coordinate assessments, review outcomes, and continue rehabilitation planning from one structured clinical workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/clinician/patients/new"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                + Add Patient
              </Link>
              <Link
                href="/clinician/assessment/start"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Start Assessment
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <MetricCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              tone={card.tone}
            />
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Quick Actions</h2>
            <p className="mt-2 text-sm text-white/70">
              Open the most common clinician tasks to keep care workflow moving.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <div className="inline-flex rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
                    Action
                  </div>
                  <h3 className="text-base font-semibold text-white">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{action.description}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white">Clinical Activity</h3>
              <p className="mt-2 text-sm text-white/65">
                Live queue for pending review and follow-up workload.
              </p>
              <div className="mt-4 space-y-3">
                {activityQueue.map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Workflow Map</h2>
            <p className="mt-2 text-sm text-white/70">
              Recommended clinical sequence from intake to outcomes follow-up.
            </p>

            <div className="mt-5 space-y-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-[18px] border border-cyan-300/16 bg-[#123a8a]/22 p-4"
                >
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{step.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: MetricTone;
}) {
  const toneClass =
    tone === "attention"
      ? "text-amber-200"
      : tone === "moderate"
        ? "text-cyan-200"
        : "text-cyan-300";

  return (
    <div className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
      <p className="text-sm text-white/65">{title}</p>
      <p className={`mt-3 text-4xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}