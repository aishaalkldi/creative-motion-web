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

## Research dataset manifest (Slice 4, dev/research only)

A **manifest** is the deterministic join of capture lines with therapist label
lines, written to `dev-data/rasq-ml/shoulder-abduction-manifests/`
(gitignored). It is an internal, derived, read-only research artifact — **not**
a training dataset, not a clinical dataset, not adjudicated ground truth, and
not a train/test split.

```
capture JSONL + label JSONL
  → manifest-source-reader.ts  (raw lines, nothing filtered away)
  → manifest-assembly.ts       (fail-closed identity join + diagnostics)
  → manifest-schema.ts         (canonical, timestamp-free serialization)
  → manifest-writer.ts         → dev-data/rasq-ml/shoulder-abduction-manifests/
```

Assemble one:

```
npx tsx scripts/ml-research/assemble-shoulder-abduction-manifest.ts \
  --session <devSessionId> [--session <devSessionId> ...] \
  [--out <path.manifest.json>] [--allow-diagnostics] [--print]
```

Sessions are named explicitly; there is no directory auto-discovery, so the
`test-fixture-*` sessions other tests write into the capture directory can
never leak into a research manifest.

Design rules:

- **Canonical sample identity** is `(devSessionId, sourceLineIndex)` — one
  manifest sample per captured repetition. `repetitionId`, `side`, and
  `participantId` are cross-checked identity *assertions*, never the join key
  (Slice 1 `repetitionId` values can collide across sides).
- **Fail closed.** A label is attached only when its own persisted
  `devSessionId`, `sourceLineIndex`, `repetitionId`, `side`, and
  `participantId` all agree with the located capture line. Anything else is
  reported as a rejection (orphan, identity mismatch, malformed, or
  version-incompatible) and left out.
- **Multi-rater by construction.** `labels` is an array of independent rater
  judgments — 0, 1, or many. The only collapse applied is Slice 2's existing
  "latest label per `(sourceLineIndex, raterId)`" rule, reused directly from
  `label-reader.ts`. No consensus, majority, reference label, severity score,
  or numeric encoding is computed — that belongs to a later methodology stage.
- **No silent data loss.** Unlike the labeling readers (which correctly skip
  unparsable/invalid lines when serving the UI), the assembly path hands every
  non-empty line to the assembler and reports it. The CLI additionally fails
  closed on any rejection and writes nothing unless `--allow-diagnostics` is
  passed.
- **References, not copies.** A sample carries a source reference
  (`relativeFilePath`, `lineIndex`, `frameCount`) — never frames, joints,
  landmarks, video, images, or derived feature values. A future exporter
  recovers the sequence from the source identity.
- **Deterministic.** Samples sort by session then `sourceLineIndex`, labels by
  `raterId` then `labeledAtMs`, rejections by session/kind/line/reason. The
  manifest file itself contains no timestamp; wall-clock run metadata goes to
  a separate `.run.json` sidecar, so identical inputs produce byte-identical
  manifest content.
- **Read-only on sources.** Assembly never writes to the capture or label
  directories, and the writer refuses an output path inside either one.
- `participantId` is retained as internal research provenance (needed later
  for participant-level, leakage-safe splitting). No API route or page exposes
  the manifest, and the labeling API remains unchanged.
- Five distinct versions answer five different questions:
  `captureSchemaVersion`, `featureSchemaVersion`, `labelSchemaVersion`,
  `datasetVersion`, and `manifestSchemaVersion`
  (`shoulder-abduction-manifest-v1`). Capture `features-v1` and `features-v2`
  are both joinable; unrecognized versions are rejected, never joined
  optimistically.
