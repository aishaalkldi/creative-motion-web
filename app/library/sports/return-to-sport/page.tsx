import Link from "next/link";

const readinessBlocks = [
  {
    title: "Movement Quality",
    description: "Controlled movement patterns, alignment, and stability during functional tasks.",
    sessions: [
      "Controlled Squat Pattern",
      "Single-Leg Stability",
      "Landing Mechanics",
    ],
  },
  {
    title: "Strength & Capacity",
    description: "Progressive loading and performance readiness to support safe sport participation.",
    sessions: [
      "Strength Progression Flow",
      "Dynamic Control Session",
      "Load Tolerance Training",
    ],
  },
  {
    title: "Agility & Reaction",
    description: "Higher-level coordination, response timing, and directional movement control.",
    sessions: [
      "Reactive Step Training",
      "Agility Challenge",
      "Direction Change Control",
    ],
  },
  {
    title: "Sport Progression",
    description: "Preparation for return to sport with confidence, control, and functional readiness.",
    sessions: [
      "Return Readiness Check",
      "Sport-Specific Flow",
      "Confidence Progression Session",
    ],
  },
];

export default function ReturnToSportPage() {
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
          <span className="text-cyan-300">Return to Sport</span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Sports Rehabilitation / Return to Sport
              </div>

              <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                Return to Sport Pathway
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                A structured progression pathway to support readiness, movement quality,
                confidence, and safe return to sport participation.
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
            title="Performance Readiness"
            description="Built to support the transition from rehabilitation into sport-specific readiness."
          />
          <InfoCard
            title="Dual Modes"
            description="Each session can later be delivered through Sensor + Screen mode or immersive VR mode."
          />
          <InfoCard
            title="Clinical Progression"
            description="Designed to guide the specialist from readiness blocks into sessions and progression decisions."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="rounded-[28px] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-md">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
            Program Focus
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Readiness, Control, and Progression
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
            This pathway focuses on restoring movement quality, building performance capacity,
            and progressing the patient toward safe return to sport.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Readiness
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Control
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Agility
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Sport Progression
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-white">Readiness Blocks</h2>
          <p className="mt-2 text-sm text-white/70">
            Choose the block that matches the athlete’s progression stage.
          </p>
        </div>

        <div className="space-y-6">
          {readinessBlocks.map((block) => (
            <article
              key={block.title}
              className="rounded-[24px] border border-cyan-300/20 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
            >
              <div className="mb-5">
                <div className="inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                  Progression Block
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">
                  {block.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-white/70">
                  {block.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {block.sessions.map((session) => (
                  <div
                    key={session}
                    className="rounded-[20px] border border-white/10 bg-[#123a8a]/20 p-4"
                  >
                    <h4 className="text-base font-semibold text-white">{session}</h4>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                        Start Sensor Mode
                      </button>

                      <button className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                        Start VR Mode
                      </button>
                    </div>
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