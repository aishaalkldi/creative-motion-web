"use client";

import { useMemo, useState } from "react";
import type { ApprovedPatientReportFacts } from "@/app/lib/reports/approved-patient-facts";
import {
  readPtMedicalReportApproved,
  readPtMedicalReportDraft,
  type PtMedicalReportApproved,
  type PtMedicalReportDraft,
} from "@/app/lib/ai/generate-pt-medical-report";
import { resolvePtMedicalReportExportEligibility } from "@/app/components/reports/PtMedicalReportPrintView";
import {
  FIVE_TIMES_STS_ASSESSMENT_LABEL,
  FIVE_TIMES_STS_DELIVERY_MODE_LABELS,
  FIVE_TIMES_STS_DELIVERY_MODES,
  FIVE_TIMES_STS_PROTOCOL_LABELS,
  FIVE_TIMES_STS_PROTOCOLS,
  readFiveTimesStsAssignment,
  resolveFiveTimesStsAssignedByDisplayLabel,
  type FiveTimesStsAssignment,
  type FiveTimesStsDeliveryMode,
  type FiveTimesStsProtocol,
} from "@/app/lib/post-stroke-objective/types";

type Props = {
  assessmentId?: string;
  structuredData: Record<string, unknown>;
  approvedFacts: ApprovedPatientReportFacts | null;
  draft: PtMedicalReportDraft | null;
  approved: PtMedicalReportApproved | null;
  gate2ApprovedAt: string | null;
  /** Optional clinician display name already available in report context. */
  assignedByDisplayName?: string | null;
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostStrokeObjectiveAssignmentPanel({
  assessmentId,
  structuredData,
  approvedFacts,
  draft,
  approved,
  gate2ApprovedAt,
  assignedByDisplayName,
}: Props) {
  const exportEligibility = useMemo(
    () =>
      resolvePtMedicalReportExportEligibility({
        approvedFacts,
        draft,
        approved,
        gate2ApprovedAt,
      }),
    [approvedFacts, draft, approved, gate2ApprovedAt],
  );

  const initialAssignment = useMemo(
    () => readFiveTimesStsAssignment(structuredData),
    [structuredData],
  );

  const [assignment, setAssignment] = useState<FiveTimesStsAssignment | null>(initialAssignment);
  const [protocol, setProtocol] = useState<FiveTimesStsProtocol>("standard_5xsts");
  const [deliveryMode, setDeliveryMode] = useState<FiveTimesStsDeliveryMode>("remote_supervised");
  const [supervisionConfirmed, setSupervisionConfirmed] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const gate2Ready = exportEligibility.exportable;
  const controlsDisabled = !gate2Ready || !assessmentId || assignSaving || Boolean(assignment);
  const assignedByLabel = useMemo(
    () =>
      assignment
        ? resolveFiveTimesStsAssignedByDisplayLabel({
            clinicianDisplayName: assignedByDisplayName,
          })
        : null,
    [assignment, assignedByDisplayName],
  );

  async function handleAssign() {
    if (!assessmentId || controlsDisabled) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      const res = await fetch(
        `/api/assessments/${encodeURIComponent(assessmentId)}/objective-assignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            protocol,
            deliveryMode,
            ...(deliveryMode === "remote_supervised" ? { supervisionConfirmed } : {}),
          }),
        },
      );
      const body = (await res.json()) as {
        error?: string;
        assignment?: FiveTimesStsAssignment;
      };
      if (!res.ok) {
        setAssignError(body.error ?? "Unable to assign the Objective assessment.");
        return;
      }
      if (body.assignment) {
        setAssignment(body.assignment);
      }
    } catch {
      setAssignError("Unable to assign the Objective assessment.");
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">Objective Assessment</h2>
        <p className="mt-1 text-sm text-white/70">
          Assign the supervised Five Times Sit-to-Stand (5×STS) Objective assessment after
          Subjective approval. CV observes movement only; findings require clinician review.
        </p>
      </div>

      {!gate2Ready ? (
        <p className="rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Approve the Patient-Reported Subjective Summary before assigning the Objective
          assessment.
        </p>
      ) : null}

      {assignment ? (
        <div className="rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4 space-y-3">
          <p className="text-sm font-semibold text-white">Assessment assigned successfully.</p>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-white/50">Assessment</dt>
              <dd className="text-white">{FIVE_TIMES_STS_ASSESSMENT_LABEL}</dd>
            </div>
            <div>
              <dt className="text-white/50">Protocol</dt>
              <dd className="text-white">{FIVE_TIMES_STS_PROTOCOL_LABELS[assignment.protocol]}</dd>
            </div>
            <div>
              <dt className="text-white/50">Delivery mode</dt>
              <dd className="text-white">
                {FIVE_TIMES_STS_DELIVERY_MODE_LABELS[assignment.deliveryMode]}
              </dd>
            </div>
            <div>
              <dt className="text-white/50">Status</dt>
              <dd className="text-white capitalize">{assignment.status}</dd>
            </div>
            <div>
              <dt className="text-white/50">Target repetitions</dt>
              <dd className="text-white">{assignment.targetRepetitions}</dd>
            </div>
            <div>
              <dt className="text-white/50">Assigned at</dt>
              <dd className="text-white">{formatTimestamp(assignment.assignedAt)}</dd>
            </div>
            <div>
              <dt className="text-white/50">Assigned by</dt>
              <dd className="text-white">{assignedByLabel}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="space-y-4 rounded-[8px] border border-[#1E2D42] bg-[#0B1220] px-4 py-4">
          <div className="space-y-2">
            <label htmlFor="five-times-sts-protocol" className="block text-sm font-medium text-white">
              Protocol
            </label>
            <select
              id="five-times-sts-protocol"
              value={protocol}
              disabled={controlsDisabled}
              onChange={(event) => setProtocol(event.target.value as FiveTimesStsProtocol)}
              className="w-full rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {FIVE_TIMES_STS_PROTOCOLS.map((value) => (
                <option key={value} value={value}>
                  {FIVE_TIMES_STS_PROTOCOL_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="five-times-sts-delivery" className="block text-sm font-medium text-white">
              Delivery mode
            </label>
            <select
              id="five-times-sts-delivery"
              value={deliveryMode}
              disabled={controlsDisabled}
              onChange={(event) =>
                setDeliveryMode(event.target.value as FiveTimesStsDeliveryMode)
              }
              className="w-full rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {FIVE_TIMES_STS_DELIVERY_MODES.map((value) => (
                <option key={value} value={value}>
                  {FIVE_TIMES_STS_DELIVERY_MODE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {deliveryMode === "remote_supervised" ? (
            <label className="flex items-start gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={supervisionConfirmed}
                disabled={controlsDisabled}
                onChange={(event) => setSupervisionConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>
                I confirm this is a clinician-assigned supervised session. The platform does
                not independently verify continuous clinician presence.
              </span>
            </label>
          ) : null}

          {assignError ? (
            <p className="text-sm text-red-300" role="alert">
              {assignError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleAssign}
            disabled={
              controlsDisabled ||
              (deliveryMode === "remote_supervised" && !supervisionConfirmed)
            }
            className="rounded-[6px] bg-lime-400 px-4 py-2 text-sm font-semibold text-[#0B1220] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {assignSaving ? "Assigning…" : "Assign assessment"}
          </button>
        </div>
      )}
    </section>
  );
}

export function readPostStrokeObjectiveAssignmentFromStructuredData(
  structuredData: unknown,
): FiveTimesStsAssignment | null {
  return readFiveTimesStsAssignment(structuredData);
}

export function isPostStrokeObjectiveAssignmentGate2Ready(input: {
  approvedFacts: ApprovedPatientReportFacts | null;
  draft: PtMedicalReportDraft | null;
  approved: PtMedicalReportApproved | null;
  gate2ApprovedAt: string | null;
}): boolean {
  return resolvePtMedicalReportExportEligibility(input).exportable;
}
