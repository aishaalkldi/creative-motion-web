"use client";

import { useCallback, useState } from "react";
import {
  parseStoredExtraction,
  type StructuredExtraction,
} from "@/app/lib/reports/chief-complaint-extraction";

export { parseStoredExtraction, type StructuredExtraction };

/**
 * Clinician-facing display of the chief-complaint AI extraction
 * (POST /api/assessments/[id]/extract, PATCH /api/assessments/[id]).
 * Pure parsing lives in app/lib/reports/chief-complaint-extraction.ts.
 */

// ── Pure types and helpers (exported for focused unit testing) ─────────────

/** Accepts only a value that parses to a real date; otherwise no timestamp is shown. */
export function parseGeneratedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

/** Strict equality only — anything but a literal `true` is treated as unconfirmed. */
export function parseReviewed(value: unknown): boolean {
  return value === true;
}

export function isLowConfidence(extraction: StructuredExtraction): boolean {
  return extraction.confidence < 0.5;
}

export type ExtractionPanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unavailable" }
  | {
      kind: "extracted";
      extraction: StructuredExtraction;
      generatedAt: string | null;
      reviewed: boolean;
    };

/** Derives the panel's starting state from already-stored submissionMeta values. */
export function deriveInitialState(
  initialExtraction: unknown,
  initialGeneratedAt: unknown,
  initialReviewed: unknown,
): ExtractionPanelState {
  const extraction = parseStoredExtraction(initialExtraction);
  if (!extraction) return { kind: "idle" };
  return {
    kind: "extracted",
    extraction,
    generatedAt: parseGeneratedAt(initialGeneratedAt),
    reviewed: parseReviewed(initialReviewed),
  };
}

export type ExtractionApiResponse = {
  extraction: StructuredExtraction;
  generatedAt: string | null;
  reviewed: boolean;
};

/** Validates a POST /api/assessments/[id]/extract response before it is ever displayed. */
export function parseExtractionApiResponse(value: unknown): ExtractionApiResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const extraction = parseStoredExtraction(record.extraction);
  if (!extraction) return null;
  return {
    extraction,
    generatedAt: parseGeneratedAt(record.generatedAt),
    // Strict === true: a fresh extraction's own reviewed:false, a missing
    // field, or any malformed value all default to unconfirmed — never
    // automatically confirmed.
    reviewed: parseReviewed(record.reviewed),
  };
}

export function deriveStateFromExtractionResponse(
  response: ExtractionApiResponse,
): ExtractionPanelState {
  return {
    kind: "extracted",
    extraction: response.extraction,
    generatedAt: response.generatedAt,
    reviewed: response.reviewed,
  };
}

/** Validates a PATCH /api/assessments/[id] confirmation response. */
export function parseConfirmApiResponse(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>).reviewed === true;
}

export type PanelViewModel = {
  originalText: string;
  panelKind: ExtractionPanelState["kind"];
  extraction: StructuredExtraction | null;
  generatedAt: string | null;
  reviewed: boolean;
  confidenceWarningText: string | null;
  reviewStatusText: string;
};

/**
 * Assembles everything the component renders. originalText passes through
 * untouched — no transformation is ever applied to the patient's statement.
 */
export function buildPanelViewModel(originalText: string, state: ExtractionPanelState): PanelViewModel {
  if (state.kind === "extracted") {
    return {
      originalText,
      panelKind: "extracted",
      extraction: state.extraction,
      generatedAt: state.generatedAt,
      reviewed: state.reviewed,
      confidenceWarningText: isLowConfidence(state.extraction) ? "Needs careful review" : null,
      reviewStatusText: state.reviewed
        ? "Confirmed by clinician."
        : "Not confirmed — Clinician review required.",
    };
  }
  return {
    originalText,
    panelKind: state.kind,
    extraction: null,
    generatedAt: null,
    reviewed: false,
    confidenceWarningText: null,
    reviewStatusText: state.kind === "unavailable" ? "Extraction unavailable." : "",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  assessmentId?: string;
  originalText: string;
  initialExtraction?: unknown;
  initialGeneratedAt?: unknown;
  initialReviewed?: unknown;
};

export function ExtractedFieldsPanel({
  assessmentId,
  originalText,
  initialExtraction,
  initialGeneratedAt,
  initialReviewed,
}: Props) {
  const [state, setState] = useState<ExtractionPanelState>(() =>
    deriveInitialState(initialExtraction, initialGeneratedAt, initialReviewed),
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Explicit-click only — never called from an effect, mount, or render.
  const runExtraction = useCallback(async () => {
    if (!assessmentId || state.kind === "loading") return;
    setState({ kind: "loading" });
    setConfirmError("");
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as unknown;
      const parsed = res.ok ? parseExtractionApiResponse(data) : null;
      if (!parsed) {
        setState({ kind: "unavailable" });
        return;
      }
      setState(deriveStateFromExtractionResponse(parsed));
    } catch {
      setState({ kind: "unavailable" });
    }
  }, [assessmentId, state.kind]);

  // Explicit-click only — never called from an effect, mount, render, or
  // as a side effect of a successful extraction.
  const confirmExtraction = useCallback(async () => {
    if (!assessmentId || state.kind !== "extracted" || state.reviewed || confirming) return;
    setConfirming(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markChiefComplaintExtractionReviewed: true }),
      });
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok || !parseConfirmApiResponse(data)) {
        setConfirmError("Could not confirm extraction. Try again.");
        return;
      }
      setState((prev) => (prev.kind === "extracted" ? { ...prev, reviewed: true } : prev));
    } catch {
      setConfirmError("Could not confirm extraction. Try again.");
    } finally {
      setConfirming(false);
    }
  }, [assessmentId, state, confirming]);

  const view = buildPanelViewModel(originalText, state);

  return (
    <div className="mt-3 space-y-2 rounded-[7px] border border-[#1E2D42] bg-[#0F1825] p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Original patient statement
        </p>
        <p dir="auto" className="mt-0.5 text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
          {view.originalText}
        </p>
      </div>

      {view.panelKind === "idle" ? (
        <button
          type="button"
          onClick={() => void runExtraction()}
          disabled={!assessmentId}
          className="rounded-[6px] border border-[#1E2D42] bg-transparent px-2.5 py-[3px] text-[10px] text-[#6B7280] transition hover:border-[#1D9E75]/40 hover:text-[#9CA3AF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run AI extraction
        </button>
      ) : null}

      {view.panelKind === "loading" ? (
        <p className="text-[11px] italic text-[#9CA3AF]">Running AI extraction…</p>
      ) : null}

      {view.panelKind === "unavailable" ? (
        <div className="space-y-1.5">
          <p className="text-[10px] italic text-rose-300/90">{view.reviewStatusText}</p>
          <button
            type="button"
            onClick={() => void runExtraction()}
            className="rounded-[6px] border border-[#1E2D42] bg-transparent px-2.5 py-[3px] text-[10px] text-[#9CA3AF] transition hover:border-[#1D9E75]/40 hover:text-[#5DCAA5]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {view.panelKind === "extracted" && view.extraction ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5DCAA5]">
              AI-generated structured fields
            </p>
            <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
              <PanelField label="Body region" value={view.extraction.body_region} />
              <PanelField label="Side" value={view.extraction.side} />
              <PanelField label="Primary symptom" value={view.extraction.primary_symptom} />
              <PanelField label="Aggravating factor" value={view.extraction.aggravating_factor ?? "—"} />
            </div>
            {view.confidenceWarningText ? (
              <p className="mt-1.5 text-[10px] italic text-amber-300/90">{view.confidenceWarningText}</p>
            ) : null}
          </div>

          <p className="text-[10px] italic text-[#9CA3AF] print:hidden">
            AI-assisted extraction · Clinician review required before clinical use
            {view.generatedAt ? ` · ${formatExtractionGeneratedAt(view.generatedAt)}` : ""}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2D42] pt-2">
            <p className={`text-[10px] ${view.reviewed ? "text-[#5DCAA5]" : "text-[#6B7280]"}`}>
              {view.reviewStatusText}
            </p>
            {!view.reviewed ? (
              <button
                type="button"
                onClick={() => void confirmExtraction()}
                disabled={confirming}
                className="rounded-[6px] bg-[#1D9E75] px-2.5 py-[3px] text-[10px] font-medium text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? "Confirming…" : "Confirm extraction"}
              </button>
            ) : null}
          </div>
          {confirmError ? <p className="text-[10px] text-rose-300/90">{confirmError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function formatExtractionGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function PanelField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-2 py-1.5">
      <p className="text-[9px] font-medium uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 text-xs text-white/85">{value}</p>
    </div>
  );
}
