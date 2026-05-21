import Link from "next/link";
import { Suspense } from "react";
import { LibraryRecommendationBanner } from "../components/LibraryRecommendationBanner";
import { RehabilitationLibraryGrid } from "../components/RehabilitationLibraryGrid";

export default function LibraryPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <Suspense fallback={null}>
        <LibraryRecommendationBanner />
      </Suspense>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/clinician" className="text-white/35 transition hover:text-white/70">Dashboard</Link>
          <span className="text-white/20">/</span>
          <span className="text-[#5DCAA5]">Programs</span>
        </div>

        {/* Header card — flat */}
        <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-[6px] border border-[#1D9E75]/20 bg-[#1D9E75]/8 px-3 py-1.5 text-xs font-semibold text-[#5DCAA5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                Rehabilitation Program Catalog
              </div>

              <h1 className="mt-4 text-2xl font-bold text-white">Programs Library</h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                After reviewing an{" "}
                <span className="font-semibold text-white/75">assessment result</span>, select the
                appropriate clinical field to assign therapy. Programs are organized by clinical taxonomy.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/clinician/patients"
                className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:text-white">
                ← Patients
              </Link>
              <Link href="/clinician/results"
                className="rounded-[7px] border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-4 py-2.5 text-sm font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15">
                View Results
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-6 pb-16 text-sm text-white/30">Loading library…</div>
        }
      >
        <RehabilitationLibraryGrid />
      </Suspense>
    </div>
  );
}
