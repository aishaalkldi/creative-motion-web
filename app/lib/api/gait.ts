/**
 * Gait AI — API integration layer.
 *
 * Talks to the separate "creative-motion-gait-ai" FastAPI service via the
 * Next.js server-side rewrite at /api/gait/* → http://127.0.0.1:8001/api/v1/gait/*.
 *
 * The rewrite is defined in next.config.ts, so CORS is not an issue and no
 * NEXT_PUBLIC_* env var is required for local development.
 *
 * Endpoint: POST /api/gait/analyze
 * Body:     multipart/form-data, field name "file" (video File).
 *
 * Response schema mirrors the Python GaitAnalysisResponse Pydantic model in
 * creative-motion-gait-ai/app/schemas.py.
 */

// ─── Response types (match Python schemas.py exactly) ─────────────────────────

export type GaitFeatures = {
  /** Walking speed in metres per second (10 m / elapsed time). */
  gait_speed_mps: number;
  /** Total steps detected across the full 10-metre walk. */
  step_count: number;
  /** Steps per minute. */
  cadence_spm: number;
  /** Step symmetry index: 1 = perfect, 0 = maximally asymmetric. */
  symmetry_score: number;
  /** Standard deviation of sagittal trunk angle in degrees (lower is better). */
  trunk_sway_score: number;
  /** Mean knee flexion angle in degrees across valid walking frames. */
  avg_knee_flexion: number;
  /** Mean hip flexion angle in degrees across valid walking frames. */
  avg_hip_flexion: number;
};

export type GaitSummary = {
  /** Ambulation category based on gait speed norms. */
  classification: string;
  /** Clinical flags triggered by rule-based analysis. */
  flags: string[];
  /** Actionable recommendations derived from flags. */
  recommendations: string[];
};

/**
 * Full gait analysis payload from the API, plus optional UI / legacy blocks
 * used by `app/results/page.tsx`.
 *
 * Note: `objective_findings`, `clinical_interpretation`, and `recommendations`
 * here are structured objects when present — not `string[]` / plain `string` —
 * because the results page reads nested fields (e.g. `overall_score`, `metrics`).
 */
export type GaitAnalysisResponse = {
  session_id: string;
  video_filename: string;
  duration_seconds: number;
  fps: number;
  total_frames: number;
  /** Frames that passed confidence filtering. */
  processed_frames: number;
  features: GaitFeatures;
  summary: GaitSummary;
  /** Relative path to the saved per-frame CSV on the gait AI server. */
  csv_path: string;

  /** Optional top-level flags (e.g. alternate API envelope). */
  flags?: string[];

  objective_findings?: {
    overall_score?: number | null;
    classification?: string | null;
    metrics?: {
      cadence_steps_per_min?: number | null;
      stride_length_cm?: number | null;
      step_symmetry_pct?: number | null;
      gait_speed_m_per_s?: number | null;
    };
    flags?: string[];
  };

  clinical_interpretation?: {
    severity?: string | null;
    impairment_level?: string | null;
    summary?: string | null;
    details?: string | null;
  };

  /** Object form for results UI (distinct from `summary.recommendations: string[]`). */
  recommendations?: {
    primary?: string | null;
    exercise_plan?: string[] | null;
    reassessment_timeline?: string | null;
    referrals?: string[] | null;
  };

  confidence_limitations?: {
    confidence_score?: number | null;
    video_quality?: string | null;
    limitations?: string[] | null;
    notes?: string | null;
  };
};

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Upload a side-view 10MWT video and receive structured gait analysis.
 *
 * Calls via the Next.js rewrite (/api/gait/analyze → gait AI backend).
 * Throws an Error with a user-readable message on any failure.
 */
export async function analyzeGaitVideo(
  file: File,
  signal?: AbortSignal
): Promise<GaitAnalysisResponse> {
  const form = new FormData();
  form.append("file", file); // gait AI expects field name "file"

  const response = await fetch("/api/gait/analyze", {
    method: "POST",
    body: form,
    signal,
  });

  if (!response.ok) {
    let detail = `Gait AI returned an error (HTTP ${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string };
      if (typeof err.detail === "string") detail = err.detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }

  return (await response.json()) as GaitAnalysisResponse;
}
