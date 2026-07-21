/**
 * Run: npx tsx --test app/lib/interactive-shoulder/motion-patterns/bezier-path.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bezierSegmentsFromWaypoints,
  buildSampledPath,
  evaluateBezier,
  projectPointOntoPath,
  samplePathAtProgress,
} from "./bezier-path";

describe("bezier-path", () => {
  it("evaluates a cubic segment at the endpoints", () => {
    const segment = {
      start: { x: 0.2, y: 0.8 },
      control1: { x: 0.3, y: 0.6 },
      control2: { x: 0.5, y: 0.4 },
      end: { x: 0.7, y: 0.2 },
    };
    assert.deepEqual(evaluateBezier(segment, 0), segment.start);
    assert.deepEqual(evaluateBezier(segment, 1), segment.end);
  });

  it("builds a smooth path from waypoints and samples progress monotonically", () => {
    const segments = bezierSegmentsFromWaypoints([
      { x: 0.3, y: 0.7 },
      { x: 0.45, y: 0.5 },
      { x: 0.65, y: 0.25 },
    ]);
    const path = buildSampledPath(segments);
    const start = samplePathAtProgress(path, 0);
    const mid = samplePathAtProgress(path, 0.5);
    const end = samplePathAtProgress(path, 1);
    assert.ok(start.y > mid.y);
    assert.ok(mid.y > end.y);
  });

  it("projects a wrist point onto the nearest path location", () => {
    const segments = bezierSegmentsFromWaypoints([
      { x: 0.3, y: 0.7 },
      { x: 0.65, y: 0.25 },
    ]);
    const path = buildSampledPath(segments);
    const onPath = samplePathAtProgress(path, 0.5);
    const projection = projectPointOntoPath(path, onPath);
    assert.ok(projection.distance < 0.02);
    assert.ok(projection.progress > 0.3 && projection.progress < 0.7);
  });
});
