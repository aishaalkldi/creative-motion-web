# MQE-0 — Sit-to-Stand CV Data Audit

**Track:** MQE-0 (Movement Completion Analysis v0)  
**Status:** Documentation and audit only  
**Date:** 2026-05-30  
**Scope:** Rules-based movement **completion** layer — not biomechanics, ML, or clinical scoring

**Related docs:**

- `MQE-0-movement-completion-analysis.md` — concepts and clinician output model  
- `MQE-0-safety-language.md` — approved and forbidden language  

**RASQ impact:** None in MQE-0. No app, API, schema, or production CV logic changes.

---

## Audit purpose

Inventory what Sit-to-Stand CV and session data **exists today** in RASQ production so MQE-0 can be defined as a **therapist-in-the-loop completion layer** on top of stored derived metrics — without new capture, ML, or clinical scores.

---

## 1. Primary data store — `cv_session_metrics`

**Migration:** `supabase/migrations/008_cv_session_metrics.sql`  
**Write paths:**

| Route | Auth | Source value |
|-------|------|--------------|
| `POST /api/cv/session-metrics` | Clinician | `cv_lab` (default), `assessment_movement` |
| `POST /api/patient/cv-session-metrics` | Patient token | `patient_session` |

**Exercise allowlist (patient portal):** `sit-to-stand` only (`app/lib/cv/cv-patient-config.ts`).

### Fields persisted (production)

| Field (DB) | Public API (camelCase) | Type | Available now | Notes |
|------------|------------------------|------|---------------|-------|
| `id` | `id` | uuid | Yes | Row identifier |
| `provider_id` | — | uuid | Yes (server) | Not in public JSON |
| `patient_id` | `patientId` | uuid | Yes | Optional on CV Lab saves |
| `plan_id` | `planId` | uuid | Yes | Set on patient saves |
| `plan_session_id` | `planSessionId` | uuid | Yes | Links CV row to plan session |
| `exercise_id` | `exerciseId` | text | Yes | e.g. `sit-to-stand` |
| `rep_count` | `repCount` | int ≥ 0 | Yes | Legacy hip-Y stand-phase counter |
| `session_duration_s` | `sessionDurationS` | int ≥ 0 | Yes | Tracking window length |
| `tracking_quality` | `trackingQuality` | enum | Yes | `good` \| `fair` \| `poor` \| `unknown` |
| `movement_detected` | `movementDetected` | boolean | Yes | Any meaningful motion in session |
| `frames_with_pose` | `framesWithPose`* | int | **Stored, not shown in clinician UI** | *Returned by GET API; omitted from `CvSessionMetricPublic` type and `CvReviewSummary` |
| `frames_total` | `framesTotal`* | int | **Stored, not shown in clinician UI** | Same as above |
| `source` | `source` | enum | Yes | `cv_lab` \| `patient_session` \| `assessment_movement` |
| `prototype_version` | `prototypeVersion` | text | Yes | e.g. `cv-y1b-sit-to-stand`, `0.1` |
| `recorded_at` | `recordedAt` | timestamptz | Yes | CV save timestamp |

**Forbidden at API boundary** (`cv-forbidden-keys.ts`, clinician POST): video, landmarks, `movementQuality`, `score`, `diagnosis`, `recommendation`, ROM/symmetry/risk flags.

**Patient save constraints:** minimum `sessionDurationS` ≥ 3 s (`CV_MIN_SAVE_DURATION_S`).

---

## 2. How `tracking_quality` is derived (client-side, then saved)

| Stage | Module | Behavior |
|-------|--------|----------|
| Per-frame labels | `sit-to-stand-detector.ts` | Hip visibility sum → good/fair/poor counts |
| Session summary | `session-visibility-summary.ts` (MQ-SIGNAL-1B) | Median hip visibility + label percentages → single saved `trackingQuality` |
| Clinician display | `cv-metrics-display.ts` | Mapped to **“Good signal”**, **“Fair signal”**, **“Limited camera visibility”** — explicitly **not** movement quality |

---

## 3. Session completion — `session_logs` + `plan_sessions`

CV metrics are **optional**; session completion is independent (patient can finish without camera).

### `session_logs` (append-only)

| Field | Type | Available | MQE relevance |
|-------|------|-----------|---------------|
| `plan_session_id` | uuid | Yes | Join key to CV + plan |
| `effort_score` | 1–10 | Yes | Patient-reported; trend context |
| `pain_score` | 0–10 | Yes | Patient-reported; trend context |
| `exercises_completed` | int | Yes | Count of exercises marked done in portal (not CV reps) |
| `notes` | text | Yes | May include coach metadata (`session-coach-metadata.ts`) |
| `completed_at` | timestamptz | Yes | Session completion timestamp |
| `patient_token` | text | Yes | Correlation only |

### `plan_sessions`

| Field | Type | Available | MQE relevance |
|-------|------|-----------|---------------|
| `status` | text | Yes | `upcoming` \| `today` \| `completed` \| `skipped` |
| `completed_at` | timestamptz | Yes | Plan session completion time |
| `exercises` | jsonb | Yes | Prescribed list with `sets`, `reps`, `durationSec`, `exerciseId` |
| `session_number` | int | Yes | Adherence sequencing |

**Prescribed dose** lives in `plan_sessions.exercises[]` via `PrescribedExerciseV1` (`exercise-resolve.ts`) — e.g. sit-to-stand default sets/reps from library. **Not copied into `cv_session_metrics`.**

---

## 4. Clinician-facing display today

| Surface | Data shown | MQE-related |
|---------|------------|-------------|
| Patient profile — **Movement tracking sessions** | `CvReviewSummary` variant | Reps, duration, tracking signal, movement detected, recordedAt, source |
| Plan session rows | `deriveClinicianSessionCameraLine()` | “Camera used · reps: N · visibility: good/fair/limited” or “Manual completion · camera not saved” or “Not completed” |
| CV Lab | Same metric card pattern | Lab sessions; disclaimer on review-only |
| AI Clinician Summary v0 | `clinician-summary-input.ts` | Last CV rows: rep count, duration label, tracking visibility, movement detected — **no MQE labels yet** |

**Disclaimer copy in production:** `CV_CLINICIAN_DISCLAIMER`, `CV_CAMERA_VISIBILITY_HELPER`, `CV_REP_COUNT_FOOTER` — all stress therapist review, no clinical assessment.

---

## 5. Per-rep and completion-detail data — NOT in production persistence

### MQ-REP-1 `RepQualityFsm` (`app/lib/cv/rep-quality-fsm.ts`)

| Capability | Production status |
|------------|-------------------|
| Per-rep `RepCaptureRecord` (duration, flags, hipY samples) | **In-memory only** |
| Capture flags: `complete_rep`, `incomplete_stand`, `incomplete_return`, `too_fast`, `unclear_visibility` | **Shadow mode only** |
| `SessionMotionSummary` with `completedCycleCount`, `unclearRepCount` | **Not saved to DB** |
| `repQualityEnabled` + `repQualityShadowMode` on detector | **Disabled** in `PATIENT_STS_CONFIG` (tests confirm) |

**Conclusion:** Per-rep completion detail exists as **prototype code** but is **not available** to MQE-0 rules in production until explicitly enabled and persisted (future track — not MQE-0).

---

## 6. Derived values MQE can compute **without schema changes** (read-time rules)

Given joins: `cv_session_metrics` + `plan_sessions` + `session_logs` on `plan_session_id`:

| Derived signal | Inputs | Feasibility now |
|----------------|--------|-----------------|
| Session has CV save | `cv_session_metrics.plan_session_id` | Yes |
| Manual completion only | session completed, no CV row | Yes |
| Rep count vs prescribed `reps` | `rep_count` vs exercise jsonb | Yes (rules must handle string reps, sets) |
| Rough tempo | `session_duration_s / rep_count` | Yes if reps > 0 — **estimate only** |
| Low visibility session | `tracking_quality` in (`poor`, `unknown`) | Yes |
| Movement absent | `movement_detected === false` | Yes |
| Short tracking window | `session_duration_s` vs heuristic threshold | Yes (rule tuning needed) |
| Pain/effort at completion | `session_logs` same `plan_session_id` | Yes if log exists |
| Adherence over plan | count `session_logs` / `plan_sessions` completed | Yes (operational, not clinical) |

---

## 7. Data gaps for richer MQE (future — not MQE-0)

| Missing data | Impact | Suggested track |
|--------------|--------|-----------------|
| Per-rep timestamps / flags persisted | Cannot distinguish incomplete stand vs return in production | MQ-REP-2 + schema (deferred) |
| `frames_with_pose` / `frames_total` in clinician UI | Visibility confidence not shown despite storage | Small UI read-only (option B) |
| Explicit “patient stopped tracking early” event | Must infer from duration + reps | Client event or rule heuristic |
| Prescribed rep target denormalized on CV row | Requires join to plan jsonb each time | Accept join in v0 rules |
| Gold-standard validation dataset | Threshold calibration | Pilot / feasibility study |
| CV row without matching `session_log` | Orphan metrics possible if save fails after CV | Edge-case rule: “review suggested” |

---

## 8. Source inventory summary

### Available now (production)

- Reps (aggregate stand-phase count)  
- Duration (seconds)  
- Tracking visibility (`good` / `fair` / `poor` / `unknown`)  
- Movement detected (boolean)  
- Timestamps (`recorded_at`, `completed_at` on logs)  
- Session completed (`plan_sessions.status`, `session_logs`)  
- Pain / effort (patient-reported, session log)  
- Plan linkage (`plan_session_id`, `patient_id`, `plan_id`)  
- Prescribed sets/reps (plan session exercises jsonb)  
- Clinician-only display path (no patient MQE surface)

### Available in code only (not persisted)

- Per-rep capture records and capture flags (MQ-REP-1 shadow)  
- Session visibility label counts (used to compute saved quality, not stored)  
- Completed vs unclear cycle counts from FSM shadow

### Not available

- Biomechanical angles, ROM, symmetry  
- ML classifications  
- Clinical scores or progression grades  
- Patient-facing movement quality feedback  
- Automatic treatment plan mutation hooks  

---

## 9. Audit conclusion

**MQE-0 can be fully specified as documentation + read-time rules** over existing `cv_session_metrics`, `session_logs`, and `plan_sessions` — comparing rep counts and duration to prescribed dose, visibility, and completion status using **safe completion language** only.

**MQE-0 must not** turn on RepQuality shadow in production or persist new fields without a separate approved track.

---

## Document control

| Field | Value |
|-------|-------|
| RASQ code impact | **None** |
| Commit | **Not committed** until explicitly approved |
