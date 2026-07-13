# RASQ Input Acquisition Layer

This document defines the Input Acquisition Layer: the seam between raw sensor/device
capture and the device-agnostic Motion Intelligence Core. It records what shipped in
this sprint, what is reserved for later, and the architecture decisions behind the
family boundaries.

## Purpose

Motion Intelligence Core (`app/lib/motion-intelligence`) defines `NormalizedMotionFrame`
— a device-agnostic, joint-position frame contract — and pure computation on top of it
(joint angle, distance, symmetry, span, precondition validation). Until this sprint, no
real capture source produced a `NormalizedMotionFrame`; the core was fully tested but
had zero production callers.

The Input Acquisition Layer is the missing seam: a generic contract that any capture
technology implements to normalize its raw output into a core type, plus a registry to
look adapters up by source kind. **Motion Intelligence Core has no import of, and no
knowledge of, this layer.** The dependency points one way:

```
app/lib/cv/*  (BlazePose capture — unchanged this sprint)
        │ imports PoseLandmark type only
        ▼
app/lib/input-acquisition/
        │ imports NormalizedMotionFrame, MotionCaptureSourceKind (types only)
        ▼
app/lib/motion-intelligence/*  (unaware this layer exists)
```

## Acquisition families

Not every sensor produces the same shape of data, so the layer is organized into
families rather than one universal contract:

| Family | Output shape | Status |
|---|---|---|
| **Motion** | `NormalizedMotionFrame` (spatial joint positions) | **Implemented.** BlazePose is the first adapter. |
| **Physiological** | `NormalizedPhysiologicalSample` (biosignal/vitals stream) | **Reserved.** Sample shape not yet designed; no adapter. |
| **Kinetic** | *(undefined)* | **Reserved — name only.** No sample type, no source kinds, no adapter contract. |

Forcing all sensor types into one shape would have been wrong: RASQ Watch ECG/vitals
and EMG/EEG are temporal biosignal streams, not joint positions, and Force Plate
ground-reaction-force/center-of-pressure data is kinetic, not a biosignal. Each family
gets its own contract so the type system reflects what a sensor actually measures.

## Source kinds by family

| Family | Source kind | Adapter | Notes |
|---|---|---|---|
| Motion | `web_camera_pose` | **Implemented** (`blazepose-acquisition-adapter.ts`) | MediaPipe BlazePose, browser camera |
| Motion | `depth_camera` | Reserved | Inherited from Motion Intelligence Core's existing `MotionCaptureSourceKind` |
| Motion | `phone_camera` | Reserved | Inherited from Motion Intelligence Core's existing `MotionCaptureSourceKind` |
| Motion | `imu_sensor` | Reserved | Not implemented this sprint |
| Motion | `reference_sensor` | Reserved | Not implemented this sprint |
| Motion | `xr_input` | Reserved | Not implemented this sprint |
| Physiological | `rasq_watch` | Reserved | ECG & vitals; `NormalizedPhysiologicalSample` not yet designed |
| Physiological | `emg_sensor` | Reserved | Not implemented this sprint |
| Physiological | `eeg_sensor` | Reserved | Not implemented this sprint |
| Kinetic | *(none yet)* | Reserved | Family name reserved only; Force Plate not classified into a source kind yet |

"Reserved" source kinds are valid members of their family's `InputAcquisitionSourceKind`
union so the vocabulary exists, but have **no registry entry** — calling
`getMotionAcquisitionAdapter("imu_sensor")` throws by design until a real adapter is
registered in a future sprint.

## Explicitly outside this layer

- **Speech AI** — audio → transcript is linguistic input feeding clinical
  documentation and the voice clinical assistant (`elevenlabs-server.ts`,
  `browser-speech-to-text.ts`, `voice-clinical-assistant.ts`,
  `/api/remote-assessments/[token]/transcribe`). It does not normalize into a motion
  frame or a physiological sample and does not feed a future Sensor Fusion Engine the
  way movement/physiological sensors do. It remains owned by the existing
  communication and clinical documentation pipeline.
- **Digital Twin** — classification deferred. Existing code
  (`assessment-delivery/adapters/web-camera-pose-adapter.ts` metadata) already lists
  `digital_twin` as a deferred input technology, but whether it is a synthetic input
  source or a rendered consumer of fused data has not been decided. No type in this
  layer references it yet.

## BlazePose adapter (this sprint's implementation)

`app/lib/input-acquisition/adapters/motion/blazepose-acquisition-adapter.ts` maps
MediaPipe BlazePose's 33-point landmark array — already flowing through every existing
CV detector via `PoseLandmarker.detectForVideo()` — onto `NormalizedMotionFrame`.

Design notes:

- BlazePose landmark index order matches Motion Intelligence Core's `JOINT_IDS` order
  exactly (standard MediaPipe Pose topology, indices 0–32); index `i` maps to
  `JOINT_IDS[i]`. This is not a coincidence — the core's joint vocabulary was already
  shaped to mirror BlazePose's topology before this sprint.
- `z` is deliberately omitted. BlazePose's `z` is uncalibrated relative depth;
  carrying it forward would imply a 3D reliability this source does not have.
  `coordinateSpace` is fixed to `"normalized_2d"`. A future source with calibrated
  depth (e.g. a Depth Camera adapter) can populate `z` and use `"normalized_3d"`.
- The present-visibility threshold (`0.2`) is reused from the existing
  `MIN_PRESENT_VISIBILITY` constant in `app/lib/cv/motion-quality-confidence.ts`
  rather than introducing a second threshold.
- The adapter is deliberately "dumb": it performs geometric/visibility mapping only
  and does not classify quality (high/medium/low). Two divergent, non-unified
  confidence models already exist in the repo — `motion-quality-confidence.ts`
  (group-based: shoulder/hip/knee/ankle) and `frame-validation.ts`'s
  `isJointConfident` (per-joint) — and picking a winner was out of scope for this
  sprint. This remains an open decision.
- Landmarks with non-finite `x`/`y`, or `x`/`y` outside `[0, 1]`, are omitted from
  the frame rather than included with invalid coordinates. BlazePose commonly
  reports coordinates slightly outside `[0, 1]` for landmarks near or beyond the
  frame edge (partially off-screen limbs) — real, expected output, not corrupted
  data — so the adapter screens for the same bound Motion Intelligence Core's own
  `isNormalizedCoord` enforces, not just finiteness. If no landmark survives
  normalization, the adapter returns `null` rather than an empty-but-technically-shaped
  frame.

This sprint does not wire the adapter into any detector, component, API route, or
database write. It is purely additive — no existing capture flow changes behavior.

## Registry

`app/lib/input-acquisition/registry.ts` holds a partial map of `MotionAcquisitionSourceKind
→ MotionAcquisitionAdapter`, mirroring the existing
`assessment-delivery/motion-input-registry.ts` lookup conventions
(`get`/`getOrNull`/`list`/`isRegistered`). Only `web_camera_pose` has an entry.

## Relationship to `MotionInputAdapterId` (assessment-delivery layer)

`app/lib/assessment-delivery/motion-input-registry.ts` already defines a similarly
named `MotionInputAdapterId` (`web_camera_pose | remote_questionnaire |
manual_clinician`). **These are not the same registry and must not be merged:**

| | `MotionInputAdapterId` (existing) | `MotionAcquisitionSourceKind` (this layer) |
|---|---|---|
| Question it answers | Which delivery flow / UI path is this assessment using? | Which raw sensor format is being normalized into a core type? |
| Produces | A metadata descriptor pointing at existing routes/components | An actual `NormalizedMotionFrame` (or future physiological sample) from real data |
| Values with no counterpart in the other | `remote_questionnaire`, `manual_clinician` (no sensor data to normalize) | `depth_camera`, `phone_camera`, `imu_sensor`, `reference_sensor`, `xr_input`, `rasq_watch`, `emg_sensor`, `eeg_sensor` (no delivery-flow equivalent) |

`web_camera_pose` happens to appear in both today; that overlap is not guaranteed to
hold as either registry grows (a single delivery mode could plausibly source frames
from more than one acquisition kind in the future).

## Implementation sequence

1. **This sprint** — Input Acquisition Layer contract, registry, and BlazePose as the
   first Motion-family adapter.
2. Shadow-mode wiring on Sit-to-Stand (repo's most mature CV path), consuming the
   registry lookup rather than a hardcoded call — proves the indirection against real
   pilot data without changing stored output.
3. First Shoulder Rehabilitation detector built on Motion Intelligence Core
   primitives, consuming the acquisition layer's output.
4. A second Motion-family adapter (candidate: Reference Sensor) to prove the contract
   holds for a non-camera source.
5. `NormalizedPhysiologicalSample` designed for real once RASQ Watch integration
   begins; `PhysiologicalAcquisitionAdapter` gets its first implementation.
6. Kinetic family designed for real once a Force Plate integration is scoped.
7. Sensor Fusion Engine — merges motion, physiological, and (eventually) kinetic
   streams by timestamp.

## Related documents

- [assessment-delivery-architecture.md](./assessment-delivery-architecture.md) —
  delivery contract and `MotionInputAdapterId`
- [architecture.md](./architecture.md) — repository and domain boundaries
- [decision-log.md](./decision-log.md) — permanent decisions
