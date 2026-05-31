/**
 * Run: npx tsx --test app/lib/cv/camera-setup-wizard.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCameraSetupChecks,
  isCameraSetupReady,
  resolveCameraSetupWizardState,
} from "@/app/lib/cv/camera-setup-wizard";

const readyInput = {
  exerciseId: "sit-to-stand" as const,
  trackingStatus: "pose-found" as const,
  poseReadiness: "ready" as const,
  bodyFramingState: "good_distance" as const,
  trackingQuality: "good" as const,
};

describe("camera-setup-wizard", () => {
  it("passes all checks when pose, distance, and lighting are good", () => {
    const checks = evaluateCameraSetupChecks(readyInput);
    assert.equal(isCameraSetupReady(checks), true);
    assert.equal(resolveCameraSetupWizardState(readyInput), "ready_to_start");
  });

  it("returns move_back when framing says too close", () => {
    assert.equal(
      resolveCameraSetupWizardState({
        ...readyInput,
        bodyFramingState: "move_back",
      }),
      "move_back",
    );
  });

  it("returns move_closer when framing says too far", () => {
    assert.equal(
      resolveCameraSetupWizardState({
        ...readyInput,
        bodyFramingState: "move_closer",
      }),
      "move_closer",
    );
  });

  it("returns improve_lighting when visibility is poor", () => {
    assert.equal(
      resolveCameraSetupWizardState({
        ...readyInput,
        bodyFramingState: "low_visibility",
        trackingQuality: "poor",
      }),
      "improve_lighting",
    );
  });

  it("returns show_feet_ankles for heel raise when angle is wrong", () => {
    assert.equal(
      resolveCameraSetupWizardState({
        ...readyInput,
        exerciseId: "heel-raise",
        bodyFramingState: "adjust_camera_angle",
      }),
      "show_feet_ankles",
    );
  });

  it("returns adjust_camera_angle for non heel-raise exercises", () => {
    assert.equal(
      resolveCameraSetupWizardState({
        ...readyInput,
        exerciseId: "mini-squat",
        bodyFramingState: "adjust_camera_angle",
      }),
      "adjust_camera_angle",
    );
  });

  it("fails body_visible when pose is lost", () => {
    const checks = evaluateCameraSetupChecks({
      ...readyInput,
      trackingStatus: "pose-lost",
      poseReadiness: "not_ready",
    });
    assert.equal(checks.find((c) => c.id === "body_visible")?.passed, false);
    assert.equal(isCameraSetupReady(checks), false);
  });

  it("fails feet check when ankles are not visible enough", () => {
    const checks = evaluateCameraSetupChecks({
      ...readyInput,
      exerciseId: "heel-raise",
      bodyFramingState: "adjust_camera_angle",
      poseReadiness: "not_ready",
    });
    assert.equal(checks.find((c) => c.id === "feet_ankles_visible")?.passed, false);
  });
});
