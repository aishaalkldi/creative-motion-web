# Shoulder Abduction Reach — CV Lab Shadow Wiring

Wires the shadow-mode hook built in
`docs/shoulder-abduction-reach-shadow-mode.md` into
`/clinician/cv-lab` — the first live component in this whole arc that
actually calls it.

## The problem: CV Lab has no raw landmarks to give the hook

`CvLabSession.tsx` instantiates `SitToStandDetector`
(`app/lib/cv/sit-to-stand-detector.ts`) and only ever receives a
`SitToStandDetectorSnapshot` back via its `onSnapshot` callback —
`trackingStatus`, `trackingQuality`, `repCount`, `framesWithPose`, etc.
Raw per-frame landmarks never leave the detector's private internals; this
is deliberate (CV Lab's own on-page copy: *"No video is recorded, stored,
or transmitted"*).

Worse: `SitToStandDetector` is not CV-Lab-specific. It's imported by four
components:

```
CvLabSession.tsx                          ← target
AssessmentCvCaptureSession.tsx            ← forbidden
AssessmentTimedCaptureSession.tsx         ← same shared class
PatientCvCapture.tsx                      ← forbidden
```

Editing `sit-to-stand-detector.ts` — even by one additive, opt-in line —
would not actually be "CV Lab only." It's the engine behind the real
patient-facing pilot capture path. This was the central finding that shaped
everything below.

## The solution: an independent, CV-Lab-only PoseLandmarker

Rather than get landmarks from `SitToStandDetector`, CV Lab now bootstraps
its **own, second** MediaPipe `PoseLandmarker` instance and reads frames
from the **same already-live `<video>` element** it already owns. A
`<video>` element can be read by more than one consumer — this needs no new
camera permission, no new `getUserMedia` call, no new consent step.

```
CvLabSession.tsx (previewActive, videoRef — unchanged)
        │
        ├─ new SitToStandDetector(...)  ← completely unchanged, still owns its own
        │                                  camera stream + landmarker + RAF loop
        │
        └─ useShoulderAbductionReachCvLabShadow({ videoRef, active: previewActive })
                │  (useShoulderAbductionReachCvLabShadow.ts — thin React glue)
                ▼
           createShoulderAbductionReachCvLabShadowRunner()
                │  (shoulder-abduction-reach-cv-lab-shadow-runner.ts)
                │
                ├─ isShoulderAbductionReachShadowEnabled()? → no: return immediately, nothing else runs
                │
                └─ yes: bootstrap a SECOND PoseLandmarker (reusing the already-exported
                   createPoseLandmarker() + withSitToStandTimeout() from
                   sit-to-stand-detector.ts — reused as a public function call,
                   not a modification), run its own requestAnimationFrame loop
                   against the same <video>, call
                   runShoulderAbductionReachShadowFrame() per frame
```

**Files:**

| File | Change |
|---|---|
| `app/components/clinician/cv/shoulder-abduction-reach-cv-lab-shadow-runner.ts` | New. Framework-free lifecycle logic (start/stop/cleanup, gate short-circuit, landmarker bootstrap). Deps-injected so it's unit-testable without a browser. |
| `app/components/clinician/cv/useShoulderAbductionReachCvLabShadow.ts` | New. Thin `useEffect` wrapper — the only React/browser-glue layer. Renders nothing, returns nothing. |
| `app/components/clinician/cv/CvLabSession.tsx` | Modified — 8 lines added (one import, one hook call with an explanatory comment). No other line touched. |
| `sit-to-stand-detector.ts`, `PatientCvCapture.tsx`, `AssessmentCvCaptureSession.tsx`, `AssessmentTimedCaptureSession.tsx` | **Not touched** — confirmed via `git diff --stat`, zero changes to any of the four. |

## The accepted tradeoff: two pose models running at once

When shadow mode is on, **two independent MediaPipe PoseLandmarker
instances run concurrently against the same camera feed** — the existing
one inside `SitToStandDetector`, and this runner's own. This roughly
doubles pose-inference CPU/GPU cost for the duration of the session.

This is accepted deliberately, not overlooked:

- It is **only ever paid when a developer explicitly opts in** via
  `?cvDebug=1&shoulderShadow=1` — off by default, and the gate is checked
  *before* the second landmarker is even loaded (`start()`'s first line is
  the gate check; if disabled, `loadLandmarker` is never called).
- CV Lab is explicitly **internal, non-patient-facing tooling** (per its
  own on-page banner: *"Internal Lab Only... not for clinical use or
  patient assessment"*) — the cost, when paid, is paid by a developer on a
  demo device, never during a real session.
- The alternative (an additive opt-in callback on the shared
  `SitToStandDetector` class) would have been cheaper computationally but
  would have required editing the file every other sprint in this arc
  treated as untouchable, and would have made "CV Lab only" a much harder
  claim to stand behind given that class's other three consumers. Given
  this arc's consistent bias toward zero-touch on shared/patient-adjacent
  code, the extra CPU/GPU cost was judged the better trade.

## Flag activation (unchanged from the underlying hook)

`isShoulderAbductionReachShadowEnabled()` requires **both** `cvDebug=1`
(the existing shared debug flag) **and** `shoulderShadow=1` in the URL
query string, browser-only, off by default. No config default was changed.
Example: `https://.../clinician/cv-lab?cvDebug=1&shoulderShadow=1`.

## Confirming no side effects

- **UI:** `CvLabSession.tsx` renders identically whether the flag is on or
  off — the hook returns `void` and is never read by JSX.
- **API/database:** the runner never calls `fetch`. CV Lab's existing save
  path (`POST /api/cv/session-metrics`, wired to `SitToStandDetector`'s own
  metrics) is completely untouched and unaware this exists.
- **Patient sessions / reports:** unreachable from any patient-facing or
  clinician-assessment surface — the new files are imported only by
  `CvLabSession.tsx`.
- **Clinical interpretation:** none introduced; the runner is a thin
  frame-supply layer over the already-descriptive-only detector and logger.
- **Console-only output:** unchanged from the underlying hook —
  `console.debug`, only on notable events (rep completions, phase
  changes), never per-frame.

## Test plan and its honest limit

Unit-tested (`node:test`, no browser): gate short-circuit (disabled →
zero cost, no landmarker load), start/stop lifecycle, double-start
prevention, cleanup on `stop()`, the stop-while-loading race (landmarker
closed once the load resolves, no frame scheduled), zero-landmarks frames
not reaching the shadow hook, and a full end-to-end synthetic session
proving a real rep count comes out the other end of the whole pipeline
(runner → hook → detector → Motion Intelligence Core).

**Not unit-tested, by necessity:** the real `PoseLandmarker.createFromOptions`
+ `detectForVideo` + `requestAnimationFrame` loop against a real `<video>`
element and a real camera — this needs a browser, same limitation
`sit-to-stand-detector.ts` itself has always had. Manual verification
step: open `/clinician/cv-lab?cvDebug=1&shoulderShadow=1` in a browser,
start a session, open devtools console, confirm `[shoulder-shadow]` log
lines appear as you move an arm, and confirm the visible UI is byte-for-byte
identical to a session without the query params.

## Related documents

- [shoulder-abduction-reach-shadow-mode.md](./shoulder-abduction-reach-shadow-mode.md)
- [shoulder-abduction-reach-detector.md](./shoulder-abduction-reach-detector.md)
