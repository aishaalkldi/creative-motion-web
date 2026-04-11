import Link from "next/link";

const sportsProtocols = [
  {
    title: "ACL Rehabilitation",
    description:
      "A structured sports rehabilitation pathway focused on knee control, strength progression, movement confidence, and return-to-sport readiness.",
    tags: ["Knee Control", "Strength", "Return to Sport"],
    href: "",
    available: false,
  },
  {
    title: "Meniscus Injury",
    description:
      "Condition-specific rehabilitation designed to support joint protection, gradual loading, mobility restoration, and controlled recovery.",
    tags: ["Mobility", "Loading", "Function"],
    href: "",
    available: false,
  },
  {
    title: "Post-Operative Rehab",
    description:
      "Post-surgical recovery pathway designed to support healing, safe progression, mobility recovery, and functional return.",
    tags: ["Protection", "Progression", "Recovery"],
    href: "/library/sports/post-op",
    available: true,
  },
  {
    title: "Return to Sport",
    description:
      "A performance-oriented pathway built to assess readiness, improve movement quality, and support progression back to sport.",
    tags: ["Readiness", "Agility", "Control"],
    href: "/library/sports/return-to-sport",
    available: true,
  },
];

export default function SportsPage() {
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
          <span className="text-cyan-300">Sports Rehabilitation</span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Sports Rehabilitation
              </div>

              <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                Sports Protocols
              </h1>

              <p className="mt-3 text-sm leading-7 text-white/70 md:text-base">
                Choose the condition you want to continue with.
              </p>
            </div>

            <Link
              href="/library"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back to Library
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="grid gap-5 md:grid-cols-2">
          {sportsProtocols.map((protocol) => (
            <article
              key={protocol.title}
              className="rounded-[24px] border border-cyan-300/20 bg-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                  Protocol
                </div>

                {!protocol.available && (
                  <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60">
                    Soon
                  </div>
                )}
              </div>

              <h3 className="mt-4 text-xl font-semibold text-white">
                {protocol.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/70">
                {protocol.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {protocol.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-[#123a8a]/35 px-3 py-1.5 text-xs text-white/85"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-6">
                {protocol.available ? (
                  <Link
                    href={protocol.href}
                    className="inline-flex rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Open Protocol
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/40"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}