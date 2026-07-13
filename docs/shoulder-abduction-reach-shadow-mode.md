# Shoulder Abduction Reach — Shadow Mode

Delivers the deferred item from `docs/shoulder-abduction-reach-detector.md`'s
"Future work" section: *"Live wiring behind a flag-gated hook, mirroring
`repQualityShadowMode` and `is-sts-motion-timeline-enabled.ts` — its own
future PR."*

## What "shadow mode" means here

Unlike the STS shadow-mode sprint (`docs/sts-shadow-mode-validation.md`),
there is no legacy shoulder detector to diff against — Shoulder Abduction
Reach is a brand-new exercise. "Shadow" here means: the detector can run
alongside a live capture session, on real frames, without affecting
anything the user sees — no UI, no persistence, no behavior change. It
observes its own behavior (rep counts, phase transitions, tracking
reliability) for internal review, not a new-vs-old comparison.

## What this sprint built, and what it deliberately did not do

**Built:** a complete, real, callable wiring mechanism —

- `shoulder-abduction-reach-shadow-gate.ts` — enablement check, off by
  default, `?cvDebug=1&shoulderShadow=1` opt-in (developer-only), mirroring
  `is-sts-motion-timeline-enabled.ts`'s exact gate shape and reusing the
  same underlying `isPatientCvDebugEnabled()` flag.
- `shoulder-abduction-reach-shadow-log.ts` — in-memory session log:
  frame count, invalid-frame-contract count, per-side rep-completion and
  phase-change events (capped sample of 50 for manual review, uncapped
  authoritative counters). Console-only (`console.debug`), only on notable
  events — never one line per frame.
- `shoulder-abduction-reach-shadow-hook.ts` —
  `runShoulderAbductionReachShadowFrame(state, landmarks, context)`, the
  single function a live capture component would call once per frame. When
  disabled (the default), it does one gate check and returns — zero cost,
  no detector runs, no state touched.

**Deliberately not done:** this hook is **not called from any live
component**. `PatientCvCapture.tsx`, `AssessmentCvCaptureSession.tsx`, the
CV Lab page, every existing detector, every API route, and the database are
all untouched — confirmed by grepping for any import of
`shoulder-abduction-reach-shadow-hook` outside this module (none found).
This was an explicit scope decision: build a real, testable "shared
capture-frame hook" now, defer the actual live call site to a future PR,
rather than touch a component used in controlled clinic pilots in the same
sprint that first builds the wiring mechanism.

## Design notes

- **Testability without a browser.** `runShoulderAbductionReachShadowFrame`
  takes an optional `isEnabled` parameter defaulting to the real
  `isShoulderAbductionReachShadowEnabled()` gate. A live caller never
  passes it and always gets the real browser-based gate; tests pass
  `() => true` / `() => false` to exercise both branches deterministically
  without mocking `window` (this repo's `node:test` setup has no DOM).
- **Rep detection is delta-based, not phase-based.** The log detects "a rep
  completed" by comparing `repCount` between consecutive frames, not by
  inferring it from a phase transition into `"resting"` — not every
  lowering→resting transition completes a rep (see the phase FSM's
  documented "partial attempt" case in
  `shoulder-abduction-reach-phase.ts`), so re-deriving completion from phase
  alone would misclassify partial attempts as completed reps.
- **No generic multi-detector shadow framework.** This hook is concrete to
  the shoulder detector, not an abstract plugin registry for hypothetical
  future shadow detectors. If and when a second detector needs the same
  treatment, this module is the pattern to copy — building the abstraction
  now, before a second real use case exists, was judged premature.

## Running it

```bash
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-shadow-gate.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-shadow-log.test.ts
npx tsx --test app/lib/shoulder-rehabilitation/shoulder-abduction-reach-shadow-hook.test.ts
```

What a future live component's call site would look like (not present in
this codebase yet):

```ts
import { createShoulderAbductionReachShadowState, runShoulderAbductionReachShadowFrame } from "@/app/lib/shoulder-rehabilitation";

// once per capture session:
const shadowState = createShoulderAbductionReachShadowState();

// once per frame, alongside the existing detector's own per-frame call:
runShoulderAbductionReachShadowFrame(shadowState, landmarks, { frameIndex, capturedAtMs });

// at session end, for local/dev review only:
console.log(summarizeShoulderAbductionReachShadowSessionLog(shadowState.log));
```

## Future work (explicitly deferred, not this sprint)

1. **Actually call the hook from a live component.** CV Lab
   (`/clinician/cv-lab`) is the lowest-risk candidate — internal clinician
   tooling, not part of the patient pilot path per
   `docs/RASQ_CURRENT_STATE.md`. This is its own future PR, reviewed on its
   own given it would be the first sprint in this arc to touch live
   component code.
2. Exercise-allowlist registration — still not done, still a product/UI
   decision, not a code change to make unilaterally.
3. A UI surface for shadow-log output (currently console-only by design).

## Related documents

- [shoulder-abduction-reach-detector.md](./shoulder-abduction-reach-detector.md)
- [sts-shadow-mode-validation.md](./sts-shadow-mode-validation.md)
- [input-acquisition-architecture.md](./input-acquisition-architecture.md)
