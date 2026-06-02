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
  it("is off when patient STS config leaves motionTimelineEnabled unset", () => {
    assert.equal(PATIENT_STS_CONFIG.motionTimelineEnabled, undefined);
    assert.equal(isStsMotionTimelineEnabled("sit-to-stand"), false);
  });

  it("is off for non-STS exercises even with pilot query string semantics", () => {
    assert.equal(isStsMotionTimelineEnabled("mini-squat"), false);
    assert.equal(isStsMotionTimelineEnabled("single-leg-stance"), false);
    assert.equal(isStsMotionTimelineEnabled("heel-raise"), false);
  });

  it("is on for STS when motionTimelineEnabled is true on config", () => {
    const prev = PATIENT_STS_CONFIG.motionTimelineEnabled;
    PATIENT_STS_CONFIG.motionTimelineEnabled = true;
    try {
      assert.equal(isStsMotionTimelineEnabled("sit-to-stand"), true);
    } finally {
      if (prev === undefined) {
        delete PATIENT_STS_CONFIG.motionTimelineEnabled;
      } else {
        PATIENT_STS_CONFIG.motionTimelineEnabled = prev;
      }
    }
  });
});
