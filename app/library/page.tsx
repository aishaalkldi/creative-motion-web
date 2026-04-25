import Link from "next/link";
import { Suspense } from "react";
import { LibraryRecommendationBanner } from "../components/LibraryRecommendationBanner";
import { RehabilitationLibraryGrid } from "../components/RehabilitationLibraryGrid";

/**
 * Rehabilitation library — seven clinical fields (taxonomy-aligned).
 * TODO: Patient-specific assignments, eligibility rules, and completion status from API.
 */
export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-[#071a2f] text-white">
      <Suspense fallback={null}>
        <LibraryRecommendationBanner />
      </Suspense>
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-white/60">
          <Link href="/clinician" className="transition hover:text-white">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-cyan-300">Rehabilitation Library</span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                Clinical program catalog
              </div>

              <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">Rehabilitation Library</h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                After you review an <strong className="font-semibold text-white/90">assessment result</strong>, open the
                appropriate field below to start or assign therapy. This page mirrors how multidisciplinary teams browse
                protocol libraries in practice — one hub, clear fields, no orphan tools.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/clinician/patients"
                className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Patients
              </Link>
              <Link
                href="/live-results"
                className="inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Live results
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-6 pb-16 text-sm text-white/50">Loading library…</div>
        }
      >
        <RehabilitationLibraryGrid />
      </Suspense>
    </main>
  );
}
