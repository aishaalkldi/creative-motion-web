/**
 * Run: npx tsx --test app/lib/cv/pose-landmark-overlay.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  drawPoseLandmarkDots,
  PATIENT_POSE_DOT_INDICES,
  readinessOverlayColor,
  resolveLiveBodySignal,
} from "@/app/lib/cv/pose-landmark-overlay";

describe("pose-landmark-overlay", () => {
  it("includes shoulders, hips, knees, and ankles in dot indices", () => {
    assert.deepEqual(PATIENT_POSE_DOT_INDICES, [11, 12, 23, 24, 25, 26, 27, 28]);
  });

  it("maps readiness to overlay colors", () => {
    assert.equal(readinessOverlayColor("ready"), "#1D9E75");
    assert.equal(readinessOverlayColor("partial"), "#F59E0B");
    assert.equal(readinessOverlayColor("not_ready"), "#9CA3AF");
  });

  it("resolveLiveBodySignal returns body_visible when pose and framing are good", () => {
    assert.equal(
      resolveLiveBodySignal({
        trackingStatus: "pose-found",
        poseReadiness: "ready",
        bodyFramingState: "good_distance",
      }),
      "body_visible",
    );
  });

  it("resolveLiveBodySignal returns move_back_lighting when pose is lost", () => {
    assert.equal(
      resolveLiveBodySignal({
        trackingStatus: "pose-lost",
        poseReadiness: "not_ready",
        bodyFramingState: "low_visibility",
      }),
      "move_back_lighting",
    );
  });

  it("resolveLiveBodySignal returns adjust_position while checking framing", () => {
    assert.equal(
      resolveLiveBodySignal({
        trackingStatus: "pose-found",
        poseReadiness: "checking",
        bodyFramingState: "checking",
      }),
      "adjust_position",
    );
  });

  it("drawPoseLandmarkDots issues fill and stroke per visible landmark", () => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0,
    }));
    landmarks[23] = { x: 0.4, y: 0.55, visibility: 0.9 };
    landmarks[24] = { x: 0.6, y: 0.55, visibility: 0.9 };
    landmarks[25] = { x: 0.4, y: 0.7, visibility: 0.9 };
    landmarks[26] = { x: 0.6, y: 0.7, visibility: 0.9 };
    landmarks[27] = { x: 0.4, y: 0.85, visibility: 0.9 };
    landmarks[28] = { x: 0.6, y: 0.85, visibility: 0.9 };

    let arcCalls = 0;
    let strokeCalls = 0;
    const ctx = {
      beginPath: () => undefined,
      arc: () => {
        arcCalls += 1;
      },
      fill: () => undefined,
      stroke: () => {
        strokeCalls += 1;
      },
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    drawPoseLandmarkDots(ctx, landmarks, 640, 480, "ready", { includeShoulders: false });
    assert.equal(arcCalls, 6);
    assert.equal(strokeCalls, 6);
  });
});
