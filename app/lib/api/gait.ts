/**
 * Gait AI — API integration layer.
 *
 * Calls the separate "creative-motion-gait-ai" backend service.
 *
 * Environment variable:
 *   NEXT_PUBLIC_GAIT_AI_URL — base URL of the gait AI service.
 *   Defaults to http://127.0.0.1:8001.
 *
 * CORS note: the gait AI server must allow requests from the Next.js origin
 * (or a server-side proxy can be added to next.config.ts when deployed).
 *
 * Endpoint used: POST /analyze-gait
 * Body: multipart/form-data with field "video" (File).
 */

// ─── Raw metric values from the gait AI ───────────────────────────────────────

export type GaitMetrics = {
  /** Steps per minute. */
  cadence_steps_per_min?: number | null;
  /** Average stride length in centimetres. */
  stride_length_cm?: number | null;
  /** Left/right step-time symmetry as a percentage (100 = perfect). */
  step_symmetry_pct?: number | null;
  /** Walking speed in metres per second. */
  gait_speed_m_per_s?: number | null;
  /** Fraction of gait cycle spent in stance phase (0–1). */
  stance_time_ratio?: number | null;
  /** Fraction of gait cycle spent in swing phase (0–1). */
  swing_time_ratio?: number | null;
  /** Percentage of gait cycle with both feet in contact. */
  double_support_pct?: number | null;
  /** Any additional metric the backend may return. */
  [key: string]: number | string | null | undefined;
};

// ─── Four structured output sections ──────────────────────────────────────────

export type GaitObjectiveFindings = {
  /** Composite gait score 0–100. */
  overall_score?: number | null;
  /** E.g. "Normal", "Mild deviation", "Significant deviation". */
  classification?: string | null;
  metrics?: GaitMetrics;
  /** List of flagged deviations, e.g. ["Reduced cadence", "Asymmetric stance"]. */
  flags?: string[];
};

export type GaitClinicalInterpretation = {
  /** Short paragraph interpretation. */
  summary?: string | null;
  /** E.g. "Mild", "Moderate", "Severe". */
  severity?: string | null;
  /** E.g. "Functional", "Sub-clinical", "Requires intervention". */
  impairment_level?: string | null;
  /** Extended clinical narrative. */
  details?: string | null;
};

export type GaitRecommendations = {
  /** Single primary recommendation sentence. */
  primary?: string | null;
  /** Ordered exercise / intervention plan items. */
  exercise_plan?: string[] | null;
  /** Referral suggestions, e.g. ["Orthopaedic review", "Physiotherapy programme"]. */
  referrals?: string[] | null;
  /** E.g. "4 weeks", "3 months". */
  reassessment_timeline?: string | null;
};

export type GaitConfidenceLimitations = {
  /** AI confidence in the analysis, 0–1. */
  confidence_score?: number | null;
  /** E.g. "Good", "Acceptable", "Poor — re-record recommended". */
  video_quality?: string | null;
  /** Known limitations of this analysis run. */
  limitations?: string[] | null;
  /** Free-text notes from the model. */
  notes?: string | null;
};

/** Full response envelope from POST /analyze-gait. */
export type GaitAnalysisResponse = {
  status?: string;
  patient_id?: string | null;
  analysis_id?: string | null;
  objective_findings?: GaitObjectiveFindings;
  clinical_interpretation?: GaitClinicalInterpretation;
  recommendations?: GaitRecommendations;
  confidence_limitations?: GaitConfidenceLimitations;
};

// ─── API call ─────────────────────────────────────────────────────────────────

function gaitAiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_GAIT_AI_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : "http://127.0.0.1:8001";
}

/**
 * Send a video file to the gait AI service and return structured analysis.
 * Returns a typed response or throws an Error with a user-readable message.
 */
export async function analyzeGaitVideo(
  file: File
): Promise<GaitAnalysisResponse> {
  const form = new FormData();
  form.append("video", file);

  const response = await fetch(`${gaitAiBaseUrl()}/analyze-gait`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = `Gait AI returned an error (HTTP ${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string };
      if (typeof err.detail === "string") detail = err.detail;
    } catch { /* keep default */ }
    throw new Error(detail);
  }

  return (await response.json()) as GaitAnalysisResponse;
}
