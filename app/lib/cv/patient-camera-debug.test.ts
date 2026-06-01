import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectPatientCvDebugSnapshot,
  isPatientCvDebugEnabled,
} from "./patient-camera-debug";

describe("patient-camera-debug", () => {
  it("isPatientCvDebugEnabled is false without window", () => {
    assert.equal(isPatientCvDebugEnabled(), false);
  });

  it("collectPatientCvDebugSnapshot handles null video", () => {
    const snap = collectPatientCvDebugSnapshot(null, 0);
    assert.equal(snap.videoWidth, 0);
    assert.equal(snap.framesReceived, 0);
    assert.equal(snap.previewVisible, false);
  });
});
