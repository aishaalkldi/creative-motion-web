import type { PatientRow } from "@/app/lib/validate-patient-ownership";
import { DEMO_NOTICE } from "@/app/lib/demo/local-demo-fallback";

export type DemoAwarePayload = {
  demoMode?: boolean;
  demoNotice?: string;
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
