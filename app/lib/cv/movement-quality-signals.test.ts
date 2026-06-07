/**
 * Run: npx tsx --test app/lib/cv/movement-quality-signals.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMovementQualitySignals } from "@/app/lib/cv/movement-quality-signals";

describe("buildMovementQualitySignals", () => {
  it("builds clean STS with consistent timing and complete phases", () => {
    const result = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 3,
      unclearReps: 0,
      repTimings: { avgS: 2.1, fastestS: 2.0, slowestS: 2.2 },
      phaseRatios: {
        seated: 12,
        rising: 25,
        standing: 40,
        returning: 18,
        rest: 5,
      },
      clinicianFlags: [],
    });

    assert.ok(result);
    assert.equal(result.averageRepTimeSec, 2.1);
    assert.equal(result.fastestRepTimeSec, 2.0);
    assert.equal(result.slowestRepTimeSec, 2.2);
    assert.equal(result.timingRangeSec, 0.2);
    assert.equal(result.pacingConsistency, "Consistent");
    assert.equal(result.phaseConsistency, "Consistent");
    assert.equal(result.completionClarity, "Clear");
    assert.equal(result.observedStandingPhaseRatio, 40);
    assert.equal(result.observedReturningPhaseRatio, 18);
    assert.ok(result.qualitySignals.length > 0);
    assert.ok(
      result.clinicianReviewFocus.some((item) =>
        item.toLowerCase().includes("standing posture"),
      ),
    );
    assert.ok(!result.qualityFlags.includes("variable_pacing"));
  });

  it("flags variable pacing with limited returning phase", () => {
    const result = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 4,
      unclearReps: 0,
      repTimings: { avgS: 2.8, fastestS: 1.5, slowestS: 4.0 },
      phaseRatios: {
        seated: 10,
        rising: 30,
        standing: 52,
        returning: 8,
        rest: 0,
      },
      clinicianFlags: [],
    });

    assert.ok(result);
    assert.equal(result.pacingConsistency, "Variable");
    assert.equal(result.phaseConsistency, "Moderate");
    assert.equal(result.timingRangeSec, 2.5);
    assert.ok(result.qualityFlags.includes("variable_pacing"));
    assert.ok(result.qualityFlags.includes("low_returning_phase"));
    assert.ok(
      result.qualitySignals.some((signal) =>
        signal.includes("Repetition pacing varied"),
      ),
    );
    assert.ok(
      result.clinicianReviewFocus.some((item) =>
        item.toLowerCase().includes("pacing consistency"),
      ),
    );
    assert.ok(
      result.clinicianReviewFocus.some((item) =>
        item.toLowerCase().includes("lowering control"),
      ),
    );
  });

  it("returns insufficient pacing data when repTimings are missing", () => {
    const result = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 2,
      unclearReps: 0,
      phaseRatios: {
        seated: 15,
        rising: 25,
        standing: 35,
        returning: 20,
        rest: 5,
      },
    });

    assert.ok(result);
    assert.equal(result.pacingConsistency, "Insufficient data");
    assert.equal(result.averageRepTimeSec, null);
    assert.equal(result.timingRangeSec, null);
    assert.equal(result.phaseConsistency, "Consistent");
    assert.equal(result.completionClarity, "Clear");
    assert.ok(result.qualityFlags.includes("timing_insufficient"));
  });

  it("marks completion unclear when unclear reps exceed 20%", () => {
    const result = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 2,
      unclearReps: 2,
      repTimings: { avgS: 2.5, fastestS: 2.2, slowestS: 2.8 },
      phaseRatios: {
        seated: 15,
        rising: 25,
        standing: 45,
        returning: 10,
        rest: 5,
      },
      clinicianFlags: ["unclear_reps_recorded"],
    });

    assert.ok(result);
    assert.equal(result.completionClarity, "Unclear");
    assert.ok(result.qualityFlags.includes("unclear_reps_elevated"));
    assert.ok(
      result.clinicianReviewFocus.some((item) =>
        item.toLowerCase().includes("unclear repetitions"),
      ),
    );
  });

  it("returns null for legacy / insufficient STS data fallback", () => {
    const nonSts = buildMovementQualitySignals({
      exerciseId: "mini-squat",
      completeReps: 3,
      repTimings: { avgS: 2, fastestS: 1.8, slowestS: 2.2 },
    });
    assert.equal(nonSts, null);

    const noEvidence = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 0,
      unclearReps: 0,
    });
    assert.equal(noEvidence, null);

    const legacyWithReps = buildMovementQualitySignals({
      exerciseId: "sit-to-stand",
      completeReps: 2,
      unclearReps: 0,
      clinicianFlags: [],
    });
    assert.ok(legacyWithReps);
    assert.equal(legacyWithReps.pacingConsistency, "Insufficient data");
    assert.equal(legacyWithReps.phaseConsistency, "Insufficient data");
    assert.equal(legacyWithReps.completionClarity, "Clear");
  });
});
