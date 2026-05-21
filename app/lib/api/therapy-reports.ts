/**
 * Camera CV therapy reports — FastAPI `/api/v1/therapy/camera-reports`.
 * Requests go through Next.js rewrites to BACKEND_URL.
 */

import { getAuthHeaders } from "../auth";
import { postCameraTherapyReport } from "./therapy";

export type CameraTherapyReportCreate = {
  patient_id: number;
  assessment_id?: number | null;
  client_session_id: string;
  source: "assessment" | "library";
  program_id: string;
  phase: string;
  session_type: string;
  mode?: string;
  program_label?: string | null;
  exercise_name?: string | null;
  therapy_context_reason?: string | null;
  recorded_at: string;
  metrics: Record<string, unknown>;
  therapy_recommendation?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
};

export type CameraTherapyReportOut = {
  id: number;
  patient_id: number;
  assessment_id: number | null;
  client_session_id: string;
  source: string;
  program_id: string;
  phase: string;
  session_type: string;
  mode: string;
  program_label: string | null;
  exercise_name: string | null;
  therapy_context_reason: string | null;
  recorded_at: string;
  metrics: Record<string, unknown>;
  therapy_recommendation: Record<string, unknown> | null;
  provenance: Record<string, unknown>;
  created_at: string;
};

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

export async function createCameraTherapyReport(
  body: CameraTherapyReportCreate,
): Promise<CameraTherapyReportOut> {
  const out = await postCameraTherapyReport(body);
  if (!out) {
    throw new Error(
      "Therapy camera report was not sent (missing auth token or request skipped)",
    );
  }
  return out;
}

export async function listCameraTherapyReports(
  patientId: number,
  assessmentId?: number,
): Promise<CameraTherapyReportOut[]> {
  const q = new URLSearchParams({ patient_id: String(patientId) });
  if (assessmentId != null && Number.isFinite(assessmentId)) {
    q.set("assessment_id", String(assessmentId));
  }
  const res = await fetch(`/api/v1/therapy/camera-reports?${q.toString()}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return res.json() as Promise<CameraTherapyReportOut[]>;
}
