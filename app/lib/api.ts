import { type ClinicianInfo, getAuthHeaders, setAuthSession } from "./auth";

// ── Auth ──────────────────────────────────────────────────────────────

export type LoginResponse = {
  access_token: string;
  token_type: string;
  clinician: ClinicianInfo;
};

/**
 * Authenticates a clinician and stores the JWT + session cookie.
 * Backend expects application/x-www-form-urlencoded (OAuth2PasswordRequestForm).
 */
export async function loginClinician(
  email: string,
  password: string
): Promise<LoginResponse> {
  const body = new URLSearchParams({ username: email, password });
  const response = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Invalid email or password.";
    try {
      const err = (await response.json()) as { detail?: string };
      if (typeof err.detail === "string") message = err.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  const data = (await response.json()) as LoginResponse;
  setAuthSession(data.access_token, data.clinician);
  return data;
}

export type RegisterPayload = {
  full_name: string;
  email: string;
  password: string;
};

/** Registers a new clinician account. Does NOT auto-login. */
export async function registerClinician(payload: RegisterPayload): Promise<ClinicianInfo> {
  const response = await fetch(`${baseUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Registration failed.";
    try {
      const err = (await response.json()) as { detail?: string };
      if (typeof err.detail === "string") message = err.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await response.json()) as ClinicianInfo;
}

// ── Patients ──────────────────────────────────────────────────────────

/** Matches FastAPI `PatientOut` exactly. */
export type BackendPatient = {
  id: number;
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  sport: string | null;
  diagnosis: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Matches FastAPI `PatientCreate`. */
export type CreatePatientPayload = {
  full_name: string;
  phone: string;
  age?: number | string | null;
  gender?: string | null;
  sport?: string | null;
  diagnosis: string;
  status?: string | null;
};

/** Returns true if the phone number is already registered to another patient. */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  const response = await fetch(
    `${baseUrl()}/patients/check-phone?phone=${encodeURIComponent(phone.trim())}`,
    {
      method: "GET",
      headers: { Accept: "application/json", ...getAuthHeaders() },
      cache: "no-store",
    }
  );
  if (!response.ok) return false;
  const data = (await response.json()) as { exists: boolean };
  return data.exists;
}

export async function getPatients(): Promise<BackendPatient[]> {
  const response = await fetch(`${baseUrl()}/patients`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load patients (${response.status}).`);
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as BackendPatient[]) : [];
}

export async function createPatient(payload: CreatePatientPayload): Promise<BackendPatient> {
  const rawAge = payload.age;
  const age =
    rawAge === null || rawAge === undefined || rawAge === ""
      ? null
      : typeof rawAge === "number"
        ? rawAge
        : parseInt(String(rawAge), 10) || null;

  const response = await fetch(`${baseUrl()}/patients`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      full_name: payload.full_name.trim(),
      phone: payload.phone.trim(),
      age,
      gender: payload.gender?.trim() || null,
      sport: payload.sport?.trim() || null,
      diagnosis: payload.diagnosis.trim(),
      status: payload.status?.trim() || "Active",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Failed to save patient (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await response.json()) as BackendPatient;
}

// ── Assessments ───────────────────────────────────────────────────────

/** Matches FastAPI `AssessmentOut`. */
export type AssessmentOut = {
  id: number;
  patient_id: number;
  clinician_id: number | null;
  type: string;
  selected_tests: string[];
  mode: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Matches FastAPI `AssessmentCreate`. */
export type AssessmentCreate = {
  patient_id: number;
  type: string;
  selected_tests?: string[];
  mode?: string | null;
  status?: string;
  notes?: string | null;
};

export async function createAssessment(payload: AssessmentCreate): Promise<AssessmentOut> {
  const response = await fetch(`${baseUrl()}/assessments`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      patient_id: payload.patient_id,
      type: payload.type,
      selected_tests: payload.selected_tests ?? [],
      mode: payload.mode ?? null,
      status: payload.status ?? "pending",
      notes: payload.notes ?? null,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Failed to create assessment (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await response.json()) as AssessmentOut;
}

export async function getAssessment(assessmentId: number): Promise<AssessmentOut> {
  const response = await fetch(`${baseUrl()}/assessments/${assessmentId}`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load assessment (${response.status}).`);
  return (await response.json()) as AssessmentOut;
}

export async function getPatientAssessments(patientId: number): Promise<AssessmentOut[]> {
  const response = await fetch(`${baseUrl()}/patients/${patientId}/assessments`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load assessments (${response.status}).`);
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as AssessmentOut[]) : [];
}

// ── Results ───────────────────────────────────────────────────────────

/** Matches FastAPI `ResultOut`. */
export type ResultOut = {
  id: number;
  patient_id: number;
  assessment_id: number;
  test_name: string;
  score: number | null;
  reps: number | null;
  duration: number | null;
  movement_metrics: Record<string, unknown> | null;
  summary: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  created_at: string;
};

export type SOAPNotes = {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

/** Matches FastAPI `ResultCreate`. */
export type ResultCreate = {
  patient_id: number;
  assessment_id: number;
  test_name: string;
  score?: number | null;
  reps?: number | null;
  duration?: number | null;
  movement_metrics?: Record<string, unknown> | null;
  summary?: string | null;
  soap?: SOAPNotes | null;
};

export async function saveResult(payload: ResultCreate): Promise<ResultOut> {
  const response = await fetch(`${baseUrl()}/results`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Failed to save result (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await response.json()) as ResultOut;
}

export async function getResultsByAssessment(assessmentId: number): Promise<ResultOut[]> {
  const response = await fetch(`${baseUrl()}/results/${assessmentId}`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load results (${response.status}).`);
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as ResultOut[]) : [];
}

export async function getResultsByPatient(patientId: number): Promise<ResultOut[]> {
  const response = await fetch(`${baseUrl()}/patients/${patientId}/results`, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load results (${response.status}).`);
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as ResultOut[]) : [];
}

// ── Config (private) ──────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function baseUrl(): string {
  if (!API_BASE_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  return API_BASE_URL;
}
