import Link from "next/link";

const sections = [
  {
    title: "Orthopedic Rehabilitation",
    href: "/library/orthopedic",
  },
  {
    title: "Neurological Rehabilitation",
    href: "/library/neurological",
  },
  {
    title: "Sports Rehabilitation",
    href: "/library/sports",
  },
  {
    title: "Vestibular Rehabilitation",
    href: "/library/vestibular",
  },
  {
    title: "Cognitive Training",
    href: "/library/cognitive",
  },
  {
    title: "Mental Wellness",
    href: "/library/wellness",
  },
];

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <span>/</span>
          <span className="text-cyan-300">Library</span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                XR Therapy Library
              </div>

              <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                Rehabilitation Library
              </h1>

              <p className="mt-3 text-sm leading-7 text-white/70 md:text-base">
                Choose a section to continue.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="group rounded-[24px] border border-cyan-300/20 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.07]"
            >
              <div className="inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                Section
              </div>

              <h2 className="mt-5 text-xl font-semibold text-white">
                {section.title}
              </h2>

              <div className="mt-8 inline-flex items-center text-sm font-semibold text-cyan-300 transition group-hover:text-cyan-200">
                Open Section
                <span className="ml-2">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}