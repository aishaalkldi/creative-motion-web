import Link from "next/link";

const overviewCards = [
  {
    title: "Total Patients",
    value: "0",
    subtitle: "Connected patient records",
  },
  {
    title: "Active Cases",
    value: "0",
    subtitle: "Current active patients",
  },
  {
    title: "Pending Reviews",
    value: "0",
    subtitle: "Results awaiting clinician review",
  },
  {
    title: "Remote Assessments Pending",
    value: "0",
    subtitle: "Patient links not completed yet",
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
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
            Clinician Portal
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Creative Motion Dashboard
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
            Monitor patient flow, manage assessment requests, review findings, and continue rehabilitation planning through one connected clinician workspace.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[24px] border border-cyan-300/18 bg-white/[0.04] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md"
            >
              <p className="text-sm text-white/65">{card.title}</p>
              <p className="mt-3 text-4xl font-bold text-cyan-300">{card.value}</p>
              <p className="mt-2 text-sm text-white/60">{card.subtitle}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Quick Actions</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className="rounded-[22px] border border-cyan-300/18 bg-[#123a8a]/25 p-4 transition hover:border-cyan-300/35 hover:bg-[#123a8a]/35"
                >
                  <h3 className="text-base font-semibold text-white">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/70">{action.description}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white">Clinical Activity</h3>
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