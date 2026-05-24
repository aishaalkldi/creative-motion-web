/**
 * RASQ Clinical Action Engine v1 — rules-based, no AI, no auto-prescription.
 *
 * Converts session response data into clinician-facing guidance and
 * patient-safe messages. Does not diagnose or modify treatment plans.
 *
 * Manual test cases (rule priority — first match wins):
 * 1. { safetyConcern: true } → needs_review, high
 * 2. { painAfter: 8 } → needs_review, high
 * 3. { painBefore: 3, painAfter: 5 } → pain_increase, medium
 * 4. { effortScore: 9 } → high_effort, medium
 * 5. { missedSessionsCount: 2 } → adherence_follow_up, medium
 * 6. { completedSessionsCount: 3, stableSessionsCount: 3 } → ready_for_progression_review, low
 * 7. {} → stable, low
 * Priority: safety > high pain after > pain increase > high effort > adherence > progression > stable
 */

export type ClinicalActionStatus =
  | "stable"
  | "needs_review"
  | "high_effort"
  | "pain_increase"
  | "adherence_follow_up"
  | "ready_for_progression_review";

export type ClinicalActionSeverity = "low" | "medium" | "high";

export type ClinicalActionInput = {
  painBefore?: number | null;
  painAfter?: number | null;
  effortScore?: number | null;
  patientNote?: string | null;
  safetyConcern?: boolean;
  completedSessionsCount?: number;
  missedSessionsCount?: number;
  stableSessionsCount?: number;
};

export type ClinicalActionResult = {
  status: ClinicalActionStatus;
  title: string;
  reason: string;
  suggestedClinicianAction: string;
  patientSafeMessage: string;
  severity: ClinicalActionSeverity;
};

const STATUS_COPY: Record<
  ClinicalActionStatus,
  Pick<ClinicalActionResult, "title" | "reason" | "suggestedClinicianAction" | "patientSafeMessage" | "severity">
> = {
  needs_review: {
    title: "Needs therapist review",
    reason: "Patient reported a safety concern or high pain after session.",
    suggestedClinicianAction: "Review this session before progressing the plan.",
    patientSafeMessage:
      "Your response has been marked for therapist review. If symptoms feel unusual, contact your therapist.",
    severity: "high",
  },
  pain_increase: {
    title: "Pain increased after session",
    reason: "Pain increased after session compared to before.",
    suggestedClinicianAction: "Review pain response and consider adjusting session intensity.",
    patientSafeMessage:
      "You reported more pain after this session. Rest as needed and contact your therapist if pain persists.",
    severity: "medium",
  },
  high_effort: {
    title: "High effort response",
    reason: "Patient reported high effort during the session.",
    suggestedClinicianAction: "Consider reviewing intensity before progression.",
    patientSafeMessage:
      "This session felt hard. Move gently and tell your therapist if this continues.",
    severity: "medium",
  },
  adherence_follow_up: {
    title: "Adherence follow-up",
    reason: "Patient may have missed multiple scheduled sessions.",
    suggestedClinicianAction: "Follow up with the patient about session adherence and barriers.",
    patientSafeMessage:
      "We noticed you may have missed sessions. Your therapist can help you get back on track.",
    severity: "medium",
  },
  ready_for_progression_review: {
    title: "Ready for progression review",
    reason: "Patient completed multiple sessions with stable response.",
    suggestedClinicianAction: "Ready for clinician progression review — assess whether the plan should be updated.",
    patientSafeMessage:
      "You've completed several sessions. Your therapist will review whether your plan should be updated.",
    severity: "low",
  },
  stable: {
    title: "Stable response",
    reason: "No concerning response detected from latest session.",
    suggestedClinicianAction: "Continue monitoring session response at the next visit.",
    patientSafeMessage: "Good work. Your responses have been saved for your therapist to review.",
    severity: "low",
  },
};

/** Statuses surfaced by the Results “Needs therapist review” filter. */
export function clinicalActionNeedsTherapistReview(status: ClinicalActionStatus): boolean {
  return (
    status === "needs_review" ||
    status === "high_effort" ||
    status === "pain_increase" ||
    status === "adherence_follow_up"
  );
}

/** Per-session stability (rules 1–4 only — excludes adherence and progression). */
export function isSessionResponseStable(input: {
  painBefore?: number | null;
  painAfter?: number | null;
  effortScore?: number | null;
  safetyConcern?: boolean;
}): boolean {
  if (input.safetyConcern) return false;
  if (input.painAfter != null && input.painAfter >= 8) return false;
  if (
    input.painBefore != null &&
    input.painAfter != null &&
    input.painAfter >= input.painBefore + 2
  ) {
    return false;
  }
  if (input.effortScore != null && input.effortScore >= 8) return false;
  return true;
}

export function deriveClinicalAction(input: ClinicalActionInput): ClinicalActionResult {
  const safetyConcern = input.safetyConcern === true;
  const painBefore = input.painBefore ?? null;
  const painAfter = input.painAfter ?? null;
  const effortScore = input.effortScore ?? null;
  const missedSessionsCount = input.missedSessionsCount ?? 0;
  const completedSessionsCount = input.completedSessionsCount ?? 0;
  const stableSessionsCount = input.stableSessionsCount ?? 0;

  let status: ClinicalActionStatus = "stable";

  if (safetyConcern) {
    status = "needs_review";
  } else if (painAfter != null && painAfter >= 8) {
    status = "needs_review";
  } else if (painBefore != null && painAfter != null && painAfter >= painBefore + 2) {
    status = "pain_increase";
  } else if (effortScore != null && effortScore >= 8) {
    status = "high_effort";
  } else if (missedSessionsCount >= 2) {
    status = "adherence_follow_up";
  } else if (completedSessionsCount >= 3 && stableSessionsCount >= 3) {
    status = "ready_for_progression_review";
  }

  const copy = STATUS_COPY[status];

  if (status === "needs_review" && safetyConcern && (painAfter == null || painAfter < 8)) {
    return {
      status,
      title: copy.title,
      reason: "Patient reported a safety concern.",
      suggestedClinicianAction: copy.suggestedClinicianAction,
      patientSafeMessage: copy.patientSafeMessage,
      severity: copy.severity,
    };
  }

  if (status === "needs_review" && !safetyConcern && painAfter != null && painAfter >= 8) {
    return {
      status,
      title: copy.title,
      reason: "High pain reported after session.",
      suggestedClinicianAction: copy.suggestedClinicianAction,
      patientSafeMessage: copy.patientSafeMessage,
      severity: copy.severity,
    };
  }

  return {
    status,
    title: copy.title,
    reason: copy.reason,
    suggestedClinicianAction: copy.suggestedClinicianAction,
    patientSafeMessage: copy.patientSafeMessage,
    severity: copy.severity,
  };
}

export type SessionLogForClinicalAction = {
  effort_score: number | null;
  pain_score: number | null;
  notes: string | null;
};

export type PlanSessionForClinicalAction = {
  status: string;
  session_number: number;
};

/**
 * Missed = skipped sessions plus gaps before the highest completed session number.
 * Limitation: does not use scheduled_at for overdue detection.
 */
export function deriveMissedSessionsCount(
  sessions: PlanSessionForClinicalAction[],
): number {
  const skipped = sessions.filter((s) => s.status === "skipped").length;
  const completedNumbers = sessions
    .filter((s) => s.status === "completed")
    .map((s) => s.session_number);
  if (completedNumbers.length === 0) return skipped;

  const maxCompleted = Math.max(...completedNumbers);
  const gapMissed = sessions.filter(
    (s) =>
      s.session_number < maxCompleted &&
      s.status !== "completed" &&
      s.status !== "skipped",
  ).length;

  return skipped + gapMissed;
}

/**
 * Count logs whose session response passes stability rules (rules 1–4).
 * Requires logs in any order; sorts by array order (caller should pass chronological).
 */
export function countStableSessionsFromLogs(
  logs: SessionLogForClinicalAction[],
  parseNotes: (notes: string | null | undefined) => {
    painBefore: number | null;
    safetyConcern: boolean;
  },
): number {
  return logs.filter((log) => {
    const meta = parseNotes(log.notes);
    return isSessionResponseStable({
      painBefore: meta.painBefore,
      painAfter: log.pain_score,
      effortScore: log.effort_score,
      safetyConcern: meta.safetyConcern,
    });
  }).length;
}

export function buildClinicalActionFromPlanData(input: {
  latestLog: SessionLogForClinicalAction | null | undefined;
  sessions: PlanSessionForClinicalAction[];
  parseNotes: (notes: string | null | undefined) => {
    painBefore: number | null;
    safetyConcern: boolean;
    patientNote: string | null;
  };
  allLogs?: SessionLogForClinicalAction[];
}): ClinicalActionResult {
  const completedSessionsCount = input.sessions.filter((s) => s.status === "completed").length;
  const missedSessionsCount = deriveMissedSessionsCount(input.sessions);

  const coachMeta = input.parseNotes(input.latestLog?.notes);
  const logsForStability = input.allLogs ?? (input.latestLog ? [input.latestLog] : []);
  const stableSessionsCount = countStableSessionsFromLogs(logsForStability, (notes) => {
    const meta = input.parseNotes(notes);
    return { painBefore: meta.painBefore, safetyConcern: meta.safetyConcern };
  });

  return deriveClinicalAction({
    painBefore: coachMeta.painBefore,
    painAfter: input.latestLog?.pain_score ?? null,
    effortScore: input.latestLog?.effort_score ?? null,
    patientNote: coachMeta.patientNote,
    safetyConcern: coachMeta.safetyConcern,
    completedSessionsCount,
    missedSessionsCount,
    stableSessionsCount,
  });
}
