# Shoulder Abduction Reach — ML research capture (dev-only)

RASQ ML bridge, Slice 1 (2026-08-19). Data-infrastructure only — no model is
trained by this code. See the Slice 1 project report for full context,
rationale, and known risks.

## What this is

A local, dev-only pipeline that turns a live `ShoulderAbductionReachPoseDetector`
session into one JSON-Lines file per dev capture session, one line per
**completed** repetition, under `dev-data/rasq-ml/shoulder-abduction/`
(gitignored — never committed).

## Pipeline

```
Camera → MediaPipe → NormalizedMotionFrame (existing Motion Intelligence Core)
  → onDevFrameCaptured (optional, off by default; shoulder-abduction-reach-pose-detector.ts)
  → dev-capture-sink.ts (picks 8 bilateral joints, feeds rep-recorder.ts)
  → rep-recorder.ts (buffers frames between rep boundaries owned by the
    existing phase FSM; only emits a record when a repetition COMPLETES)
  → derived-features.ts (peak normalized trunk drift ratio, peak angle,
    duration, peak angular velocity, tracking quality)
  → POST /api/dev/ml-research/shoulder-abduction-reach-capture (dev-only,
    404s outside NODE_ENV=development)
  → local-jsonl-writer.ts → dev-data/rasq-ml/shoulder-abduction/<devSessionId>.jsonl
```

Entry point for a real capture session:
`app/clinician/shoulder-abduction-reach-ml-capture-lab/page.tsx` (dev-only page).

Inspect captured files with `scripts/ml-research/inspect-shoulder-abduction-capture.ts`.

## Record shape

See `capture-schema.ts` for full types. Summary:

- `context` — `captureSchemaVersion`, `featureSchemaVersion` (`features-v2` for
  new captures; the validated 29-rep session remains `features-v1` on disk),
  anonymous `participantId`, `devSessionId`, `repetitionId`, `side`,
  `movementType`, start/end timestamps, and an optional `simulationCondition`
  string.
- `frames` — one entry per captured frame: `relativeTimestampMs`,
  `frameIndex`, and the 8 bilateral joints (hip/shoulder/elbow/wrist × L/R)
  in RASQ's existing `MotionFrameJoint` shape (`{ landmark: {x,y,z?},
  confidence: {visibility, present} }`).
- `derivedFeatures` — `peakNormalizedTrunkDriftRatio` (dimensionless trunk lateral
  drift ratio peak), `peakShoulderAngleDegrees` (2D shoulder-abduction angle
  estimate peak, degrees), `movementDurationMs`, `peakAngularVelocityDegPerSec`
  (secondary technical velocity feature, deg/s — not a smoothness metric),
  `trackingQuality` (`framesTotal`, `framesWithUsableAngle`, `usableFrameRatio`,
  optional `minCoreJointVisibility` on v2+).

## What this is NOT

- **Not therapist ground truth.** Therapist labels are observational research
  reference labels — useful for ML dataset construction, but not validated
  clinical ground truth and not a substitute for therapist review in care
  delivery. `simulationCondition` (e.g.
  `"normal"` / `"simulated_trunk_lean"`) is an internal test-fixture label
  set by whoever is running the capture session, not a clinical judgment.
  Do not use it to train or evaluate a model as if it were a therapist
  label — see Slice 1 report, Step 5 (ground truth design), which this
  field deliberately does not attempt to satisfy.
- **Not production data.** Never written to Supabase, never touches
  `cv_session_metrics` (`app/lib/cv/cv-forbidden-keys.ts`'s guard on that
  table is untouched and still applies to it), never contains raw video or
  images.
- **Not a clinical measurement.** Every derived feature is a technical,
  camera-relative observation — see each field's doc comment in
  `capture-schema.ts` / `derived-features.ts` for what it does and does not
  claim.

## Label integrity (Slice 2, dev/research only)

Therapist labels are stored separately under
`dev-data/rasq-ml/shoulder-abduction-labels/` (see `local-label-writer.ts`).

Integrity controls (fail-closed, server-side):

- `sourceLineIndex` is a **traceability locator** — not sufficient repetition
  identity alone.
- The label POST route verifies `devSessionId`, `sourceLineIndex`,
  `repetitionId`, and `side` together against the capture JSONL line via
  `resolveCaptureIdentityForLabel` before accepting a label.
- `participantId` is **server-derived** from the verified capture record —
  never accepted from the browser.
- `raterId` is a dev/research identifier only (`normalizeResearchRaterId` trims
  leading/trailing whitespace, rejects empty/control/oversized values). It is
  **not** authentication or verified clinician identity.
- These controls improve dataset integrity for ML research. They do **not**
  establish clinical validity, diagnostic correctness, or ground truth.
