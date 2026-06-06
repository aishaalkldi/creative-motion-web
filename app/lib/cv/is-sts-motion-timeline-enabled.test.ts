/**
 * Run: npx tsx --test app/lib/cv/is-sts-motion-timeline-enabled.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PATIENT_STS_CONFIG } from "@/app/lib/cv/cv-patient-config";
import {
  isStsMotionTimelineEnabled,
  isStsMotionTimelinePilotEnabledFromSearch,
} from "@/app/lib/cv/is-sts-motion-timeline-enabled";

describe("isStsMotionTimelinePilotEnabledFromSearch", () => {
  it("is on only when cvDebug and smtTimeline are both set", () => {
    assert.equal(isStsMotionTimelinePilotEnabledFromSearch(""), false);
    assert.equal(isStsMotionTimelinePilotEnabledFromSearch("?cvDebug=1"), false);
    assert.equal(isStsMotionTimelinePilotEnabledFromSearch("?smtTimeline=1"), false);
    assert.equal(
      isStsMotionTimelinePilotEnabledFromSearch("?cvDebug=1&smtTimeline=1"),
      true,
    );
    assert.equal(
      isStsMotionTimelinePilotEnabledFromSearch("cvDebug=1&smtTimeline=1"),
      true,
    );
  });
});

describe("isStsMotionTimelineEnabled", () => {
  it("is on for STS in production patient config", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, true);
    assert.equal(isStsMotionTimelineEnabled("sit-to-stand"), true);
  });

  it("is off for non-STS exercises even with pilot query string semantics", () => {
    assert.equal(isStsMotionTimelineEnabled("mini-squat"), false);
    assert.equal(isStsMotionTimelineEnabled("single-leg-stance"), false);
    assert.equal(isStsMotionTimelineEnabled("heel-raise"), false);
  });

  it("is off for STS when motionTimelineEnabled is unset", () => {
    const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
    delete PATIENT_STS_CONFIG.motionTimelineEnabled;
    try {
      assert.equal(isStsMotionTimelineEnabled("sit-to-stand"), false);
    } finally {
      PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
    }
  });
});
