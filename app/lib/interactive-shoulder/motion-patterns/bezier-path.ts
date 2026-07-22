import type { NormalizedPoint } from "../types";

/** Cubic Bezier segment in normalized screen space. */
export type BezierSegment = {
  start: NormalizedPoint;
  control1: NormalizedPoint;
  control2: NormalizedPoint;
  end: NormalizedPoint;
};

export type SampledPath = {
  segments: readonly BezierSegment[];
  /** Cumulative segment lengths — same length as segments. */
  segmentLengths: readonly number[];
  totalLength: number;
};

export function distanceNormalized(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Evaluates a cubic Bezier at parameter u in [0, 1]. */
export function evaluateBezier(segment: BezierSegment, u: number): NormalizedPoint {
  const t = Math.min(1, Math.max(0, u));
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x:
      mt2 * mt * segment.start.x +
      3 * mt2 * t * segment.control1.x +
      3 * mt * t2 * segment.control2.x +
      t2 * t * segment.end.x,
    y:
      mt2 * mt * segment.start.y +
      3 * mt2 * t * segment.control1.y +
      3 * mt * t2 * segment.control2.y +
      t2 * t * segment.end.y,
  };
}

/** Approximate arc length by sampling each segment. */
function approximateSegmentLength(segment: BezierSegment, samples = 16): number {
  let length = 0;
  let previous = evaluateBezier(segment, 0);
  for (let index = 1; index <= samples; index += 1) {
    const point = evaluateBezier(segment, index / samples);
    length += distanceNormalized(previous, point);
    previous = point;
  }
  return length;
}

export function buildSampledPath(segments: readonly BezierSegment[]): SampledPath {
  const segmentLengths = segments.map((segment) => approximateSegmentLength(segment));
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  return { segments, segmentLengths, totalLength };
}

/** Maps global path progress [0, 1] to a point along all segments. */
export function samplePathAtProgress(path: SampledPath, progress: number): NormalizedPoint {
  if (path.segments.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped === 0) return evaluateBezier(path.segments[0]!, 0);
  if (clamped === 1) return evaluateBezier(path.segments[path.segments.length - 1]!, 1);

  const targetDistance = clamped * path.totalLength;
  let walked = 0;
  for (let index = 0; index < path.segments.length; index += 1) {
    const segmentLength = path.segmentLengths[index] ?? 0;
    if (walked + segmentLength >= targetDistance || index === path.segments.length - 1) {
      const localDistance = Math.max(0, targetDistance - walked);
      const localProgress = segmentLength > 0 ? localDistance / segmentLength : 0;
      return evaluateBezier(path.segments[index]!, localProgress);
    }
    walked += segmentLength;
  }
  return evaluateBezier(path.segments[path.segments.length - 1]!, 1);
}

export type PathProjection = {
  point: NormalizedPoint;
  progress: number;
  distance: number;
};

/** Projects a wrist point onto the nearest location along the sampled path. */
export function projectPointOntoPath(
  path: SampledPath,
  wrist: NormalizedPoint,
  samplesPerSegment = 24,
): PathProjection {
  let best: PathProjection = {
    point: samplePathAtProgress(path, 0),
    progress: 0,
    distance: Number.POSITIVE_INFINITY,
  };

  if (path.totalLength <= 0) {
    return { ...best, distance: distanceNormalized(wrist, best.point) };
  }

  let walked = 0;
  for (let segmentIndex = 0; segmentIndex < path.segments.length; segmentIndex += 1) {
    const segment = path.segments[segmentIndex]!;
    const segmentLength = path.segmentLengths[segmentIndex] ?? 0;
    for (let sampleIndex = 0; sampleIndex <= samplesPerSegment; sampleIndex += 1) {
      const localProgress = sampleIndex / samplesPerSegment;
      const point = evaluateBezier(segment, localProgress);
      const distance = distanceNormalized(wrist, point);
      const progress =
        path.totalLength > 0
          ? (walked + segmentLength * localProgress) / path.totalLength
          : 0;
      if (distance < best.distance) {
        best = { point, progress, distance };
      }
    }
    walked += segmentLength;
  }

  return best;
}

/** Converts waypoints into smooth cubic Bezier segments. */
export function bezierSegmentsFromWaypoints(
  waypoints: readonly NormalizedPoint[],
  tension = 0.35,
): BezierSegment[] {
  if (waypoints.length < 2) return [];
  const segments: BezierSegment[] = [];
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = waypoints[index]!;
    const end = waypoints[index + 1]!;
    const previous = waypoints[index - 1] ?? start;
    const next = waypoints[index + 2] ?? end;
    segments.push({
      start,
      end,
      control1: {
        x: start.x + (end.x - previous.x) * tension,
        y: start.y + (end.y - previous.y) * tension,
      },
      control2: {
        x: end.x - (next.x - start.x) * tension,
        y: end.y - (next.y - start.y) * tension,
      },
    });
  }
  return segments;
}

/** Dense samples for SVG/path rendering. */
export function samplePathForRendering(path: SampledPath, samplesPerSegment = 20): NormalizedPoint[] {
  const points: NormalizedPoint[] = [];
  for (const segment of path.segments) {
    for (let index = 0; index <= samplesPerSegment; index += 1) {
      points.push(evaluateBezier(segment, index / samplesPerSegment));
    }
  }
  return points;
}
