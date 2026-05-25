/**
 * Sprint O — Derive safe rehabilitation focus labels from assessment structured_data.
 * No diagnosis fields, no AI fields, no program matching.
 */

import type { BodyRegion } from "@/app/lib/assessment-types";
import {
  extractGeneralDraft,
  extractStructuredData,
} from "@/app/lib/assessment-payload";
import {
  detectRedFlag,
  extractRemoteQuestionnaireDraft,
} from "@/app/lib/remote-questionnaire-summary";
import {
  FOCUS_DIRECTION_VALUE,
  VALUE_CATEGORY_UNSPECIFIED,
  VALUE_FOCUS_UNSPECIFIED,
  VALUE_PHASE_NOT_SPECIFIED,
} from "@/app/lib/clinical-focus-copy";

export type ClinicalFocusDataSource =
  | "patient-reported"
  | "clinician-entered"
  | "mixed"
  | "unknown";

export type ClinicalFocusConfidence = "high" | "low";

export type ClinicalFocusLabels = {
  focusArea: string;
  clinicalCategory: string;
  phaseContext: string;
  programDirection: string;
  confirmationRequired: boolean;
  dataSource: ClinicalFocusDataSource;
  confidence: ClinicalFocusConfidence;
};

const CATEGORY_BY_FOCUS: Record<string, string> = {
  Knee: "Orthopedic Rehabilitation",
  Shoulder: "Orthopedic Rehabilitation",
  "Low back": "MSK Rehabilitation",
  Neck: "MSK Rehabilitation",
  Hip: "Orthopedic Rehabilitation",
  "Ankle / foot": "Orthopedic Rehabilitation",
  "Balance and gait": "Balance and Gait Rehabilitation",
  "Upper limb": "MSK Rehabilitation",
  "General MSK": "General MSK Rehabilitation",
};

function categoryForFocusArea(focusArea: string): string {
  if (focusArea === VALUE_FOCUS_UNSPECIFIED) return VALUE_CATEGORY_UNSPECIFIED;
  return CATEGORY_BY_FOCUS[focusArea] ?? VALUE_CATEGORY_UNSPECIFIED;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function bucketPainLocation(text: string): string | null {
  const t = normalizeText(text);
  if (!t) return null;

  if (/\b(knee|patella|patellar|ركبة)\b/.test(t)) return "Knee";
  if (/\b(shoulder|rotator|كتف)\b/.test(t)) return "Shoulder";
  if (/\b(neck|cervical|رقبة)\b/.test(t)) return "Neck";
  if (/\b(ankle|foot|feet|heel|كاحل|قدم)\b/.test(t)) return "Ankle / foot";
  if (/\b(hip|groin|ورك)\b/.test(t)) return "Hip";
  if (/\b(gait|balance|walking|walk|march|توازن|مشي)\b/.test(t)) return "Balance and gait";
  if (/\b(upper\s*limb|arm|elbow|wrist|hand|ذراع|معصم)\b/.test(t)) return "Upper limb";
  if (/\b(back|lumbar|spine|spinal|lower\s*back|ظهر|قطني)\b/.test(t)) return "Low back";
  if (/\b(full\s*body|general|multiple|عام)\b/.test(t)) return "General MSK";

  return null;
}

function mapStructuredBodyRegion(region: BodyRegion): string {
  switch (region) {
    case "Knee":
      return "Knee";
    case "Shoulder":
      return "Shoulder";
    case "Lumbar":
      return "Low back";
    case "Cervical":
      return "Neck";
    case "Hip":
      return "Hip";
    case "Ankle":
      return "Ankle / foot";
    case "Upper limb":
      return "Upper limb";
    case "Gait/Balance":
      return "Balance and gait";
    default:
      return VALUE_FOCUS_UNSPECIFIED;
  }
}

function readRootString(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizePhaseContext(
  rehabilitationPhase: string | null,
  onset: string | null,
): string {
  if (rehabilitationPhase?.trim()) return rehabilitationPhase.trim();

  const o = onset?.trim().toLowerCase();
  if (o === "acute" || o === "subacute" || o === "chronic") {
    return o.charAt(0).toUpperCase() + o.slice(1);
  }

  return VALUE_PHASE_NOT_SPECIFIED;
}

function finalizeLabels(input: {
  focusArea: string;
  phaseContext: string;
  dataSource: ClinicalFocusDataSource;
  confidence: ClinicalFocusConfidence;
  hasRedFlag: boolean;
}): ClinicalFocusLabels {
  let confidence = input.confidence;
  if (input.hasRedFlag) confidence = "low";
  if (input.focusArea === VALUE_FOCUS_UNSPECIFIED) confidence = "low";

  return {
    focusArea: input.focusArea,
    clinicalCategory: categoryForFocusArea(input.focusArea),
    phaseContext: input.phaseContext,
    programDirection: FOCUS_DIRECTION_VALUE,
    confirmationRequired: true,
    dataSource: input.dataSource,
    confidence,
  };
}

function fromStructured(structuredData: unknown, hasRedFlag: boolean): ClinicalFocusLabels {
  const structured = extractStructuredData(structuredData);
  if (!structured) {
    return finalizeLabels({
      focusArea: VALUE_FOCUS_UNSPECIFIED,
      phaseContext: VALUE_PHASE_NOT_SPECIFIED,
      dataSource: "unknown",
      confidence: "low",
      hasRedFlag,
    });
  }

  const focusArea = mapStructuredBodyRegion(structured.bodyRegion);
  return finalizeLabels({
    focusArea,
    phaseContext: normalizePhaseContext(
      structured.rehabilitationPhase,
      structured.onset,
    ),
    dataSource: "clinician-entered",
    confidence: focusArea !== VALUE_FOCUS_UNSPECIFIED ? "high" : "low",
    hasRedFlag,
  });
}

function fromGeneralMsk(structuredData: unknown, hasRedFlag: boolean): ClinicalFocusLabels {
  const draft = extractGeneralDraft(structuredData, "general_msk");
  if (!draft) {
    return finalizeLabels({
      focusArea: VALUE_FOCUS_UNSPECIFIED,
      phaseContext: VALUE_PHASE_NOT_SPECIFIED,
      dataSource: "unknown",
      confidence: "low",
      hasRedFlag,
    });
  }

  const redFlag = hasRedFlag || Boolean(draft.subjective.redFlags.trim());
  const bucketed = bucketPainLocation(draft.subjective.painLocation);
  const focusArea = bucketed ?? VALUE_FOCUS_UNSPECIFIED;

  return finalizeLabels({
    focusArea,
    phaseContext: VALUE_PHASE_NOT_SPECIFIED,
    dataSource: "mixed",
    confidence: "low",
    hasRedFlag: redFlag,
  });
}

function fromRemoteQuestionnaire(structuredData: unknown, hasRedFlag: boolean): ClinicalFocusLabels {
  const draft = extractRemoteQuestionnaireDraft(structuredData, "remote_questionnaire");
  const root =
    typeof structuredData === "object" && structuredData !== null
      ? (structuredData as Record<string, unknown>)
      : null;

  const redFlag = hasRedFlag || detectRedFlag(structuredData);

  let focusArea = VALUE_FOCUS_UNSPECIFIED;

  const rootRegion = root ? readRootString(root, "bodyRegion") : null;
  if (rootRegion) {
    const structured = extractStructuredData({ bodyRegion: rootRegion });
    if (structured) {
      focusArea = mapStructuredBodyRegion(structured.bodyRegion);
    } else {
      focusArea = bucketPainLocation(rootRegion) ?? VALUE_FOCUS_UNSPECIFIED;
    }
  }

  if (focusArea === VALUE_FOCUS_UNSPECIFIED && draft?.pain?.painLocation) {
    focusArea = bucketPainLocation(draft.pain.painLocation) ?? VALUE_FOCUS_UNSPECIFIED;
  }

  const rehabPhase =
    (root && readRootString(root, "rehabilitationPhase", "rehabPhase")) ?? null;

  return finalizeLabels({
    focusArea,
    phaseContext: normalizePhaseContext(rehabPhase, null),
    dataSource: "patient-reported",
    confidence: "low",
    hasRedFlag: redFlag,
  });
}

/**
 * Derive read-only focus labels for clinician UI.
 */
export function deriveClinicalFocusLabels(
  assessmentType?: string,
  structuredData?: unknown,
): ClinicalFocusLabels {
  const type = assessmentType?.trim() ?? "";
  const hasRedFlag = detectRedFlag(structuredData);

  if (type === "general_msk") {
    return fromGeneralMsk(structuredData, hasRedFlag);
  }

  if (type === "remote_questionnaire") {
    return fromRemoteQuestionnaire(structuredData, hasRedFlag);
  }

  if (extractStructuredData(structuredData)) {
    return fromStructured(structuredData, hasRedFlag);
  }

  if (type === "structured" || type === "questionnaire") {
    return fromStructured(structuredData, hasRedFlag);
  }

  // Fallback: try any shape
  const structured = extractStructuredData(structuredData);
  if (structured) return fromStructured(structuredData, hasRedFlag);

  const general = extractGeneralDraft(structuredData, type || "general_msk");
  if (general) return fromGeneralMsk(structuredData, hasRedFlag);

  const remote = extractRemoteQuestionnaireDraft(structuredData, "remote_questionnaire");
  if (remote) return fromRemoteQuestionnaire(structuredData, hasRedFlag);

  return finalizeLabels({
    focusArea: VALUE_FOCUS_UNSPECIFIED,
    phaseContext: VALUE_PHASE_NOT_SPECIFIED,
    dataSource: "unknown",
    confidence: "low",
    hasRedFlag,
  });
}
