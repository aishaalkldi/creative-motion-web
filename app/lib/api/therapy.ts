/**
 * Therapy camera-report delivery — POST /api/v1/therapy/camera-reports
 * with auth, dedupe, and a single retry on transient failures.
 */

import { getToken } from "../auth";
import type {
  CameraTherapyReportCreate,
  CameraTherapyReportOut,
} from "./therapy-reports";

function readAccessToken(): string | null {
  const primary = getToken();
  if (primary) return primary;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return JSON.stringify(j.detail);
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/** Game / product payload (API body uses snake_case; backend source is assessment | library only). */
export type TherapySessionSendPayload = {
  patient_id: number;
  assessment_id?: number;
  client_session_id: string;
  source?: "game" | "assessment" | "library";
  program_id: string;
  phase: string;
  session_type: string;
  mode: string;
  program_label: string;
  exercise_name: string;
  therapy_context_reason: string;
  recorded_at: string;
  metrics: {
    steps: number;
    left_steps: number;
    right_steps: number;
    symmetry: number;
    duration_sec: number;
    movement_quality?: number;
  };
  therapy_recommendation?: Record<string, unknown> | null;
};

export function mapTherapySessionPayloadToCreate(
  data: TherapySessionSendPayload,
): CameraTherapyReportCreate {
  const requested = data.source ?? "game";
  const apiSource = requested === "assessment" ? "assessment" : "library";
  const metrics: Record<string, unknown> = {
    steps: data.metrics.steps,
    left_steps: data.metrics.left_steps,
    right_steps: data.metrics.right_steps,
    symmetry: data.metrics.symmetry,
    duration_sec: data.metrics.duration_sec,
  };
  if (
    data.metrics.movement_quality != null &&
    Number.isFinite(data.metrics.movement_quality)
  ) {
    metrics.movement_quality = data.metrics.movement_quality;
  }
  const assessment_id =
    data.assessment_id != null && Number.isFinite(data.assessment_id)
      ? data.assessment_id
      : null;
  return {
    patient_id: data.patient_id,
    assessment_id,
    client_session_id: data.client_session_id,
    source: apiSource,
    program_id: data.program_id,
    phase: data.phase,
    session_type: data.session_type,
    mode: data.mode,
    program_label: data.program_label,
    exercise_name: data.exercise_name,
    therapy_context_reason: data.therapy_context_reason,
    recorded_at: data.recorded_at,
    metrics,
    therapy_recommendation: data.therapy_recommendation ?? null,
    provenance: {
      client: "creative-motion-web",
      requested_source: requested,
      flow: "gait_cv_game",
    },
  };
}

const inFlight = new Map<string, Promise<CameraTherapyReportOut | null>>();

async function postCameraReportOnce(
  body: CameraTherapyReportCreate,
  token: string | null,
): Promise<CameraTherapyReportOut> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch("/api/v1/therapy/camera-reports", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await parseErrorMessage(res);
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<CameraTherapyReportOut>;
}

/**
 * Sends a camera therapy report. Returns null if there is no token (local-only / offline auth).
 * Deduplicates concurrent posts with the same client_session_id.
 */
export async function postCameraTherapyReport(
  body: CameraTherapyReportCreate,
): Promise<CameraTherapyReportOut | null> {
  const token = readAccessToken();
  if (!token) {
    console.warn(
      "[therapy] No access token (cm_access_token / access_token); skipping camera report POST",
    );
    return null;
  }

  const key = body.client_session_id;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<CameraTherapyReportOut | null> => {
    try {
      const attempt = async () => postCameraReportOnce(body, token);
      try {
        const out = await attempt();
        console.log("Therapy session sent");
        return out;
      } catch (first) {
        const err = first as Error & { status?: number };
        const status = err.status;
        const retry =
          status == null ||
          isRetryableStatus(status) ||
          err.message === "Failed to fetch";
        if (!retry) {
          console.error("[therapy] Camera report failed:", err.message);
          throw err;
        }
        const out = await attempt();
        console.log("Therapy session sent");
        return out;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[therapy] Camera report failed:", msg);
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Map game metrics to API shape and POST (same pipeline as persistence). */
export async function sendTherapySession(
  data: TherapySessionSendPayload,
): Promise<CameraTherapyReportOut | null> {
  return postCameraTherapyReport(mapTherapySessionPayloadToCreate(data));
}
