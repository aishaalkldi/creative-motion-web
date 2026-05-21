import Link from "next/link";
import {
  ProgramSessionModeButtons,
  patientIdFromSearchParams,
  slugSessionType,
} from "../../../components/ProgramSessionModeButtons";

const rehabPhases = [
  {
    title: "Phase 1: Protection & Pain Control",
    description:
      "Early rehabilitation focused on protecting the surgical area, reducing pain and swelling, and introducing safe activation.",
    sessions: [
      {
        name: "Pain & Swelling Management",
        goal: "Reduce discomfort and support early recovery.",
        duration: "10-15 min",
      },
      {
        name: "Protected Range of Motion",
        goal: "Restore safe mobility without stressing the surgical area.",
        duration: "15 min",
      },
    ],
  },
  {
    title: "Phase 2: Mobility Restoration",
    description:
      "Restore safe range of motion, improve confidence in movement, and begin controlled loading progression.",
    sessions: [
      {
        name: "Mobility Recovery Flow",
        goal: "Improve controlled joint movement and flexibility.",
        duration: "15-20 min",
      },
      {
        name: "Weight Bearing Control",
        goal: "Support gradual loading and movement confidence.",
        duration: "15 min",
      },
    ],
  },
  {
    title: "Phase 3: Strength & Control",
    description:
      "Build strength, improve joint control, and prepare for more functional movement patterns.",
    sessions: [
      {
        name: "Strength Activation Session",
        goal: "Develop controlled strength progression.",
        duration: "20 min",
      },
      {
        name: "Movement Control Training",
        goal: "Improve alignment, stability, and quality of movement.",
        duration: "15-20 min",
      },
    ],
  },
  {
    title: "Phase 4: Return to Function",
    description:
      "Support transition toward functional activities and more advanced rehabilitation readiness.",
    sessions: [
      {
        name: "Functional Movement Session",
        goal: "Apply recovery gains into real functional movement.",
        duration: "20 min",
      },
      {
        name: "Progression Readiness Check",
        goal: "Evaluate readiness for the next rehabilitation stage.",
        duration: "10-15 min",
      },
    ],
  },
];

export default async function PostOpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const patientId = patientIdFromSearchParams(sp);

  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <span>/</span>
          <Link href="/library" className="transition hover:text-white">
            Library
          </Link>
          <span>/</span>
          <Link href="/library/sports" className="transition hover:text-white">
            Sports
          </Link>
          <span>/</span>
          <span className="text-cyan-300">Post-Operative Rehab</span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Sports Rehabilitation / Post-Op
              </div>

              <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                Post-Operative Rehabilitation Program
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                A structured rehabilitation pathway designed to support recovery
                after surgery through safe progression, mobility restoration,
                strength development, and return to functional movement.
              </p>
            </div>

            <Link
              href="/library/sports"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Sports
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            title="Condition-Based Program"
            description="Built for post-operative sports cases that require a guided and phase-based recovery pathway."
          />
          <InfoCard
            title="Dual Delivery Modes"
            description="Each session can be started in camera-based CV mode now; XR immersive delivery is planned next."
          />
          <InfoCard
            title="Clinical Flow"
            description="Designed to help the specialist move from condition to phase, then to the appropriate session."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="rounded-[28px] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-md">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
            Program Overview
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Recovery Pathway
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
            This rehabilitation program is structured into progressive phases,
            moving from protection and pain control toward mobility, strength,
            and functional recovery.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Protection
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Mobility
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Strength
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Function
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-white">Program Phases & Sessions</h2>
          <p className="mt-2 text-sm text-white/70">
            Each phase contains sessions you can start in Camera-based CV mode; XR immersive mode is coming soon.
          </p>
        </div>

        <div className="space-y-6">
          {rehabPhases.map((phase, phaseIndex) => (
            <article
              key={phase.title}
              className="rounded-[24px] border border-cyan-300/20 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
            >
              <div className="mb-5">
                <div className="inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                  Rehab Phase
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">
                  {phase.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-white/70">
                  {phase.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {phase.sessions.map((session) => (
                  <div
                    key={session.name}
                    className="rounded-[20px] border border-white/10 bg-[#123a8a]/20 p-4"
                  >
                    <h4 className="text-lg font-semibold text-white">
                      {session.name}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {session.goal}
                    </p>

                    <p className="mt-3 text-sm text-cyan-200">
                      Duration: {session.duration}
                    </p>

                    <ProgramSessionModeButtons
                      programId="sports-post-op"
                      phase={phaseIndex + 1}
                      sessionType={slugSessionType(session.name)}
                      patientId={patientId}
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
    </div>
  );
}