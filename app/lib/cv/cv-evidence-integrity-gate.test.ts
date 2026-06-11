/**
 * Run: npx tsx --test app/lib/cv/cv-evidence-integrity-gate.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CV_EVIDENCE_LIMITED_HEADLINE,
  CV_EVIDENCE_REP_ASSISTIVE_NOTE,
  CV_EVIDENCE_UNABLE_JOINT_NOTE,
  evaluateCvEvidenceIntegrity,
} from "@/app/lib/cv/cv-evidence-integrity-gate";
import { NO_TIMELINE_SNAPSHOTS_FLAG } from "@/app/lib/cv/patient-cv-capture-reliability";

function pilot(
  overrides: Partial<{
    snapshotCount: number;
    completeReps: number;
    unclearReps: number;
    trackingSignal: string;
    phaseRatios: Record<string, number>;
    visibilityRatios: { hip: number; knee: number; ankle: number };
    clinicianFlags: string[];
  }> = {},
) {
  return {
    snapshotCount: overrides.snapshotCount ?? 8,
    completeReps: overrides.completeReps ?? 3,
    unclearReps: overrides.unclearReps ?? 0,
    trackingSignal: overrides.trackingSignal ?? "good",
    showReviewBanner: false,
    phaseRatios: overrides.phaseRatios ?? {
      seated: 15,
      rising: 25,
      standing: 45,
      returning: 10,
      rest: 5,
    },
    repTimings: null,
    visibilityRatios: overrides.visibilityRatios ?? {
      hip: 88,
      knee: 85,
      ankle: 82,
    },
    clinicianFlags: overrides.clinicianFlags ?? [],
  };
}

describe("evaluateCvEvidenceIntegrity", () => {
  it("marks sufficient evidence when snapshots and visibility are adequate", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "sit-to-stand",
      completedReps: 3,
      motionPilot: pilot(),
    });

    assert.equal(gate.status, "sufficient");
    assert.equal(gate.sufficientForBiomechanicalInterpretation, true);
    assert.equal(gate.jointAssessmentNote, null);
    assert.equal(gate.repCountNote, null);
  });

  it("marks unable to assess when snapshot count is zero", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "heel-raise",
      completedReps: 4,
      trackingSignal: "good",
      motionPilot: pilot({ snapshotCount: 0, completeReps: 4 }),
    });

    assert.equal(gate.status, "unable_to_assess");
    assert.equal(gate.sufficientForBiomechanicalInterpretation, false);
    assert.equal(gate.headline, CV_EVIDENCE_LIMITED_HEADLINE);
    assert.equal(gate.jointAssessmentNote, CV_EVIDENCE_UNABLE_JOINT_NOTE);
    assert.equal(gate.repCountNote, CV_EVIDENCE_REP_ASSISTIVE_NOTE);
    assert.ok(gate.reasons.includes("no_motion_timeline_snapshots"));
  });

  it("marks unable to assess when no_timeline_snapshots flag is present", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "sit-to-stand",
      completedReps: 2,
      motionPilot: pilot({
        clinicianFlags: [NO_TIMELINE_SNAPSHOTS_FLAG],
      }),
    });

    assert.equal(gate.status, "unable_to_assess");
    assert.equal(gate.sufficientForBiomechanicalInterpretation, false);
  });

  it("marks unable to assess when lower-body joint visibility is zero with snapshots", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "mini-squat",
      completedReps: 2,
      motionPilot: pilot({
        snapshotCount: 6,
        visibilityRatios: { hip: 0, knee: 0, ankle: 0 },
      }),
    });

    assert.equal(gate.status, "unable_to_assess");
    assert.ok(gate.reasons.includes("lower_body_joint_visibility_insufficient"));
  });

  it("does not treat missing visibility ratios as zero percent", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "sit-to-stand",
      completedReps: 2,
      motionPilot: {
        ...pilot({ snapshotCount: 4 }),
        visibilityRatios: null,
      },
    });

    assert.notEqual(gate.reasons.includes("lower_body_joint_visibility_insufficient"), true);
  });

  it("marks limited when phase evidence is unclear but snapshots exist", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "sit-to-stand",
      completedReps: 3,
      motionPilot: pilot({
        phaseRatios: { unknown: 40, standing: 35, rising: 25 },
      }),
    });

    assert.equal(gate.status, "limited");
    assert.equal(gate.sufficientForBiomechanicalInterpretation, false);
    assert.ok(gate.reasons.includes("phase_evidence_incomplete_or_unclear"));
  });

  it("marks unable to assess for synthesized evidence without timeline snapshots", () => {
    const gate = evaluateCvEvidenceIntegrity({
      exerciseId: "heel-raise",
      completedReps: 3,
      trackingSignal: "fair",
      evidenceSynthesized: true,
      motionPilot: pilot({ snapshotCount: 0 }),
    });

    assert.equal(gate.status, "unable_to_assess");
    assert.equal(gate.sufficientForBiomechanicalInterpretation, false);
  });
});
