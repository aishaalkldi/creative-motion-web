"use client";

import type { PatientLifetimeSummary } from "@/app/lib/patient-lifetime-summary";
import { shouldShowPatientLifetimeSummary } from "@/app/lib/patient-lifetime-summary";
import {
  formatPortalDate,
  lifetimeSummaryUi,
  type PatientPortalLanguage,
} from "@/app/lib/patient-portal-ui";

type PatientLifetimeSummaryCardProps = {
  summary: PatientLifetimeSummary;
  lang: PatientPortalLanguage;
  textDir: "ltr" | "rtl";
  arClass?: string;
};

const CARD_SHADOW = "shadow-[0_8px_30px_rgba(10,15,26,0.06)]";

export function PatientLifetimeSummaryCard({
  summary,
  lang,
  textDir,
  arClass = "",
}: PatientLifetimeSummaryCardProps) {
  if (!shouldShowPatientLifetimeSummary(summary)) return null;

  const ui = lifetimeSummaryUi(lang);
  const lastActivityLabel = summary.lastActivityAt
    ? formatPortalDate(summary.lastActivityAt, lang)
    : "—";

  const rows = [
    { label: ui.completedSessions, value: String(summary.totalCompletedSessions) },
    { label: ui.programsAssigned, value: String(summary.totalProgramsAssigned) },
    { label: ui.movementCaptures, value: String(summary.totalCvSessions) },
    { label: ui.lastActivity, value: lastActivityLabel },
  ];

  return (
    <section
      className={`rounded-[16px] border border-[#D1E7DE] bg-gradient-to-br from-[#F8FCFA] to-white p-5 ${CARD_SHADOW} ${arClass}`}
      dir={textDir}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1D9E75]">
        {ui.title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">{ui.subtitle}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[10px] border border-[#E2E8E5] bg-white px-3.5 py-2.5"
          >
            <dt className="text-[11px] font-semibold text-[#6B7280]">{row.label}</dt>
            <dd
              className="mt-0.5 text-[16px] font-bold text-[#0A0F1A]"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
