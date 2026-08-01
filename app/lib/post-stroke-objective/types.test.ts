/**
 * Run: npx tsx --test app/lib/post-stroke-objective/types.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIVE_TIMES_STS_ASSESSMENT_LABEL,
  FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR,
  FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN,
  FIVE_TIMES_STS_TARGET_REPETITIONS,
  POST_STROKE_OBJECTIVE_PHASE1_ASSIGNMENT_INVARIANT,
  isImmutableFiveTimesStsAssignmentStatus,
  readFiveTimesStsAssignment,
  readPostStrokeObjectiveAssessment,
  resolveFiveTimesStsAssignedByDisplayLabel,
} from "@/app/lib/post-stroke-objective/types";

describe("post-stroke-objective types", () => {
  it("reads assignment from nested postStrokeIntake.objectiveAssessment", () => {
    const structured = {
      postStrokeIntake: {
        respondent: { type: "patient" },
        objectiveAssessment: {
          assignment: {
            id: "assign-1",
            assessmentType: "five_times_sit_to_stand",
            protocol: "standard_5xsts",
            deliveryMode: "in_clinic",
            status: "assigned",
            targetRepetitions: 5,
            assignedAt: "2026-07-30T12:00:00.000Z",
            assignedBy: "provider-1",
          },
        },
      },
    };
    const assignment = readFiveTimesStsAssignment(structured);
    assert.ok(assignment);
    assert.equal(assignment!.protocol, "standard_5xsts");
    assert.equal(assignment!.targetRepetitions, FIVE_TIMES_STS_TARGET_REPETITIONS);
  });

  it("rejects assignment when target repetitions are not server-authoritative", () => {
    const structured = {
      postStrokeIntake: {
        objectiveAssessment: {
          assignment: {
            id: "assign-1",
            assessmentType: "five_times_sit_to_stand",
            protocol: "standard_5xsts",
            deliveryMode: "in_clinic",
            status: "assigned",
            targetRepetitions: 3,
            assignedAt: "2026-07-30T12:00:00.000Z",
            assignedBy: "provider-1",
          },
        },
      },
    };
    assert.equal(readFiveTimesStsAssignment(structured), null);
  });

  it("uses the approved assessment display label constant", () => {
    assert.equal(FIVE_TIMES_STS_ASSESSMENT_LABEL, "Five Times Sit-to-Stand (5xSTS)");
  });

  it("returns null objectiveAssessment when missing", () => {
    assert.equal(readPostStrokeObjectiveAssessment({ postStrokeIntake: {} }), null);
  });

  it("documents the Phase 1 one-assignment-per-intake invariant", () => {
    assert.ok(POST_STROKE_OBJECTIVE_PHASE1_ASSIGNMENT_INVARIANT.includes("one_assignment_per_post_stroke_intake"));
    assert.ok(
      POST_STROKE_OBJECTIVE_PHASE1_ASSIGNMENT_INVARIANT.includes(
        "replacement_only_when_cancelled",
      ),
    );
  });

  it("treats assigned, started, and completed as immutable server-side", () => {
    assert.equal(isImmutableFiveTimesStsAssignmentStatus("assigned"), true);
    assert.equal(isImmutableFiveTimesStsAssignmentStatus("started"), true);
    assert.equal(isImmutableFiveTimesStsAssignmentStatus("completed"), true);
    assert.equal(isImmutableFiveTimesStsAssignmentStatus("cancelled"), false);
  });

  it("uses localized clinician labels when no display name is available", () => {
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({ reportLanguage: "en" }),
      FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_EN,
    );
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({ reportLanguage: "ar" }),
      FIVE_TIMES_STS_ASSIGNED_BY_CLINICIAN_LABEL_AR,
    );
    assert.equal(
      resolveFiveTimesStsAssignedByDisplayLabel({
        clinicianDisplayName: "Dr. Smith",
        reportLanguage: "ar",
      }),
      "Dr. Smith",
    );
  });
});
