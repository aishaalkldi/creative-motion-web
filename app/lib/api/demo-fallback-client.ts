import type { PatientRow } from "@/app/lib/validate-patient-ownership";
import type { ClinicianResultsResponse } from "@/app/api/clinician/results/route";
import { DEMO_NOTICE } from "@/app/lib/demo/local-demo-fallback";

export type DemoAwarePayload = {
  demoMode?: boolean;
  demoNotice?: string | null;
};

export type DemoMeta = {
  demoMode: boolean;
  demoNotice: string | null;
};

export function extractDemoMeta(payload: DemoAwarePayload | null | undefined): DemoMeta {
  if (!payload?.demoMode) {
    return { demoMode: false, demoNotice: null };
  }
  return {
    demoMode: true,
    demoNotice: payload.demoNotice ?? DEMO_NOTICE,
  };
}

export type PatientsListPayload =
  | PatientRow[]
  | ({ patients: PatientRow[] } & DemoAwarePayload);

export function parsePatientsList(payload: PatientsListPayload): {
  patients: PatientRow[];
  demoMode: boolean;
  demoNotice: string | null;
} {
  if (Array.isArray(payload)) {
    return { patients: payload, demoMode: false, demoNotice: null };
  }
  const meta = extractDemoMeta(payload);
  return {
    patients: payload.patients ?? [],
    ...meta,
  };
}

export function mergeDemoMeta(
  current: DemoMeta,
  next: DemoMeta,
): DemoMeta {
  if (next.demoMode) return next;
  return current;
}

export function collectDemoMeta(...sources: Array<DemoAwarePayload | null | undefined>): DemoMeta {
  let meta: DemoMeta = { demoMode: false, demoNotice: null };
  for (const source of sources) {
    meta = mergeDemoMeta(meta, extractDemoMeta(source));
  }
  return meta;
}

export type ParsedPatientsList = {
  patients: PatientRow[];
  demoMode: boolean;
  demoNotice: string | null;
};

export async function fetchPatientsList(options?: {
  strict?: boolean;
}): Promise<ParsedPatientsList> {
  const res = await fetch("/api/patients");
  const json = (await res.json()) as PatientsListPayload;
  if (!res.ok && !Array.isArray(json) && !("patients" in json)) {
    if (options?.strict) {
      const body = json as { error?: string };
      throw new Error(body.error ?? `Request failed (${res.status})`);
    }
    return { patients: [], demoMode: false, demoNotice: null };
  }
  return parsePatientsList(json);
}

export async function fetchClinicianResults(options?: {
  strict?: boolean;
}): Promise<ClinicianResultsResponse | null> {
  const res = await fetch("/api/clinician/results");
  if (!res.ok) {
    if (options?.strict) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to load results (${res.status})`);
    }
    return null;
  }
  return (await res.json()) as ClinicianResultsResponse;
}
