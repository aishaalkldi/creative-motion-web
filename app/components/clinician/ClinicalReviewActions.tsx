"use client";

import { useState } from "react";
import {
  clinicalActionNeedsTherapistReview,
  type ClinicalActionStatus,
} from "@/app/lib/clinical-action-engine";
import { isUrgentClinicalReviewStatus } from "@/app/lib/clinical-review";

type ClinicalReviewActionsProps = {
  patientId: string;
  planId: string;
  sessionLogId?: string | null;
  actionStatus: ClinicalActionStatus;
  reviewAcknowledged: boolean;
  reviewedAt?: string | null;
  onAcknowledged?: (reviewedAt: string) => void;
  compact?: boolean;
};

export function ClinicalReviewActions({
  patientId,
  planId,
  sessionLogId,
  actionStatus,
  reviewAcknowledged,
  reviewedAt,
  onAcknowledged,
  compact = false,
}: ClinicalReviewActionsProps) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(reviewAcknowledged);
  const [acknowledgedAt, setAcknowledgedAt] = useState(reviewedAt ?? null);

  const canReview =
    clinicalActionNeedsTherapistReview(actionStatus) &&
    isUrgentClinicalReviewStatus(actionStatus) &&
    !acknowledged;

  if (!clinicalActionNeedsTherapistReview(actionStatus)) {
    return null;
  }

  if (acknowledged) {
    return (
      <p className={`text-[#5DCAA5] ${compact ? "mt-3 text-[11px]" : "mt-4 text-xs"}`}>
        Marked as reviewed
        {acknowledgedAt
          ? ` · ${new Date(acknowledgedAt).toLocaleString()}`
          : ""}
      </p>
    );
  }

  if (!canReview) {
    return null;
  }

  async function handleMarkReviewed() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clinician/clinical-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          planId,
          sessionLogId: sessionLogId ?? null,
          actionStatus,
          reviewNote: note.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        reviewedAt?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to mark as reviewed (${res.status})`);
      }
      const at = body.reviewedAt ?? new Date().toISOString();
      setAcknowledged(true);
      setAcknowledgedAt(at);
      onAcknowledged?.(at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as reviewed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional review note for your records…"
          rows={2}
          className="mb-2 w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#1D9E75]/40 focus:outline-none"
        />
      )}
      {error && (
        <p className="mb-2 text-[11px] text-rose-300">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleMarkReviewed()}
          disabled={saving}
          className="inline-flex rounded-[7px] border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/20 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Mark as reviewed"}
        </button>
        {!showNote && (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="inline-flex rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white/75"
          >
            Add note
          </button>
        )}
      </div>
    </div>
  );
}
