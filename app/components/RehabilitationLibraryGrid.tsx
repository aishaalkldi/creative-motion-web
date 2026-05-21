"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Seven-field rehabilitation library — matches clinical taxonomy.
 * TODO: Drive availability, assignments, and progress from backend per patient + episode.
 */

type FieldStatus = "active" | "soon";

type LibraryField = {
  key: string;
  title: string;
  description: string;
  status: FieldStatus;
  /** Primary route when active */
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const LIBRARY_FIELDS: LibraryField[] = [
  {
    key: "cardiopulmonary",
    title: "Cardiopulmonary Rehabilitation",
    description:
      "Structured endurance, breathing retraining, and monitored exertion pathways for cardiac and pulmonary caseloads.",
    status: "soon",
  },
  {
    key: "gait",
    title: "Gait Training",
    description:
      "Camera-guided stepping sessions and optional 10MWT analysis. Start therapy here after gait assessment.",
    status: "active",
    primaryHref: "/therapy",
    primaryLabel: "Start therapy session",
  },
  {
    key: "neurological",
    title: "Neurological Rehabilitation",
    description:
      "Motor recovery, coordination, and task-specific training modules for neurological populations.",
    status: "soon",
  },
  {
    key: "orthopaedic",
    title: "Orthopaedic Rehabilitation",
    description:
      "Post-injury and post-operative protocols for joint protection, loading progression, and return to function.",
    status: "soon",
  },
  {
    key: "vestibular",
    title: "Vestibular Rehabilitation",
    description:
      "Habituation, gaze stability, and balance-challenge progressions for vestibular dysfunction.",
    status: "soon",
  },
  {
    key: "cognitive",
    title: "Cognitive Training",
    description:
      "Dual-task, attention, and executive-function drills integrated with movement where clinically appropriate.",
    status: "soon",
  },
  {
    key: "sports",
    title: "Sports Rehabilitation",
    description:
      "Return-to-sport readiness, agility, and conditioning tracks. Sub-protocols for post-op and RTP live today.",
    status: "active",
    primaryHref: "/library/sports",
    primaryLabel: "Open sports protocols",
  },
];

function withPatientId(base: string, patientId: string | null): string {
  if (!patientId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}patientId=${encodeURIComponent(patientId)}`;
}

/** Therapy entry from library — always include patientId + source for /therapy routing. */
function therapyHrefFromLibrary(patientId: string | null): string {
  const q = new URLSearchParams();
  q.set("source", "library");
  q.set("patientId", patientId ?? "");
  return `/therapy?${q.toString()}`;
}

export function RehabilitationLibraryGrid() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Rehabilitation fields</h2>
          <p className="mt-1 max-w-3xl text-sm text-white/65">
            Select a clinical field to open active modules. Inactive fields are staged with clear “coming soon” states —
            no dead links.
            {/* TODO: Replace with CMS + entitlement rules from your API. */}
          </p>
        </div>
        {patientId ? (
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
            Patient context: {patientId}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {LIBRARY_FIELDS.map((field) =>
          field.status === "active" && field.primaryHref ? (
            <div
              key={field.key}
              className="group flex flex-col rounded-[24px] border border-cyan-300/28 bg-gradient-to-br from-cyan-500/10 via-white/[0.04] to-white/[0.02] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition hover:border-cyan-300/45"
            >
              <div className="inline-flex w-fit rounded-2xl border border-cyan-300/25 bg-cyan-400/15 px-3 py-1 text-[11px] font-medium text-cyan-100">
                Active
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">{field.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-white/70">{field.description}</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href={field.key === "gait" ? therapyHrefFromLibrary(patientId) : withPatientId(field.primaryHref, patientId)}
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {field.primaryLabel ?? "Open"}
                </Link>
                {field.key === "gait" && (
                  <Link
                    href={withPatientId("/gait", patientId)}
                    className="text-center text-xs font-semibold text-cyan-200/90 underline-offset-2 hover:text-cyan-100 hover:underline"
                  >
                    10MWT gait analysis (upload)
                  </Link>
                )}
                {field.secondaryHref && field.secondaryLabel ? (
                  <Link
                    href={withPatientId(field.secondaryHref, patientId)}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-2.5 text-center text-xs font-semibold text-white/90 transition hover:bg-white/10"
                  >
                    {field.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              key={field.key}
              className="flex flex-col rounded-[24px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="inline-flex w-fit rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/55">
                Coming soon
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white/95">{field.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-white/50">{field.description}</p>
              <p className="mt-6 text-[11px] leading-relaxed text-white/40">
                Module authoring and clinical governance in progress. You will assign these from the same library once
                released.
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
