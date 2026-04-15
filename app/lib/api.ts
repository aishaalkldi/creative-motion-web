export type BackendPatient = {
  id: string;
  patient_code: string;
  name: string;
  phone: string;
  age: number | string | null;
  gender: string | null;
  diagnosis: string | null;
  condition: string | null;
  status: string | null;
};

export type BackendResult = {
  id: string;
  patient_id: string;
  test: string;
  score: number | string | null;
};

/** Body for `POST /patients` (matches FastAPI `Patient` model). */
export type CreatePatientPayload = {
  patient_code: string;
  name: string;
  phone: string;
  age?: string | null;
  gender?: string | null;
  diagnosis: string;
  condition?: string | null;
  status?: string | null;
};

/** Row from `assessments` table (POST submit + GET by patient). */
export type BackendAssessmentHistory = {
  id: number;
  patient_code: string;
  assessment_id: string;
  test_type: string;
  score: number;
  summary: string;
  created_at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function getPatients(): Promise<BackendPatient[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/patients`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load patients (${response.status}).`);
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as BackendPatient[]) : [];
}

export async function saveAssessmentRecord(payload: {
  patient_code: string;
  assessment_id: string;
  test_type: string;
  score: number;
  summary: string;
}): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/assessments`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_code: payload.patient_code.trim(),
      assessment_id: payload.assessment_id.trim(),
      test_type: payload.test_type.trim(),
      score: payload.score,
      summary: payload.summary.trim(),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Failed to save assessment (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
}

export async function getAssessmentsForPatient(
  patientCode: string
): Promise<BackendAssessmentHistory[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const code = patientCode.trim();
  const response = await fetch(
    `${API_BASE_URL}/patients/${encodeURIComponent(code)}/assessments`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load assessment history (${response.status}).`);
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as BackendAssessmentHistory[]) : [];
}

export async function createPatient(payload: CreatePatientPayload): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const body = {
    patient_code: payload.patient_code.trim(),
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    age: payload.age?.trim() ?? "",
    gender: payload.gender?.trim() ?? "",
    diagnosis: payload.diagnosis.trim(),
    condition: payload.condition?.trim() ?? "",
    status: (payload.status?.trim() || "Active") as string,
  };

  const response = await fetch(`${API_BASE_URL}/patients`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Failed to save patient (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
}

/** Persists a row in the `results` table (used by `/results` review). Separate from `saveAssessmentRecord` (`/assessments`). */
export async function saveMotionResultRecord(payload: {
  patient_id: string;
  test: string;
  score: number;
}): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/results`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_id: payload.patient_id.trim(),
      test: payload.test.trim(),
      score: payload.score,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Failed to save motion result (${response.status}).`;
    try {
      const err = (await response.json()) as { detail?: string | unknown };
      if (typeof err.detail === "string") message = err.detail;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
}

export async function getResults(): Promise<BackendResult[]> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/results`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load results (${response.status}).`);
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as BackendResult[]) : [];
}
