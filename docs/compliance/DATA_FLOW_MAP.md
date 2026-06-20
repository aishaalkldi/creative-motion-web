# RASQ — Data Flow Map (Patient CV Path)

**Document type:** Technical data-flow reference for privacy review  
**Status:** PDPL Readiness Foundation — not legal certification  
**Last updated:** 2026-06-05  

This map documents the **optional patient camera assist** path for controlled pilots. The core workflow (assessment, plan, manual session completion) operates without this path.

---

## End-to-end flow

```
┌──────────┐    ┌──────────┐    ┌─────────────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────────┐
│ Patient  │───▶│  Camera  │───▶│ CV Processing   │───▶│ Metrics  │───▶│ Supabase │───▶│ Clinician       │
│ (portal) │    │ (device) │    │ (on-device)     │    │ (derived)│    │ (store)  │    │ Review          │
└──────────┘    └──────────┘    └─────────────────┘    └──────────┘    └──────────┘    └─────────────────┘
     │                │                  │                    │                │                  │
     │                │                  │                    │                │                  │
  Token auth      Browser getUserMedia   MediaPipe Pose     POST JSON only   cv_session_      Assessment Center
  Consent gate    No upload              Detectors            Token-scoped     metrics row      Patient profile
  Skip path       HTTPS required         Readiness/framing    Validation       motion_quality   Motion analysis
```

---

## Stage-by-stage detail

### 1. Patient (portal)

| Step | What happens | Data involved |
|------|--------------|---------------|
| Open magic link | `resolvePatientPortalAccess` validates token | Token → patient, plan, provider |
| Start guided session | Exercise step `active` | Prescribed exercise from plan |
| Consent gate (PR103) | Checkbox + Privacy/Terms before camera | Consent acknowledgment (client) |
| Skip camera | `Continue without camera` | No CV data created |
| Accept camera | Consent record created | `captureConsent` object (client + sessionStorage) |

**Stored at this stage:** Nothing new from CV until metrics save. Session logs may store pain/effort separately when session completes.

---

### 2. Camera (device)

| Step | What happens | Data involved |
|------|--------------|---------------|
| Browser permission | `getUserMedia` stream | Live video stream |
| Preview | Video element on screen | Ephemeral — device memory only |

| | |
|--|--|
| **Stored** | **Nothing** — no video file, no frame buffer upload |
| **Not stored** | Raw video, audio, screenshots |

---

### 3. CV processing (on-device)

| Component | Role | Persistence |
|-----------|------|-------------|
| MediaPipe Pose Landmarker | Per-frame landmarks | In-memory only |
| Exercise detector (e.g. `SitToStandDetector`) | Rep count, tracking quality, framing | In-memory snapshot |
| Setup readiness | Distance, lighting, stability checks | In-memory |
| STS motion timeline (pilot) | Phase snapshots, attempt summaries | In-memory until finalize |
| Capture quality assessor | Quality level, warnings, flags | Computed for save payload |

| | |
|--|--|
| **Stored** | **Nothing** during processing — landmarks never written to disk or network |
| **Not stored** | Landmark coordinates, hipY traces, pose images, video chunks |

---

### 4. Metrics (derived — client assembly)

On session stop / save, `useCvSessionCapture` assembles:

**Top-level POST body (`POST /api/patient/cv-session-metrics`):**

| Field | Example | Stored? |
|-------|---------|---------|
| `token` | Portal token | Used for auth — not stored in CV row |
| `sessionId` | Plan session UUID | Yes → `plan_session_id` |
| `exerciseId` | `sit-to-stand` | Yes |
| `repCount` | Integer | Yes |
| `sessionDurationS` | Integer ≥ 3 | Yes |
| `trackingQuality` | good/fair/poor/unknown | Yes |
| `movementDetected` | boolean | Yes |
| `framesWithPose` | integer | Yes |
| `framesTotal` | integer | Yes |
| `motion_quality` | JSONB object | Yes |

**`motion_quality` JSONB (when present):**

| Key | Contents | Stored? |
|-----|----------|---------|
| `captureConsent` | version, acceptedAtMs, surface | **Yes** |
| `smtPilot` (STS) | Pilot record: phase ratios, timings, visibility %, flags, capture quality | **Yes** (aggregates only) |
| Other pilot keys | `msPilot`, `hrPilot`, etc. | **Yes** (experimental exercises) |

**Validation before insert:**

- `bodyHasForbiddenCvKeys` — rejects video, landmarks, diagnosis, scores  
- `validateCvMotionQualityPayload` — shape-checks pilot records and consent  

| | |
|--|--|
| **Stored** | Derived scalars, enums, percentages, flags, consent metadata |
| **Not stored** | Video, images, landmark arrays, body coordinates, raw motion traces |

---

### 5. Supabase (store)

**Table:** `cv_session_metrics`

| Column | Source | Notes |
|--------|--------|-------|
| `provider_id`, `patient_id`, `plan_id`, `plan_session_id` | Resolved from token | Links row to care context |
| `exercise_id`, `rep_count`, `session_duration_s`, … | POST body | Derived metrics |
| `motion_quality` | POST JSONB | Consent + pilot evidence |
| `source` | `patient_session` | Distinguishes portal vs lab |
| `recorded_at` | Server timestamp | Audit timing |

**Access:** Row Level Security — treating clinician (`provider_id`) can SELECT/INSERT/UPDATE/DELETE own rows. Patient writes via service-role API after token validation.

**Related tables (non-CV):** `session_logs`, `plan_sessions` — session completion independent of CV.

---

### 6. Clinician review

| Surface | Data read | Presentation |
|---------|-----------|--------------|
| `/clinician/assessments/sit-to-stand` | `cv_session_metrics` via API | `CvReviewSummary`, motion analysis report |
| Patient profile — Movement tracking | Same metrics | Reps, duration, tracking signal, capture quality |
| `MotionAnalysisReportPanel` | `motion_quality.smtPilot` + columns | Therapist-review disclaimers, limitations |

| | |
|--|--|
| **Shown to clinician** | Derived metrics, capture quality, flags, phase summaries |
| **Not shown** | Video, landmarks, raw coordinates |
| **Not shown (gap)** | `captureConsent` details in UI (stored in DB only) |

---

## Summary matrix

| Data type | Processed | Stored |
|-----------|-----------|--------|
| Video / camera stream | Yes (device) | **No** |
| Raw pose landmarks | Yes (device) | **No** |
| Body coordinates / hipY series | Yes (device) | **No** |
| Rep count, duration | Yes | **Yes** |
| Tracking quality label | Yes | **Yes** |
| Movement detected flag | Yes | **Yes** |
| Frame counts (aggregate) | Yes | **Yes** |
| Capture quality level | Yes | **Yes** (in pilot record) |
| Phase ratios / timings (aggregated) | Yes | **Yes** (in pilot record) |
| Consent version + timestamp | Yes | **Yes** (`captureConsent`) |
| Pain / effort (session) | Yes (separate path) | **Yes** (`session_logs`) |
| Clinical diagnosis (platform-generated) | **No** | **No** |

---

## Alternate path: no camera

```
Patient → Manual exercise completion → session_logs / plan_sessions update → Clinician review
```

No `cv_session_metrics` row required. Pilot workflow remains valid.

---

## Related documents

- `docs/compliance/PDPL_FOUNDATION.md` — Inventory and principles  
- `docs/compliance/PILOT_PRIVACY_CHECKLIST.md` — Pre-pilot checks  
- `docs/pilot/sts-pilot-qa-validation.md` — STS technical QA  
