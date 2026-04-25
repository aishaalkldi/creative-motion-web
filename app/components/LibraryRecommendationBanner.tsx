"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getMockClinicalDecision, type ProgramSuggestionId } from "@/app/lib/clinical-decision";

/**
 * Shows context from ?recommended=&symmetry=&score= (optional) set by results / gait flows.
 * TODO: Load assigned program from backend by patientId instead of URL hints.
 */
export function LibraryRecommendationBanner() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const rec = searchParams.get("recommended") as ProgramSuggestionId | null;

  const sym = searchParams.get("symmetry");
  const score = searchParams.get("score");
  const sway = searchParams.get("trunkSway");

  const hasContext = Boolean(patientId || rec || sym || score || sway);
  if (!hasContext) return null;

  const symmetry01 = sym != null && sym !== "" ? Number(sym) : null;
  const overallScore = score != null && score !== "" ? Number(score) : null;
  const trunkSwayDeg = sway != null && sway !== "" ? Number(sway) : null;

  const decision = getMockClinicalDecision({
    symmetry01: symmetry01 != null && !Number.isNaN(symmetry01) ? symmetry01 : null,
    overallScore: overallScore != null && !Number.isNaN(overallScore) ? overallScore : null,
    trunkSwayDeg: trunkSwayDeg != null && !Number.isNaN(trunkSwayDeg) ? trunkSwayDeg : null,
  });

  const highlight =
    rec && decision.programs.some((p) => p.id === rec)
      ? decision.programs.find((p) => p.id === rec)!
      : decision.primaryProgram;

  const qs = searchParams.toString();
  const openHref = qs
    ? `${highlight.href}${highlight.href.includes("?") ? "&" : "?"}${qs}`
    : highlight.href;

  return (
    <div className="mx-auto mb-6 max-w-7xl px-6">
      <div className="rounded-[28px] border border-cyan-300/25 bg-cyan-400/10 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200/90">
          Recommended for this case
        </p>
        <p className="mt-2 text-lg font-semibold text-white">{highlight.title}</p>
        <p className="mt-2 text-sm leading-7 text-white/75">{highlight.rationale}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={openHref}
            className="rounded-2xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Open recommended module
          </Link>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          {/* TODO: Replace URL-derived hints with persisted prescription from API. */}
          Mock routing only — signals from assessment flow may be passed as query params.
        </p>
      </div>
    </div>
  );
}
