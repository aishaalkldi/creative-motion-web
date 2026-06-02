/**
 * Run: npx tsx --test app/lib/cv/is-sts-motion-timeline-enabled.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import { isStsMotionTimelineEnabled } from "@/app/lib/cv/is-sts-motion-timeline-enabled";

describe("isStsMotionTimelineEnabled", () => {
  it("is off when patient STS config leaves motionTimelineEnabled unset", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, undefined);
    assert.equal(isStsMotionTimelineEnabled("sit-to-stand"), false);
  });

  it("is off for non-STS exercises", () => {
    assert.equal(isStsMotionTimelineEnabled("mini-squat"), false);
    assert.equal(isStsMotionTimelineEnabled("single-leg-stance"), false);
    assert.equal(isStsMotionTimelineEnabled("heel-raise"), false);
  });
});
