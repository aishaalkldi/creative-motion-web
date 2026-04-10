export default function Home() {
  return (
    <main className="bg-[#0B1220] text-[#F8FAFC]">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0B1220]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-cyan-300">
            Creative Motion Lab
          </h1>

          <div className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#home" className="transition hover:text-cyan-300">
              Home
            </a>
            <a href="#platform" className="transition hover:text-cyan-300">
              Platform
            </a>
            <a href="#components" className="transition hover:text-cyan-300">
              Components
            </a>
            <a href="#how" className="transition hover:text-cyan-300">
              How It Works
            </a>
            <a href="#who" className="transition hover:text-cyan-300">
              Who We Help
            </a>
            <a href="#research" className="transition hover:text-cyan-300">
              Research
            </a>
            <a href="#contact" className="transition hover:text-cyan-300">
              Contact
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="home"
        className="relative flex min-h-[78vh] items-center justify-center px-6 pt-24 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_bottom,rgba(15,118,110,0.16),transparent_30%)]" />

        <div className="relative z-10 max-w-4xl fade-in">
          <p className="mb-4 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Rehabilitation • Sports • AI Motion
          </p>

          <h1 className="mb-6 text-5xl font-bold leading-tight md:text-7xl">
            Move Better. Recover Smarter.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-slate-300 leading-8">
            Creative Motion Lab helps patients, clinicians, and athletes use
            AI-powered movement analysis, wearable motion tracking, and immersive
            digital rehabilitation tools to improve recovery, performance, and
            measurable outcomes.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black transition hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.35)]">
              Book a Demo
            </button>

            <button className="rounded-xl border border-slate-600 px-6 py-3 transition hover:border-cyan-400 hover:text-cyan-300">
              Explore Platform
            </button>
          </div>
        </div>
      </section>

      {/* Creative Motion Platform */}
      <section id="platform" className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            Creative Motion Platform
          </h2>

          <p className="mx-auto max-w-3xl leading-8 text-slate-300">
            A connected digital rehabilitation ecosystem designed to support
            assessment, therapy, movement tracking, and progress monitoring
            through intelligent tools built for real clinical and performance
            environments.
          </p>
        </div>
      </section>

      {/* Platform Components */}
      <section id="components" className="px-6 py-20">
        <div className="mx-auto max-w-6xl text-center fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            Platform Components
          </h2>

          <p className="mx-auto mb-12 max-w-2xl text-slate-300">
            Three core components work together to power a smarter rehabilitation
            and movement experience.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Body Axis AI",
                desc: "AI-powered posture and movement assessment for smarter clinical insight, screening, and analysis.",
              },
              {
                title: "Q Motion Sensor",
                desc: "Wearable motion tracking for measurable upper and lower limb rehabilitation and performance monitoring.",
              },
              {
                title: "XR Therapy Library",
                desc: "Immersive therapy programs designed to support guided rehabilitation, engagement, and functional recovery.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] fade-in"
              >
                <h3 className="mb-3 text-lg font-semibold text-cyan-300">
                  {item.title}
                </h3>
                <p className="text-sm leading-7 text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="px-6 py-20">
        <div className="mx-auto max-w-6xl text-center fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            How It Works
          </h2>

          <p className="mx-auto mb-12 max-w-2xl text-slate-300">
            A simple pathway designed for real users, real movement, and real
            rehabilitation outcomes.
          </p>

          <div className="grid gap-8 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Assess",
                desc: "Evaluate posture, movement quality, and physical performance using digital tools, sensors, or guided tasks.",
              },
              {
                step: "02",
                title: "Analyze",
                desc: "Use AI-powered analysis and measurable tracking to identify movement patterns and clinical insights.",
              },
              {
                step: "03",
                title: "Treat",
                desc: "Deliver guided rehabilitation through digital programs, immersive XR therapy, and structured interventions.",
              },
              {
                step: "04",
                title: "Track Progress",
                desc: "Monitor adherence, outcomes, and recovery over time through connected progress tracking.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 fade-in"
              >
                <div className="mb-4 text-3xl font-bold text-cyan-300">
                  {item.step}
                </div>
                <h3 className="mb-3 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Help */}
      <section id="who" className="px-6 py-20">
        <div className="mx-auto max-w-6xl text-center fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            Who We Help
          </h2>

          <p className="mx-auto mb-12 max-w-2xl text-slate-300">
            Built for clinical and performance environments that need smarter
            movement-focused solutions.
          </p>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              {
                title: "Patients",
                desc: "Support recovery with clearer guidance, engaging therapy, and measurable progress.",
              },
              {
                title: "Clinicians",
                desc: "Manage assessments, therapy workflows, and patient progress more efficiently.",
              },
              {
                title: "Rehabilitation Clinics",
                desc: "Bring digital rehabilitation tools into daily clinical practice and remote care models.",
              },
              {
                title: "Athletes",
                desc: "Use movement-focused tools to support performance, recovery, and return to play.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 fade-in"
              >
                <h3 className="mb-3 text-lg font-semibold text-cyan-300">
                  {item.title}
                </h3>
                <p className="text-sm leading-7 text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research & Innovation */}
      <section id="research" className="px-6 py-20">
        <div className="mx-auto max-w-6xl text-center fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            Research & Innovation
          </h2>

          <p className="mx-auto mb-12 max-w-3xl leading-8 text-slate-300">
            Creative Motion Lab combines clinical insight, movement science, and
            emerging technologies to build smarter rehabilitation solutions for
            the future.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] fade-in">
              <h3 className="mb-3 text-lg font-semibold text-cyan-300">
                Evidence-Informed Design
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                Our solutions are shaped by rehabilitation principles, functional
                needs, and real clinical workflows.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] fade-in">
              <h3 className="mb-3 text-lg font-semibold text-cyan-300">
                Motion Science
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                We focus on measurable movement, biomechanics, posture, and
                performance to support better rehabilitation decisions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] fade-in">
              <h3 className="mb-3 text-lg font-semibold text-cyan-300">
                AI & XR Innovation
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                We integrate AI, wearable tracking, and immersive XR experiences
                to create more engaging and intelligent rehabilitation pathways.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Get Started */}
      <section id="contact" className="px-6 pt-8 pb-20">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-md transition hover:shadow-[0_0_60px_rgba(34,211,238,0.15)] fade-in">
          <h2 className="mb-4 text-3xl font-bold text-cyan-300">
            Get Started
          </h2>

          <p className="mb-6 text-slate-300 leading-8">
            Book a demo, explore the platform, or connect with us to discover how
            Creative Motion Lab can support rehabilitation, movement assessment,
            and digital care.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black transition hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.35)]">
              Book a Demo
            </button>

            <button className="rounded-xl border border-slate-600 px-6 py-3 transition hover:border-cyan-400 hover:text-cyan-300">
              Patient Portal
            </button>

            <button className="rounded-xl border border-slate-600 px-6 py-3 transition hover:border-cyan-400 hover:text-cyan-300">
              Clinician Portal
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}