"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AssessmentListRow, AssessmentRow } from "@/app/api/assessments/route";
import { isStrokeClinicianData } from "@/app/components/clinician/StrokeQuestionnaireClinicianPanel";
import {
  formatAssessmentStatus,
  latestAssessmentPerType,
  type ObjectiveWorkspaceHint,
} from "@/app/lib/clinician/patient-assessments-summary";

export type { ObjectiveWorkspaceHint };

type AssessmentSummaryRow = {
  id: string;
  title: string;
  dateLabel: string | null;
  status: string;
  workflow: string[];
  href: string;
  cta: string;
};

type PatientAssessmentsSummaryProps = {
  patientId: string;
  assessments: AssessmentListRow[];
  latestDetail: AssessmentRow | null;
  objectiveWorkspaces: ObjectiveWorkspaceHint[];
};

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function reportHref(patientId: string, assessmentId: string): string {
  return `/clinician/assessment/report?patientId=${encodeURIComponent(patientId)}&assessmentId=${encodeURIComponent(assessmentId)}`;
}

function titleForType(type: string, detail: AssessmentRow | null): string {
  if (type === "remote_questionnaire") {
    if (detail && isStrokeClinicianData(detail.structured_data)) {
      return "Remote Neurorehabilitation Intake";
    }
    return "Remote Questionnaire";
  }
  if (type === "upper_limb_motor_screen") return "Upper-Limb Motor Screen";
  if (type === "general_msk") return "General MSK Assessment";
  if (type === "structured") return "Structured Assessment";
  return type.replaceAll("_", " ");
}

function buildRows(
  patientId: string,
  assessments: AssessmentListRow[],
  latestDetail: AssessmentRow | null,
  objectiveWorkspaces: ObjectiveWorkspaceHint[],
): AssessmentSummaryRow[] {
  const latestByType = new Map(
    latestAssessmentPerType(assessments).map((row) => [row.type, row]),
  );

  const typeOrder = [
    "remote_questionnaire",
    "upper_limb_motor_screen",
    "general_msk",
    "structured",
  ];
  const rows: AssessmentSummaryRow[] = [];

  for (const type of typeOrder) {
    const row = latestByType.get(type);
    if (!row) continue;
    const detail = latestDetail?.id === row.id ? latestDetail : null;
    const workflow: string[] = [];
    if (detail && isStrokeClinicianData(detail.structured_data)) {
      workflow.push(
        `Clinical English: ${formatAssessmentStatus(detail.structured_data.strokeWorkflow.translation.status)}`,
      );
      workflow.push(
        `PT Report: ${formatAssessmentStatus(detail.structured_data.strokeWorkflow.report.status)}`,
      );
    }
    const isBattery = type === "upper_limb_motor_screen";
    rows.push({
      id: row.id,
      title: titleForType(type, detail),
      dateLabel: formatDate(row.created_at),
      status: formatAssessmentStatus(row.status || "submitted"),
      workflow,
      href: reportHref(patientId, row.id),
      cta: isBattery ? "View Results" : "Open Assessment",
    });
  }

  for (const [type, row] of latestByType) {
    if (typeOrder.includes(type)) continue;
    rows.push({
      id: row.id,
      title: titleForType(type, null),
      dateLabel: formatDate(row.created_at),
      status: formatAssessmentStatus(row.status || "submitted"),
      workflow: [],
      href: reportHref(patientId, row.id),
      cta: "Open Assessment",
    });
  }

  for (const workspace of objectiveWorkspaces) {
    rows.push({
      id: workspace.id,
      title: workspace.title,
      dateLabel: null,
      status: workspace.hasResult ? "Completed" : "Not started",
      workflow: [],
      href: workspace.href,
      cta: workspace.hasResult ? "View Results" : "Start Assessment",
    });
  }

  return rows;
}

export function PatientAssessmentsSummary({
  patientId,
  assessments,
  latestDetail,
  objectiveWorkspaces,
}: PatientAssessmentsSummaryProps) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(
    () => buildRows(patientId, assessments, latestDetail, objectiveWorkspaces),
    [patientId, assessments, latestDetail, objectiveWorkspaces],
  );

  return (
    <section id="clinical-assessment-summary" className="scroll-mt-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Assessments</h2>
          <p className="mt-1 text-xs text-white/35">
            Latest relevant assessment per type. Open a workspace for full review.
          </p>
        </div>
        {assessments.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="text-xs font-semibold text-[#5DCAA5] hover:text-white"
          >
            {showAll ? "Hide full list" : "View all assessments"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4 text-sm text-white/50">
          No assessments yet. Send a remote intake or start an objective test.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{row.title}</p>
                <p className="mt-0.5 text-xs text-white/45">
                  {[row.dateLabel, row.status].filter(Boolean).join(" · ")}
                </p>
                {row.workflow.length > 0 ? (
                  <p className="mt-1 text-xs text-white/55">{row.workflow.join(" · ")}</p>
                ) : null}
              </div>
              <Link
                href={row.href}
                className="shrink-0 rounded-[6px] bg-[#1D9E75] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#179165]"
              >
                {row.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showAll && assessments.length > 0 ? (
        <div id="assessment-archive" className="mt-5 border-t border-[#1E2D42] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            All saved assessments
          </p>
          <ul className="mt-3 space-y-2">
            {assessments.map((row) => (
              <li key={`archive-${row.id}`} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-white/70">
                  {titleForType(row.type, latestDetail?.id === row.id ? latestDetail : null)}
                  {formatDate(row.created_at) ? ` · ${formatDate(row.created_at)}` : ""}
                </p>
                <Link
                  href={reportHref(patientId, row.id)}
                  className="text-[11px] font-semibold text-[#5DCAA5] hover:text-white"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
