"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_CLINICIAN_SUMMARY_DISCLAIMER,
  AI_CLINICIAN_SUMMARY_V2_SECTION_LABELS,
  type AiClinicianSummaryV2Sections,
} from "@/app/lib/ai/clinician-summary-constants";
import {
  clearApprovedAiSummary,
  loadApprovedAiSummary,
  saveApprovedAiSummary,
} from "@/app/lib/ai/clinician-summary-storage";

type AiSessionSummaryResponse = {
  draftSummary: string;
  sections?: AiClinicianSummaryV2Sections;
  disclaimer: string;
  generatedAt: string;
  schemaVersion: string;
  inputsSnapshot: {
    sessionsCompleted: number;
    totalSessions: number;
    cvSessionCount: number;
    assessmentIncluded: boolean;
  };
  fallback?: boolean;
  warning?: string;
};

type CardState = "idle" | "loading" | "ready" | "approved" | "dismissed";

type AiClinicianSummaryCardProps = {
  patientId: string;
  planId: string | null;
};

function dismissStorageKey(patientId: string, planId: string | null): string {
  return `rasq-ai-summary-dismissed:${patientId}:${planId ?? "latest"}`;
}

export function AiClinicianSummaryCard({ patientId, planId }: AiClinicianSummaryCardProps) {
  const [cardState, setCardState] = useState<CardState>("idle");
  const [draftSummary, setDraftSummary] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sections, setSections] = useState<AiClinicianSummaryV2Sections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(dismissStorageKey(patientId, planId));
      if (dismissed === "1") {
        setCardState("dismissed");
        return;
      }
      const approved = loadApprovedAiSummary(patientId, planId);
      if (approved) {
        setDraftSummary(approved.summary);
        setGeneratedAt(approved.generatedAt);
        setCardState("approved");
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [patientId, planId]);

  const generateSummary = useCallback(async () => {
    setCardState("loading");
    setError(null);
    setFallbackNotice(null);
    setIsEditing(false);

    try {
      const res = await fetch("/api/clinician/ai-session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          ...(planId ? { planId } : {}),
        }),
      });

      const data = (await res.json()) as AiSessionSummaryResponse & {
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        const isRateLimited =
          res.status === 429 || data.code === "AI_RATE_LIMITED";
        if (isRateLimited) {
          setError(null);
          setFallbackNotice(
            "AI draft is temporarily unavailable. A rules-based clinician summary is shown below.",
          );
          setCardState("idle");
          return;
        }
        setError(data.error ?? "Unable to generate summary.");
        setCardState("idle");
        return;
      }

      setDraftSummary(data.draftSummary);
      setSections(data.sections ?? null);
      setEditedSummary(null);
      setGeneratedAt(data.generatedAt);
      if (data.fallback) {
        setFallbackNotice(
          data.warning ??
            "AI output was unavailable or did not pass safety checks. Showing a structured fallback summary.",
        );
      }
      setCardState("ready");
      try {
        sessionStorage.removeItem(dismissStorageKey(patientId, planId));
      } catch {
        /* ignore */
      }
    } catch {
      setError("Unable to generate summary.");
      setCardState("idle");
    }
  }, [patientId, planId]);

  const handleDismiss = () => {
    setCardState("dismissed");
    setDraftSummary(null);
    setEditedSummary(null);
    setIsEditing(false);
    setGeneratedAt(null);
    setFallbackNotice(null);
    clearApprovedAiSummary(patientId, planId);
    try {
      sessionStorage.setItem(dismissStorageKey(patientId, planId), "1");
    } catch {
      /* ignore */
    }
  };

  const handleApprove = () => {
    const text = (editedSummary ?? draftSummary)?.trim();
    if (text && generatedAt) {
      saveApprovedAiSummary(patientId, planId, {
        summary: text,
        generatedAt,
        approvedAt: new Date().toISOString(),
      });
    }
    setCardState("approved");
    setIsEditing(false);
    try {
      sessionStorage.removeItem(dismissStorageKey(patientId, planId));
    } catch {
      /* ignore */
    }
  };

  const displayText = editedSummary ?? draftSummary;

  if (cardState === "dismissed") {
    return null;
  }

  return (
    <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
            AI clinical summary v2 — clinician review required
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            {AI_CLINICIAN_SUMMARY_DISCLAIMER}
          </p>
        </div>
        {cardState === "approved" && (
          <span className="rounded-[5px] border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            Approved locally
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-[6px] border border-rose-400/25 bg-rose-400/5 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {fallbackNotice && (
        <div className="mt-3 rounded-[6px] border border-amber-400/25 bg-amber-400/5 px-3 py-2">
          <p className="text-xs text-amber-200">{fallbackNotice}</p>
          {cardState === "idle" ? (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
              Rules-based fallback · clinician review required
            </p>
          ) : null}
        </div>
      )}

      {isEditing && displayText != null ? (
        <textarea
          value={editedSummary ?? draftSummary ?? ""}
          onChange={(e) => setEditedSummary(e.target.value)}
          rows={5}
          className="mt-4 w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5 text-sm leading-relaxed text-white/80 outline-none focus:border-[#1D9E75]/40"
        />
      ) : sections && !isEditing ? (
        <div className="mt-4 space-y-3">
          {(Object.keys(AI_CLINICIAN_SUMMARY_V2_SECTION_LABELS) as (keyof AiClinicianSummaryV2Sections)[]).map(
            (key) => (
              <div key={key} className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  {AI_CLINICIAN_SUMMARY_V2_SECTION_LABELS[key]}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/75 whitespace-pre-wrap">
                  {sections[key]}
                </p>
              </div>
            ),
          )}
        </div>
      ) : displayText ? (
        <p className="mt-4 text-sm leading-relaxed text-white/75 whitespace-pre-wrap">
          {displayText}
        </p>
      ) : null}

      {generatedAt && displayText && (
        <p className="mt-2 text-[11px] text-white/25">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generateSummary()}
          disabled={cardState === "loading"}
          className="rounded-[7px] border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3.5 py-2 text-xs font-semibold text-[#5DCAA5] transition hover:bg-[#1D9E75]/15 disabled:opacity-50"
        >
          {cardState === "loading"
            ? "Generating…"
            : displayText
              ? "Regenerate"
              : "Generate summary"}
        </button>

        {displayText && cardState !== "approved" && (
          <>
            <button
              type="button"
              onClick={handleApprove}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing((prev) => !prev);
                if (!isEditing && editedSummary == null && draftSummary) {
                  setEditedSummary(draftSummary);
                }
              }}
              className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
            >
              {isEditing ? "Done editing" : "Edit"}
            </button>
          </>
        )}

        {displayText && (
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-2 text-xs font-semibold text-white/50 transition hover:text-white/70"
          >
            Dismiss
          </button>
        )}
      </div>
    </section>
  );
}
