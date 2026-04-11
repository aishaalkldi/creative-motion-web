import Link from "next/link";
import { Bebas_Neue, Manrope } from "next/font/google";

const brandFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const components = [
  {
    title: "AI Vision Assessment",
    description: "Movement and posture analysis using computer vision.",
    href: "/assessment",
  },
  {
    title: "Rehabilitation Library",
    description: "Condition-based pathways and structured rehab programs.",
    href: "/library",
  },
  {
    title: "Immersive Sessions",
    description: "Sensor-based and VR-ready therapy experiences.",
    href: "/sessions",
  },
];

const dots = [
  { x: 0, y: -58, size: 12, opacity: 1 },
  { x: 18, y: -54, size: 11, opacity: 0.98 },
  { x: 34, y: -44, size: 10, opacity: 0.95 },
  { x: 47, y: -29, size: 9, opacity: 0.92 },
  { x: 56, y: -10, size: 8, opacity: 0.88 },
  { x: 58, y: 11, size: 7, opacity: 0.84 },
  { x: 53, y: 31, size: 6, opacity: 0.8 },
  { x: 40, y: 47, size: 5, opacity: 0.76 },
  { x: 22, y: 56, size: 5, opacity: 0.74 },
  { x: 1, y: 59, size: 4, opacity: 0.72 },
  { x: -20, y: 56, size: 5, opacity: 0.74 },
  { x: -39, y: 47, size: 5, opacity: 0.76 },
  { x: -53, y: 31, size: 6, opacity: 0.8 },
  { x: -58, y: 10, size: 7, opacity: 0.84 },
  { x: -56, y: -11, size: 8, opacity: 0.88 },
  { x: -47, y: -29, size: 9, opacity: 0.92 },
  { x: -34, y: -44, size: 10, opacity: 0.95 },
  { x: -18, y: -54, size: 11, opacity: 0.98 },
];

export default function HomePage() {
  return (
    <main className={`${bodyFont.className} min-h-screen bg-[#071a2f] text-white`}>
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#08172d_0%,#0b1f3f_38%,#0c2a52_72%,#0b1f3f_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:38px_38px] opacity-15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_top,rgba(34,211,238,0.10),transparent_38%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-6">
          <header className="flex items-center justify-between">
            <div className="text-lg font-bold tracking-wide text-cyan-300 md:text-xl">
              Creative Motion Lab
            </div>

            <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
              <a href="#platform" className="transition hover:text-white">
                Platform
              </a>
              <a href="#components" className="transition hover:text-white">
                Components
              </a>
              <a href="#how-it-works" className="transition hover:text-white">
                How It Works
              </a>
              <a href="#who-we-help" className="transition hover:text-white">
                Who We Help
              </a>
              <a href="#research" className="transition hover:text-white">
                Research
              </a>
              <a href="#contact" className="transition hover:text-white">
                Contact
              </a>
            </nav>
          </header>

          <div className="mx-auto max-w-5xl py-24 text-center md:py-32">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-6 h-[92px] w-[92px]">
                {dots.map((dot, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full bg-cyan-300"
                    style={{
                      width: `${dot.size}px`,
                      height: `${dot.size}px`,
                      left: `calc(50% + ${dot.x * 0.72}px - ${dot.size / 2}px)`,
                      top: `calc(50% + ${dot.y * 0.72}px - ${dot.size / 2}px)`,
                      opacity: dot.opacity,
                      boxShadow: "0 0 10px rgba(34,211,238,0.22)",
                    }}
                  />
                ))}
              </div>

              <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100 backdrop-blur">
                Rehabilitation • Sports • AI Motion
              </div>

              <h1
                className={`${brandFont.className} mt-7 text-[54px] uppercase leading-[0.95] tracking-[0.08em] text-cyan-300 md:text-[88px] lg:text-[112px]`}
                style={{
                  textShadow:
                    "0 0 18px rgba(34,211,238,0.16), 0 0 40px rgba(59,130,246,0.08)",
                }}
              >
                Creative Motion Lab
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-lg font-medium text-white/90 md:text-2xl">
                Move better. Recover smarter.
              </p>

              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                AI-powered rehabilitation, movement assessment, and immersive therapy tools.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#contact"
                  className="rounded-2xl bg-cyan-400 px-7 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Book a Demo
                </a>

                <a
                  href="#platform"
                  className="rounded-2xl border border-white/20 bg-white/5 px-7 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Explore Platform
                </a>
              </div>
            </div>
          </div>

          <section id="platform" className="relative mx-auto max-w-7xl px-6 pb-20 pt-6 text-center">
            <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(7,26,47,0)_0%,rgba(7,26,47,0.16)_100%)] pointer-events-none" />

            <h2
              className={`${brandFont.className} relative text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
            >
              Creative Motion Platform
            </h2>

            <p className="relative mx-auto mt-4 max-w-4xl text-sm leading-8 text-white/75 md:text-base">
              A connected digital rehabilitation ecosystem designed to support assessment,
              therapy, movement tracking, and progress monitoring through intelligent tools
              built for real clinical and performance environments.
            </p>
          </section>
        </div>
      </section>

      <section id="components" className="mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-10 text-center">
          <h2
            className={`${brandFont.className} text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
          >
            Platform Components
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
            Core modules designed to support the rehabilitation journey.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {components.map((component) => (
            <Link
              key={component.title}
              href={component.href}
              className="group rounded-[24px] border border-cyan-300/18 bg-white/[0.035] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md transition hover:border-cyan-300/30 hover:bg-white/[0.05]"
            >
              <div className="inline-flex rounded-2xl border border-cyan-300/18 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-100">
                Module
              </div>

              <h3
                className={`${brandFont.className} mt-5 text-3xl uppercase tracking-[0.04em] text-white`}
              >
                {component.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/70">
                {component.description}
              </p>

              <div className="mt-8 inline-flex items-center text-sm font-semibold text-cyan-300 transition group-hover:text-cyan-200">
                Open
                <span className="ml-2">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-16 text-center">
        <h2
          className={`${brandFont.className} text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
        >
          How It Works
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <InfoCard
            title="Assess"
            text="Start with AI-supported movement analysis and structured evaluation."
          />
          <InfoCard
            title="Plan"
            text="Move into condition-based pathways, protocols, and guided decisions."
          />
          <InfoCard
            title="Deliver"
            text="Launch sessions through sensor-based or VR-ready rehabilitation modes."
          />
        </div>
      </section>

      <section id="who-we-help" className="mx-auto max-w-7xl px-6 pb-16 text-center">
        <h2
          className={`${brandFont.className} text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
        >
          Who We Help
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <InfoCard
            title="Clinicians"
            text="Structured tools for evaluation, program selection, and progress tracking."
          />
          <InfoCard
            title="Patients"
            text="Clear rehabilitation pathways, guided sessions, and measurable recovery."
          />
          <InfoCard
            title="Athletes"
            text="Performance-focused recovery, readiness, and return-to-sport progression."
          />
        </div>
      </section>

      <section id="research" className="mx-auto max-w-7xl px-6 pb-16 text-center">
        <h2
          className={`${brandFont.className} text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
        >
          Research & Innovation
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-sm leading-8 text-white/75 md:text-base">
          Built around smarter rehabilitation logic, measurable movement outcomes,
          and scalable digital care powered by AI, motion tracking, and immersive technology.
        </p>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <h2
            className={`${brandFont.className} text-4xl uppercase tracking-[0.08em] text-cyan-300 md:text-6xl`}
          >
            Contact
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
            Explore partnerships, demos, and future collaboration opportunities with Creative Motion Lab.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Clinician Login
            </Link>

            <Link
              href="/patient"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Patient Portal
            </Link>
          </div>
        </div>
      </section>
    </main>
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
      <h3
        className={`${brandFont.className} text-3xl uppercase tracking-[0.05em] text-white`}
      >
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-white/70">{text}</p>
    </div>
  );
}