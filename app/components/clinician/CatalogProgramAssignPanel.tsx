"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClinicalPrescribedSide } from "@/app/lib/clinical/clinical-prescribed-side";
import {
  buildCatalogPlanSessionsPayload,
  formatPrescribedSideForReview,
  isApplicableCatalogSession,
  mapPlanAssignHttpError,
  PRESCRIBED_SIDE_UNAVAILABLE_MESSAGE,
  reconcileCatalogSessionPrescribedSide,
  validateCatalogPrescribedSideDraftForSubmit,
  type CatalogPlanSessionDraftInput,
} from "@/app/lib/clinical/clinical-prescribed-side-plan-draft";
import type { CatalogProgramListItem } from "@/app/api/plans/catalog-programs/route";
import { PrescribedSideSelector } from "@/app/components/clinician/PrescribedSideSelector";

type CatalogProgramAssignPanelProps = {
  patientId: string;
  assessmentId: string | null;
  onAssigned: () => void;
};

type CatalogSessionDraft = CatalogPlanSessionDraftInput;

export function CatalogProgramAssignPanel({
  patientId,
  assessmentId,
  onAssigned,
}: CatalogProgramAssignPanelProps) {
  const [programs, setPrograms] = useState<CatalogProgramListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [sessionDrafts, setSessionDrafts] = useState<CatalogSessionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetch("/api/plans/catalog-programs")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to load catalog programs.");
        }
        return res.json() as Promise<{ programs: CatalogProgramListItem[] }>;
      })
      .then((data) => {
        if (!cancelled) setPrograms(data.programs);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load catalog programs.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  const selectProgram = useCallback((program: CatalogProgramListItem) => {
    setSelectedProgramId(program.id);
    setSessionDrafts(
      program.sessions.map((session) =>
        reconcileCatalogSessionPrescribedSide({
          sessionNumber: session.sessionNumber,
          title: session.title,
          blocks: session.blocks,
          prescribedSide: undefined,
        }),
      ),
    );
    setSaveError("");
  }, []);

  function updateSessionDraft(sessionNumber: number, prescribedSide: ClinicalPrescribedSide) {
    setSessionDrafts((prev) =>
      prev.map((session) =>
        session.sessionNumber === sessionNumber
          ? reconcileCatalogSessionPrescribedSide({ ...session, prescribedSide })
          : session,
      ),
    );
  }

  async function handleCatalogAssign() {
    if (!selectedProgram) return;
    const validation = validateCatalogPrescribedSideDraftForSubmit(sessionDrafts);
    if (!validation.ok) {
      setSaveError(validation.error);
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/plans/from-catalog-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          treatmentProgramId: selectedProgram.id,
          assessmentId,
          catalogAssignmentRequestId: crypto.randomUUID(),
          sessions: buildCatalogPlanSessionsPayload(sessionDrafts),
        }),
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(mapPlanAssignHttpError(res.status, body));
      }

      onAssigned();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to assign catalog program.");
      setSaving(false);
    }
  }

  const applicableSessions = sessionDrafts.filter((session) => isApplicableCatalogSession(session));

  return (
    <div className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">Rehabilitation catalog program</h2>
        <p className="mt-1 text-xs text-white/35">
          Assign a published catalog program. Interactive Shoulder sessions require an explicit
          prescribed treatment side before submission.
        </p>
      </div>

      {loading && <p className="text-xs text-white/40">Loading catalog programs…</p>}
      {loadError && <p className="text-xs text-red-400/90">{loadError}</p>}

      {!loading && programs.length === 0 && !loadError && (
        <p className="text-xs text-white/40">No published catalog programs are available.</p>
      )}

      {programs.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => selectProgram(program)}
              className={`rounded-[7px] border px-4 py-3 text-left transition ${
                selectedProgramId === program.id
                  ? "border-[#1D9E75]/40 bg-[#1D9E75]/8"
                  : "border-[#1E2D42] bg-[#0B1220] hover:border-[#1D9E75]/20"
              }`}
            >
              <p className="text-sm font-semibold text-white">{program.name}</p>
              <p className="mt-0.5 text-xs text-white/30">
                {program.sessions.length} session{program.sessions.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedProgram && (
        <div className="space-y-4 border-t border-[#1E2D42] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/30">
            Review before assignment
          </p>

          {applicableSessions.length > 0 && (
            <ul className="space-y-1 text-sm text-white/75">
              {applicableSessions.map((session) => (
                <li key={session.sessionNumber}>
                  Session {session.sessionNumber} — {formatPrescribedSideForReview(session.prescribedSide)}
                </li>
              ))}
            </ul>
          )}

          {sessionDrafts.map((session) =>
            isApplicableCatalogSession(session) ? (
              <PrescribedSideSelector
                key={session.sessionNumber}
                sessionLabel={`Session ${session.sessionNumber}`}
                value={session.prescribedSide}
                onChange={(side) => updateSessionDraft(session.sessionNumber, side)}
                disabled={saving}
              />
            ) : null,
          )}

          {saveError && (
            <p className="text-xs text-red-400/90" role="alert">
              {saveError === PRESCRIBED_SIDE_UNAVAILABLE_MESSAGE ? saveError : saveError}
            </p>
          )}

          <button
            type="button"
            onClick={handleCatalogAssign}
            disabled={saving}
            className="rounded-[7px] bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-[#0B1220] transition hover:bg-[#5DCAA5] disabled:opacity-50"
          >
            {saving ? "Assigning…" : "Assign catalog program"}
          </button>
        </div>
      )}
    </div>
  );
}
