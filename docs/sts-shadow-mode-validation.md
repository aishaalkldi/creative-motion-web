# STS Shadow-Mode Validation (Input Acquisition Layer)

This document covers the shadow-mode comparison harness that validates the
[Input Acquisition Layer](./input-acquisition-architecture.md) against the
live Sit-to-Stand pipeline, using Sit-to-Stand as the first proving ground
per the layer's implementation sequence (step 2).

## Purpose

The Input Acquisition Layer's BlazePose adapter had never processed a real
capture session before this sprint. This harness runs the new pipeline
alongside the existing detector's own signal, on the exact same landmark
data, and reports where they agree or diverge — **without changing the
live pipeline in any way.**

## What this sprint does and does not do

**Does:**
- Adds a standalone comparison module (`sts-shadow-comparison.ts`) and an
  in-memory session log/runner (`sts-shadow-log.ts`) under `app/lib/cv/`.
- Compares hip-visibility tracking quality between the legacy (raw BlazePose
  index) path and the new Input Acquisition Layer path, frame by frame.
- Logs divergences to the console only, and only when a divergence actually
  occurs (never one line per frame).
- Ships as a fully unit-tested, importable harness that can be fed a
  recorded or synthetic landmark sequence.

**Does not:**
- Modify `sit-to-stand-detector.ts` in any way — not one line.
- Modify any component (`PatientCvCapture.tsx`,
  `AssessmentCvCaptureSession.tsx`, or any other).
- Modify any API route or database write path.
- Call into the live capture loop, `requestAnimationFrame` cycle, or any
  detector instance.
- Persist anything — no Supabase writes, no network calls, no file writes.

This is a deliberately conservative reading of "shadow-mode wiring": the
comparison **engine** is real, tested, and ready to be invoked with live
per-frame data, but the actual live invocation (calling it from inside the
capture loop) is explicitly deferred to a future, separately reviewed PR —
see "Deferred: live wiring" below. Given `sit-to-stand-detector.ts` is a
large, stateful class actively used in controlled clinic pilots (per
`docs/RASQ_CURRENT_STATE.md`), even a minimal flag-gated hook was judged
out of scope for a sprint whose explicit requirement was to keep that
pipeline completely unchanged.

## What is compared, and why

The comparison is intentionally narrow: **hip-visibility tracking quality**,
the one signal both the legacy detector and the new pipeline can compute
from the same raw landmarks without either side needing new capabilities.

| Side | How it's computed | Source |
|---|---|---|
| Legacy | `evaluateHipTrackingQuality(landmarks, visibilityGood, visibilityFair)` | `sit-to-stand-detector.ts` (existing export, called directly — not re-implemented) |
| New | `BLAZEPOSE_ACQUISITION_ADAPTER.normalize(landmarks, context)` → left/right hip `confidence.visibility` → `evaluateTrackingQualityFromHipVisSum(sum, visibilityGood, visibilityFair)` | `input-acquisition` + `session-visibility-summary.ts` (existing export, called directly) |

Both sides call the **same existing, already-shipped classification
function** (`evaluateTrackingQualityFromHipVisSum` in
`session-visibility-summary.ts`) — the legacy detector already depends on
it internally. Only the *input* to that function differs between the two
paths (raw array index vs. normalized frame lookup), which is exactly what
this harness is meant to validate. This satisfies RASQ's "do not duplicate
measured metrics or business logic" constraint: no tracking-quality
thresholding logic is re-implemented anywhere in this module.

Default thresholds (`visibilityGood: 1.4`, `visibilityFair: 0.8`) are read
directly from `DEFAULT_STS_CONFIG` in `bio-0-contracts.ts` — not
re-declared.

## Divergence reasons

| Reason | Meaning |
|---|---|
| `tracking_quality_mismatch` | Legacy and new paths land in different good/fair/poor tiers |
| `hip_visibility_sum_delta_exceeds_tolerance` | The two hip-visibility sums differ by more than floating-point tolerance, even if the tier still matches |
| `new_frame_contract_invalid` | The normalized frame fails `validateNormalizedMotionFrame()` (or the adapter returned `null`) |
| `new_frame_missing_hip_joint` | The legacy path saw non-zero hip visibility, but the new frame omitted a hip joint entirely |

One expected, legitimate source of `hip_visibility_sum_delta_exceeds_tolerance`
divergence: the legacy path sums raw, unclamped visibility values, while the
Input Acquisition Layer clamps each landmark's visibility into `[0, 1]`
before summing (see `blazepose-acquisition-adapter.ts`). If BlazePose ever
reports a landmark visibility above `1.0`, the two sums will differ by
design — that's the new pipeline behaving correctly, not a bug, and this
harness is what makes that difference visible instead of silent.

Another expected source of `new_frame_missing_hip_joint`: the Input
Acquisition Layer only includes a joint in the frame when its coordinates
are within `[0, 1]` (screening out off-screen limbs — see the coordinate-range
fix in PR #134). The legacy path has no equivalent screen and will happily
sum a hip's visibility even when that hip's `x`/`y` are off-screen. This is
the single largest expected source of divergence and is exactly the kind of
behavioral difference this sprint exists to surface before any live wiring
is considered.

## Running it

Unit tests (synthetic landmark sequences, no camera required):

```bash
npx tsx --test app/lib/cv/sts-shadow-comparison.test.ts
npx tsx --test app/lib/cv/sts-shadow-log.test.ts
```

Feeding a real or recorded session:

```ts
import { runStsShadowSessionComparison } from "@/app/lib/cv/sts-shadow-log";

const { log, summary } = runStsShadowSessionComparison(
  recordedFrames.map((f, i) => ({
    landmarks: f.landmarks,
    context: { frameIndex: i, capturedAtMs: f.timestampMs },
  })),
);

console.log(summary);
// { frameCount, divergentFrameCount, divergenceRate, divergenceReasonCounts }
```

`log.sampleDivergences` holds up to 20 full comparison records for manual
review; `summary` is the aggregate for a quick pass/fail read on a session.

## Deferred: live wiring

Not part of this sprint. A future PR could add a flag-gated hook inside
`SitToStandDetector`'s per-frame update path, following the exact pattern
already established in this codebase for `repQualityShadowMode`
(`bio-0-contracts.ts`: *"MQ-REP-1 shadow: run FSM in parallel without
affecting repCount or save payload"*) and `is-sts-motion-timeline-enabled.ts`
(`?cvDebug=1&smtTimeline=1`, off by default, developer-only opt-in). Any
such change would touch `sit-to-stand-detector.ts` directly and should go
through its own focused review given that file's role in live clinic
pilots — deliberately not bundled into this sprint.

## Related documents

- [input-acquisition-architecture.md](./input-acquisition-architecture.md) —
  the layer being validated here
- [RASQ_CURRENT_STATE.md](./RASQ_CURRENT_STATE.md) — STS pilot status
