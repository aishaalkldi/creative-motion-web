# RASQ Assessment Delivery Architecture

This document defines the shared delivery contract for Clinic Mode and Remote Mode. It is a **type and documentation contract only** — no registry, adapter wiring, UI changes, or database migrations are introduced here.

## Purpose

RASQ currently runs clinic and remote assessments through parallel flows. This contract establishes one shared spine so both modes can reuse:

- one patient model
- one assessment engine (`assessments` + `structured_data`)
- one exercise/session model (rehab plans + optional CV metrics)
- one reporting flow (`assessment-report-resolver`)
- different motion-input adapters (implemented in a later task)

## Delivery Spine

```
AssessmentDeliveryContext
        │
        ▼
┌───────────────────────────────────┐
│  Shared assessment engine         │
│  assessments · structured_data    │
│  assessment-report-resolver       │
└───────────────┬───────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
web_camera   remote_      manual_
_pose        questionnaire clinician
```

## Core Types

Defined in `app/lib/assessment-delivery/types.ts`:

| Type | Role |
|------|------|
| `AssessmentDeliveryContext` | Patient, assessment, mode, optional kind and motion-input source |
| `MotionInputAdapterId` | Registered motion-input source identifier |
| `MotionInputAdapterDescriptor` | Metadata map to an existing flow (no capture logic) |

`AssessmentMode` is reused from `app/lib/domain-types.ts`:

- `remote` — tokenized patient questionnaire and remote care paths
- `in_clinic` — clinician-led documentation and clinic capture surfaces

## Motion Input Sources (v0)

| ID | Existing flow | Primary modes |
|----|---------------|---------------|
| `web_camera_pose` | Clinician Assessment Center CV capture, optional patient portal CV | `in_clinic`, `remote` |
| `remote_questionnaire` | `/assessment/[token]` remote intake | `remote` |
| `manual_clinician` | General MSK forms, clinician workflow, in-clinic documentation | `in_clinic` |

### Mode compatibility matrix

| Motion input | `in_clinic` | `remote` |
|--------------|:-----------:|:--------:|
| `web_camera_pose` | Yes | Yes (patient portal CV under remote care) |
| `remote_questionnaire` | No | Yes |
| `manual_clinician` | Yes | No |

Compatibility is **declarative** in v0. Enforcement belongs to registry and UI tasks.

## Patient Model Preservation

`AssessmentDeliveryContext.patientId` is intentionally `string` to preserve both identity paths:

- **Supabase UUID patients** — production clinician and patient portal flows
- **Numeric demo patients** — legacy localStorage and therapy branches via `parseNumericDemoPatientId()`

No patient identity logic lives in this contract. Routing remains at existing API boundaries (`patient-id-utils`, `validate-patient-ownership`).

## Assessment and Reporting Boundaries

- **Measured values** remain separate from AI interpretation.
- **Motion input adapters** describe how movement or intake data enters the system; they do not interpret clinically.
- **Optional metadata** — `structured_data.motionInputSource` may record adapter provenance without a DB migration.
- Payloads without `motionInputSource` must continue to work unchanged.

## Explicitly Deferred

The following are **not** part of this contract and must not be implied by adapter IDs or metadata:

| Technology | Status |
|------------|--------|
| Depth-camera SDK | Deferred |
| IoT sensors | Deferred |
| Digital twin | Deferred |
| XR rehabilitation capture | Deferred (strategic domain only) |

v0 motion input is limited to browser web-camera pose, remote questionnaire, and manual clinician entry.

## Related Documents

- [architecture.md](./architecture.md) — repository and domain boundaries
- [decision-log.md](./decision-log.md) — permanent decisions
- [workflow.md](./workflow.md) — engineering workflow

## Implementation Sequence

1. **This contract** — types + documentation (current task)
2. **Motion input registry** — adapter registration and mode validation (separate task)
3. **Flow wiring** — optional provenance metadata and UI integration (future task)

Do not skip step 1 before implementing step 2.
