/**
 * Run: npx tsx --test app/lib/interactive-shoulder/interactive-shoulder-ui.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interactiveShoulderSetupGuidanceCopy,
  interactiveShoulderUi,
  resolveInteractiveShoulderLiveMessage,
  resolveInteractiveShoulderStartError,
  shouldTickTargetLifecycle,
} from "./interactive-shoulder-ui";
import { PATIENT_CAMERA_NO_FRAMES_ERROR } from "../cv/patient-camera-stream";
import { SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION } from "./shoulder-abduction-reach-session-definition";

describe("interactiveShoulderUi", () => {
  it("provides English and Arabic copy for core patient messages", () => {
    const en = interactiveShoulderUi("en");
    const ar = interactiveShoulderUi("ar");
    assert.ok(en.consentTitle.length > 0);
    assert.ok(ar.consentTitle.length > 0);
    assert.notEqual(en.consentTitle, ar.consentTitle);
    assert.ok(en.pause.length > 0);
    assert.ok(ar.pause.length > 0);
    assert.ok(en.trackingLostHold.length > 0);
    assert.ok(ar.trackingLostHold.length > 0);
    assert.ok(en.blockCompleteTitle.length > 0);
    assert.ok(ar.blockCompleteTitle.length > 0);
    assert.ok(en.devMouseSimulation.includes("Development"));
    assert.ok(ar.devMouseSimulation.includes("محاكاة"));
  });

  it("maps setup guidance to localized reposition copy", () => {
    assert.ok(interactiveShoulderSetupGuidanceCopy("en", "move_farther").includes("Move back"));
    assert.ok(interactiveShoulderSetupGuidanceCopy("ar", "move_farther").includes("تراجع"));
  });

  it("localizes safety hold messages by reason", () => {
    const block = SHOULDER_ABDUCTION_REACH_INTERACTIVE_SESSION.blocks[0]!;
    const trackerHold = resolveInteractiveShoulderLiveMessage("en", {
      sessionState: "safetyHold",
      safetyStatus: "hold",
      safetyHoldReason: "trackerLost",
      isPaused: false,
      patientFeedbackState: { message: "Tracking issue detected — please wait.", encouragement: null },
      currentBlock: block,
    } as never);
    assert.equal(trackerHold, interactiveShoulderUi("en").trackingLostHold);

    const compHold = resolveInteractiveShoulderLiveMessage("ar", {
      sessionState: "safetyHold",
      safetyStatus: "hold",
      safetyHoldReason: "compensation",
      isPaused: false,
      patientFeedbackState: { message: null, encouragement: null },
      currentBlock: block,
    } as never);
    assert.equal(compHold, interactiveShoulderUi("ar").compensationSafetyHold);
  });

  it("shouldTickTargetLifecycle allows only active state", () => {
    assert.equal(shouldTickTargetLifecycle("active"), true);
    assert.equal(shouldTickTargetLifecycle("paused"), false);
    assert.equal(shouldTickTargetLifecycle("safetyHold"), false);
    assert.equal(shouldTickTargetLifecycle("completed"), false);
  });

  it("localizes camera start errors", () => {
    const denied = resolveInteractiveShoulderStartError("en", new DOMException("denied", "NotAllowedError"));
    assert.equal(denied, interactiveShoulderUi("en").cameraAccessDenied);
    const arDenied = resolveInteractiveShoulderStartError("ar", new DOMException("denied", "NotAllowedError"));
    assert.equal(arDenied, interactiveShoulderUi("ar").cameraAccessDenied);
    const noFrames = resolveInteractiveShoulderStartError("en", new Error(PATIENT_CAMERA_NO_FRAMES_ERROR));
    assert.equal(noFrames, interactiveShoulderUi("en").cameraNoFrames);
  });
});
