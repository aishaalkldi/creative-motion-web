/**
 * Assistive XR / immersive session suggestions from patient context.
 * XR mode is preview-only; camera CV links are available today.
 */

import { slugSessionType } from "@/app/components/ProgramSessionModeButtons";

export type XrSessionRecommendation = {
  id: string;
  title: string;
  programId: string;
  phase: number;
  sessionType: string;
  rationale: string;
  libraryHref: string;
  cameraHref: string;
  modeLabel: "Camera CV (available)" | "XR preview (coming soon)";
};

const XR_DISCLAIMER =
  "Assistive session ideas for therapist review only. XR immersive mode is not yet available — use camera CV where shown.";

export { XR_DISCLAIMER };

function focusFromDiagnosis(diagnosis: string | null): string {
  const t = (diagnosis ?? "").trim().toLowerCase();
  if (/\b(knee|acl|patella)\b/.test(t)) return "knee";
  if (/\b(shoulder|rotator)\b/.test(t)) return "shoulder";
  if (/\b(back|lumbar|spine)\b/.test(t)) return "back";
  if (/\b(gait|balance|walk)\b/.test(t)) return "gait";
  return "general";
}

type SessionSeed = {
  id: string;
  title: string;
  programId: string;
  phase: number;
  sessionType: string;
  rationale: string;
};

const SEEDS: Record<string, SessionSeed[]> = {
  knee: [
    {
      id: "knee-balance-xr",
      title: "Single-leg balance immersion",
      programId: "acl-post-op",
      phase: 2,
      sessionType: "Balance and control",
      rationale: "Supports knee stability training with guided balance tasks — review before assigning.",
    },
    {
      id: "knee-strength-xr",
      title: "Sit-to-stand repetition practice",
      programId: "knee-foundation-01",
      phase: 1,
      sessionType: "Sit to stand",
      rationale: "Matches common early knee rehab patterns; camera CV available now.",
    },
  ],
  shoulder: [
    {
      id: "shoulder-rom-xr",
      title: "Guided ROM reach tasks",
      programId: "shoulder-foundation-01",
      phase: 1,
      sessionType: "Range of motion",
      rationale: "Upper-limb reach patterns for shoulder mobility review.",
    },
  ],
  gait: [
    {
      id: "gait-walking-xr",
      title: "Walking observation corridor",
      programId: "balance-gait-foundation-01",
      phase: 1,
      sessionType: "Walking tolerance",
      rationale: "Aligns with gait assessment workflows — camera observation available today.",
    },
  ],
  back: [
    {
      id: "back-mobility-xr",
      title: "Spinal mobility pacing",
      programId: "lumbar-foundation-01",
      phase: 1,
      sessionType: "Mobility session",
      rationale: "Low-load mobility pacing for lumbar programs — therapist selects suitability.",
    },
  ],
  general: [
    {
      id: "general-balance-xr",
      title: "Balance foundation session",
      programId: "balance-gait-foundation-01",
      phase: 1,
      sessionType: "Balance basics",
      rationale: "General MSK deconditioning entry point when no specific region match.",
    },
  ],
};

function buildHref(
  programId: string,
  phase: number,
  sessionType: string,
  patientId?: string,
  camera = false,
): string {
  if (camera) {
    const q = new URLSearchParams();
    q.set("source", "library");
    q.set("programId", programId);
    q.set("phase", String(phase));
    q.set("sessionType", slugSessionType(sessionType));
    if (patientId) q.set("patientId", patientId);
    return `/therapy?${q.toString()}`;
  }
  const q = new URLSearchParams();
  q.set("recommended", programId);
  if (patientId) q.set("patientId", patientId);
  return `/library?${q.toString()}`;
}

export function buildXrSessionRecommendations(input: {
  diagnosis: string | null;
  patientId?: string;
  limit?: number;
}): XrSessionRecommendation[] {
  const focus = focusFromDiagnosis(input.diagnosis);
  const seeds = SEEDS[focus] ?? SEEDS.general!;
  const limit = input.limit ?? 3;

  return seeds.slice(0, limit).map((seed) => ({
    id: seed.id,
    title: seed.title,
    programId: seed.programId,
    phase: seed.phase,
    sessionType: seed.sessionType,
    rationale: seed.rationale,
    libraryHref: buildHref(seed.programId, seed.phase, seed.sessionType, input.patientId),
    cameraHref: buildHref(seed.programId, seed.phase, seed.sessionType, input.patientId, true),
    modeLabel:
      seed.id.includes("walking") || seed.id.includes("sit-to-stand")
        ? "Camera CV (available)"
        : "XR preview (coming soon)",
  }));
}
