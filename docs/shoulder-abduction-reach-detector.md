# Shoulder Abduction Reach Detector (v0)

The first Shoulder Rehabilitation detector, and the first exercise detector
built entirely on the [Motion Intelligence Core](./architecture.md) and the
[Input Acquisition Layer](./input-acquisition-architecture.md) rather than
the legacy per-exercise pattern used by the other seven `app/lib/cv/*`
detectors (raw BlazePose index access, `sagittal-hip-rep-core.ts` baseline
calibration, shared `SitToStandDetectorSnapshot` coupling).

Module: `app/lib/shoulder-rehabilitation/`.

## Why a new architecture, not the legacy pattern

Per the implementation sequence already recorded in
`docs/input-acquisition-architecture.md`, this detector exists to prove the
Motion Intelligence Core + Input Acquisition Layer stack end to end on a
real exercise, rather than adding an eighth instance of the legacy
index-based pattern. Nothing in `app/lib/cv/*` — including
`functional-reach-detector.ts`, the closest existing arm-tracking
detector — is imported, modified, or depended on by this module. The
dependency direction is exactly the one already established by the last two
sprints:

```
app/lib/shoulder-rehabilitation/*
        │ imports (types + pure functions only)
        ▼
app/lib/input-acquisition/*  ──────▶  app/lib/motion-intelligence/*
        │ imports PoseLandmark type only
        ▼
app/lib/cv/pose-landmark-overlay.ts
```

Motion Intelligence Core is not touched and has no knowledge this detector
exists.

## Movement and joints

**Movement:** one arm raised laterally from resting at the side toward
horizontal/overhead, then lowered. Both sides are tracked independently so
a session can observe one arm, the other, or both for comparison.

| Joint role | Left | Right | Required? |
|---|---|---|---|
| Trunk reference (proximal) | `left_hip` | `right_hip` | Core |
| Angle vertex | `left_shoulder` | `right_shoulder` | Core |
| Upper-arm direction (distal) | `left_elbow` | `right_elbow` | Core |
| Reach-extent observation | `left_wrist` | `right_wrist` | Bonus (optional) |

"Core" joints are required to compute an angle at all; "bonus" (wrist) is a
secondary observation reported when available, never required.

## Metrics — all direct reuse of existing Motion Intelligence Core primitives

| Metric | How it's computed | Core primitive reused |
|---|---|---|
| Abduction angle (per side) | Interior angle at the shoulder between the shoulder→hip vector (trunk reference) and shoulder→elbow vector (upper arm) | `computeJointAngleDegrees(hip, shoulder, elbow)` — unmodified |
| Wrist offset from shoulder (per side) | Wrist position relative to shoulder; negative `deltaY` means the wrist is above the shoulder | `computeRelativeJointOffset(shoulder, wrist)` — unmodified |
| Bilateral angle difference | Left angle minus right angle | Plain subtraction of two already-computed numbers — not a core primitive, since diffing two scalar angles isn't the same operation as `computeBilateralSymmetryDifference` (which diffs raw landmark coordinates on one axis) |

No new geometry, confidence, or validation logic was written. Confidence
gating on the angle is delegated entirely to `computeJointAngleDegrees`'s
own `confidences` option — this module does not re-implement a confidence
check.

**Angle convention:** at rest, the shoulder→elbow vector is roughly
parallel to the shoulder→hip vector (angle near 0°). Raised to horizontal,
the vectors are roughly perpendicular (~90°). Raised further, they approach
opposite (180°). This is a single-camera geometric observation, not a
clinical goniometric measurement.

## Session-level validation

`validateShoulderAbductionReachFrames(frames, side, thresholds)` wraps
Motion Intelligence Core's `validateMotionMetricInput`
(`metric-validation.ts` — not re-exported from the `motion-intelligence`
barrel, imported directly) with this exercise's required-joint list
(`hip`, `shoulder`, `elbow`). This is sequence-level gating ("is there
enough confidently-tracked data across these frames to trust a rep count"),
distinct from and complementary to the per-frame gating already inside
`computeJointAngleDegrees`. No validation logic is duplicated between the
two.

## Phase and rep tracking

A small, purpose-built threshold-crossing state machine —
`resting → raising → peak_abduction → lowering → resting` — deliberately
**not** reusing:

- `sagittal-hip-rep-core.ts` — its baseline-calibration model fits a
  seated/standing hip-Y reference, not an arm angle.
- `rep-quality-fsm.ts` — its capture-flag vocabulary (`incomplete_stand`,
  `incomplete_return`) is sit/stand-specific language that doesn't describe
  a raise/lower arm movement.

This is intentionally simpler than either: threshold crossings only, no
baseline calibration, configurable via `ShoulderAbductionReachThresholds`
(defaults: resting ≤20°, peak ≥70°, 10° hysteresis before leaving the peak
band, phase becomes `"unknown"` after 8 consecutive frames with no usable
angle — mirrors the existing `FUNCTIONAL_REACH_POSE_LOST_UNKNOWN_MIN_TICKS`
constant's value).

**Known limitation (v0, not treated as a bug):** if tracking is lost for 8+
consecutive frames while mid-rep, the phase moves to `"unknown"` and then
`"resting"` without passing through `"lowering"` — that in-progress rep is
not counted, even if the arm genuinely completed the movement off-camera.
No recovery/backfill logic is implemented for this case in v0.

## Safety boundaries

- All output is descriptive only: angle numbers, presence/confidence
  flags, rep counts, peak values. No pass/fail, no severity labels, no
  comparison against a "normal" range of motion, no diagnostic language
  anywhere in code, comments, or types.
- Thresholds are explicitly documented as "technical v0 defaults — not
  derived from any clinical normal-ROM standard" in
  `shoulder-abduction-reach-contract.ts`.
- This inherits `motion-metrics.ts`'s existing framing (its
  `computeJointCoordinateSpan` docstring already states "not a clinical
  range-of-motion measurement") rather than introducing new clinical
  language.

## What this sprint does not do

- Does not modify any existing detector, component, API route, database
  code, auth, patient identity, or clinical wording.
- Does not add `shoulder-abduction-reach` (or any name) to
  `CvY1ExerciseId` / `PatientCvDetectorKind` (`cv-patient-config.ts`) or
  `exercise-kinesiology-context.ts` — no exercise-allowlist registration.
- Does not wire into any live capture loop, `PatientCvCapture.tsx`, or any
  other component.
- Does not perform sensor fusion — camera only, per this sprint's scope.
- Ships as a standalone, unit-tested module only.

## Running it

```bash
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-contract.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-metrics.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-validation.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-phase.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-detector.test.ts
```

End-to-end example (synthetic session, no camera required):

```ts
import {
  createShoulderAbductionReachDetectorState,
  updateShoulderAbductionReachDetector,
} from "@/app/lib/shoulder-rehabilitation";

const state = createShoulderAbductionReachDetectorState();
for (const [frameIndex, landmarks] of recordedFrames.entries()) {
  const result = updateShoulderAbductionReachDetector(state, landmarks, {
    frameIndex,
    capturedAtMs: frameIndex * 33,
  });
  console.log(result.left.phase, result.left.abductionAngleDegrees);
}
console.log(state.left.repCount, state.right.repCount);
```

## Future work (explicitly deferred, not this sprint)

1. Live wiring behind a flag-gated hook, mirroring `repQualityShadowMode`
   and `is-sts-motion-timeline-enabled.ts` — its own future PR.
2. Exercise-allowlist registration (`cv-patient-config.ts`,
   `exercise-kinesiology-context.ts`) — a UI/product decision, not a code
   change to make unilaterally.
3. Additional shoulder movements (flexion, external/internal rotation) as
   siblings under the same module.
4. Sibling rehab modules (`knee-rehabilitation/`, `balance-rehabilitation/`,
   `gait-rehabilitation/`) following this same pattern.
5. Sensor Fusion Engine — out of scope until a second acquisition source
   (IMU, RASQ Watch, Reference Sensor) exists.

## Related documents

- [input-acquisition-architecture.md](./input-acquisition-architecture.md)
- [sts-shadow-mode-validation.md](./sts-shadow-mode-validation.md) — the
  prior sprint's validation of the same Input Acquisition Layer against a
  legacy detector
