/**
 * Run: npx tsx --test app/lib/cv/cv-metrics-dedupe.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeCvMetricsByPlanSessionExercise } from "@/app/lib/cv/cv-metrics-dedupe";
import type { CvSessionMetricPublic } from "@/app/lib/cv/cv-metrics-display";

function row(
  partial: Partial<CvSessionMetricPublic> & Pick<CvSessionMetricPublic, "id" | "exerciseId">,
): CvSessionMetricPublic {
  return {
    repCount: 10,
    sessionDurationS: 214,
    trackingQuality: "good",
    movementDetected: true,
    source: "patient_session",
    recordedAt: "2026-06-05T12:00:00.000Z",
    planSessionId: "session-1",
    ...partial,
  };
}

describe("dedupeCvMetricsByPlanSessionExercise", () => {
  it("keeps newest patient_session row per plan session and exercise", () => {
    const deduped = dedupeCvMetricsByPlanSessionExercise([
      row({
        id: "old",
        exerciseId: "sit-to-stand",
        recordedAt: "2026-06-05T11:00:00.000Z",
      }),
      row({
        id: "new",
        exerciseId: "sit-to-stand",
        recordedAt: "2026-06-05T12:00:00.000Z",
      }),
    ]);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.id, "new");
  });

  it("does not collapse cv_lab rows without planSessionId", () => {
    const deduped = dedupeCvMetricsByPlanSessionExercise([
      row({ id: "lab-1", source: "cv_lab", planSessionId: null }),
      row({ id: "lab-2", source: "cv_lab", planSessionId: null }),
    ]);

    assert.equal(deduped.length, 2);
  });
});
