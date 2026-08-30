"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildXrSessionRecommendations,
  XR_DISCLAIMER,
} from "@/app/lib/xr/xr-session-recommendations";

type XrSessionRecommendationsCardProps = {
  patientId: string;
  diagnosis: string | null;
};

export function XrSessionRecommendationsCard({
  patientId,
  diagnosis,
}: XrSessionRecommendationsCardProps) {
  const recommendations = useMemo(
    () => buildXrSessionRecommendations({ diagnosis, patientId, limit: 3 }),
    [diagnosis, patientId],
  );

  return (
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-soft)]">
        Session recommendations — assistive
      </p>
      <h2 className="mt-1 text-sm font-bold text-[var(--foreground)]">XR & camera session ideas</h2>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{XR_DISCLAIMER}</p>

      <div className="mt-4 space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="rounded-[7px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{rec.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{rec.rationale}</p>
              </div>
              <span className="rounded-[5px] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-soft)]">
                {rec.modeLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={rec.cameraHref}
                className="rounded-[6px] border border-[var(--brand)]/25 bg-[var(--brand)]/8 px-3 py-1.5 text-xs font-semibold text-[var(--brand)] transition hover:bg-[var(--brand)]/15"
              >
                Open camera session
              </Link>
              <Link
                href={rec.libraryHref}
                className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                View in library
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
