/**
 * Post-stroke Objective 5×STS — assignment and result contracts.
 * Stored under structured_data.postStrokeIntake.objectiveAssessment.
 */

export const FIVE_TIMES_STS_ASSESSMENT_TYPE = "five_times_sit_to_stand" as const;

export type FiveTimesStsAssessmentType = typeof FIVE_TIMES_STS_ASSESSMENT_TYPE;

export const FIVE_TIMES_STS_PROTOCOLS = [
  "standard_5xsts",
  "modified_sit_to_stand_observation",
] as const;

export type FiveTimesStsProtocol = (typeof FIVE_TIMES_STS_PROTOCOLS)[number];

export const FIVE_TIMES_STS_DELIVERY_MODES = [
  "remote_supervised",
  "in_clinic",
] as const;

export type FiveTimesStsDeliveryMode = (typeof FIVE_TIMES_STS_DELIVERY_MODES)[number];

export const FIVE_TIMES_STS_ASSIGNMENT_STATUSES = [
  "assigned",
  "started",
  "completed",
  "cancelled",
] as const;

export type FiveTimesStsAssignmentStatus = (typeof FIVE_TIMES_STS_ASSIGNMENT_STATUSES)[number];

export const FIVE_TIMES_STS_COMPLETION_STATES = [
  "completed",
  "incomplete",
  "interrupted",
  "not_started",
] as const;

export type FiveTimesStsCompletionState = (typeof FIVE_TIMES_STS_COMPLETION_STATES)[number];

export const FIVE_TIMES_STS_TRACKING_QUALITIES = [
  "high",
  "medium",
  "low",
  "insufficient",
] as const;

export type FiveTimesStsTrackingQuality = (typeof FIVE_TIMES_STS_TRACKING_QUALITIES)[number];

export const FIVE_TIMES_STS_TARGET_REPETITIONS = 5 as const;

export const FIVE_TIMES_STS_ASSESSMENT_LABEL = "Five Times Sit-to-Stand (5xSTS)" as const;

export const FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN = "Assigned by clinician" as const;

export const FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR =
  "تم التعيين بواسطة الأخصائي" as const;

/**
 * Phase 1 Post-Stroke Objective 5×STS assignment invariant (MVP).
 *
 * - One Objective assignment per parent Post-Stroke Intake.
 * - `assigned`, `started`, and `completed` assignments are immutable.
 * - An exact retry returns the existing assignment idempotently.
 * - A request with different parameters returns 409.
 * - Only a `cancelled` assignment permits replacement.
 * - No reassessment history in Phase 1.
 * - No result, capture token, or Objective finding is created during assignment.
 */
export const POST_STROKE_OBJECTIVE_PHASE1_ASSIGNMENT_INVARIANT = [
  "one_assignment_per_post_stroke_intake",
  "immutable_when_assigned_started_or_completed",
  "idempotent_exact_retry",
  "conflict_on_parameter_change",
  "replacement_only_when_cancelled",
  "no_reassessment_history_in_phase_1",
  "no_result_or_capture_token_at_assignment",
] as const;

export const FIVE_TIMES_STS_PROTOCOL_LABELS: Record<FiveTimesStsProtocol, string> = {
  standard_5xsts: FIVE_TIMES_STS_ASSESSMENT_LABEL,
  modified_sit_to_stand_observation: "Modified Sit-to-Stand Functional Observation",
};

export const FIVE_TIMES_STS_DELIVERY_MODE_LABELS: Record<FiveTimesStsDeliveryMode, string> = {
  remote_supervised: "Remote supervised",
  in_clinic: "In clinic",
};

export type FiveTimesStsAssignment = {
  id: string;
  assessmentType: FiveTimesStsAssessmentType;
  protocol: FiveTimesStsProtocol;
  deliveryMode: FiveTimesStsDeliveryMode;
  status: FiveTimesStsAssignmentStatus;
  targetRepetitions: typeof FIVE_TIMES_STS_TARGET_REPETITIONS;
  assignedAt: string;
  assignedBy: string;
  supervisionConfirmed?: boolean;
};

export type FiveTimesStsTiming = {
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
};

export type FiveTimesStsTracking = {
  quality: FiveTimesStsTrackingQuality;
  interruptions: number;
  interruptionReasons?: string[];
};

export type FiveTimesStsObservations = {
  trunkCompensationObserved?: boolean;
  factualNotes?: string[];
};

export type FiveTimesStsResult = {
  completionState: FiveTimesStsCompletionState;
  repetitionsCompleted: number;
  targetRepetitions: typeof FIVE_TIMES_STS_TARGET_REPETITIONS;
  timing?: FiveTimesStsTiming;
  tracking?: FiveTimesStsTracking;
  observations?: FiveTimesStsObservations;
  sourceCvMetricId?: string;
};

export type FiveTimesStsClinicianReview = {
  status: "pending" | "reviewed";
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
};

export type PostStrokeObjectiveAssessment = {
  assignment?: FiveTimesStsAssignment;
  result?: FiveTimesStsResult;
  clinicianReview?: FiveTimesStsClinicianReview;
};

export type ObjectiveAssignmentClientRequest = {
  protocol?: unknown;
  deliveryMode?: unknown;
  supervisionConfirmed?: unknown;
};

export function isValidFiveTimesStsProtocol(value: unknown): value is FiveTimesStsProtocol {
  return (
    typeof value === "string" &&
    (FIVE_TIMES_STS_PROTOCOLS as readonly string[]).includes(value)
  );
}

export function isValidFiveTimesStsDeliveryMode(value: unknown): value is FiveTimesStsDeliveryMode {
  return (
    typeof value === "string" &&
    (FIVE_TIMES_STS_DELIVERY_MODES as readonly string[]).includes(value)
  );
}

export function isActiveFiveTimesStsAssignmentStatus(status: FiveTimesStsAssignmentStatus): boolean {
  return status === "assigned" || status === "started" || status === "completed";
}

/** Server-side immutability guard — not user-facing “active assignment” wording. */
export function isImmutableFiveTimesStsAssignmentStatus(
  status: FiveTimesStsAssignmentStatus,
): boolean {
  return isActiveFiveTimesStsAssignmentStatus(status);
}

export function resolveFiveTimesStsAssignedByDisplayLabel(input: {
  clinicianDisplayName?: string | null;
  reportLanguage?: "en" | "ar";
}): string {
  const trimmed = input.clinicianDisplayName?.trim();
  if (trimmed) return trimmed;
  return input.reportLanguage === "ar"
    ? FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR
    : FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readPostStrokeObjectiveAssessment(
  structuredData: unknown,
): PostStrokeObjectiveAssessment | null {
  if (!isRecord(structuredData)) return null;
  const postStrokeIntake = structuredData.postStrokeIntake;
  if (!isRecord(postStrokeIntake)) return null;
  const raw = postStrokeIntake.objectiveAssessment;
  if (!isRecord(raw)) return null;
  return raw as PostStrokeObjectiveAssessment;
}

export function readFiveTimesStsAssignment(
  structuredData: unknown,
): FiveTimesStsAssignment | null {
  const objective = readPostStrokeObjectiveAssessment(structuredData);
  const assignment = objective?.assignment;
  if (!assignment || !isRecord(assignment)) return null;

  if (assignment.assessmentType !== FIVE_TIMES_STS_ASSESSMENT_TYPE) return null;
  if (!isValidFiveTimesStsProtocol(assignment.protocol)) return null;
  if (!isValidFiveTimesStsDeliveryMode(assignment.deliveryMode)) return null;
  if (
    typeof assignment.id !== "string" ||
    !assignment.id.trim() ||
    typeof assignment.assignedAt !== "string" ||
    !assignment.assignedAt.trim() ||
    typeof assignment.assignedBy !== "string" ||
    !assignment.assignedBy.trim()
  ) {
    return null;
  }
  if (assignment.targetRepetitions !== FIVE_TIMES_STS_TARGET_REPETITIONS) return null;
  if (
    typeof assignment.status !== "string" ||
    !(FIVE_TIMES_STS_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status)
  ) {
    return null;
  }

  return assignment as FiveTimesStsAssignment;
}
