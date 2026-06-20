# RASQ — Gait Assessment v1 Capture Audit (PR109)

**Document type:** Code review and implementation planning — documentation only  
**Status:** Audit complete; **no code changes in this PR**  
**Last updated:** 2026-06-05  
**Baseline:** Gait Assessment shell live (`/clinician/assessments/gait`); STS reference CV path (PR100–104); PR107–108 exercise expansion plans

---

## Purpose

Determine the **safest minimal path** to make **Gait Assessment v1** actionable after the current clinician shell — without implementing gait CV in this PR.

**Scope:** Camera-assisted **walking observation** for therapist review. **Not** diagnostic gait analysis, pathology classification, or treatment automation.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Can Gait v1 use the existing MediaPipe / RASQ CV architecture? | **Yes — for a bounded walking observation pass**, not open-room ambulation |
| Is gait capture ready to build today? | **No** — no gait detector, exercise ID, pilot record, or assessment capture UI exists in `app/lib/cv` |
| Safest path to “actionable”? | **Phased:** (1) review surface wired like STS, (2) bounded timed walking capture, (3) optional step estimate with confidence gating |
| Build before internal STS testing? | **No** — complete STS reference validation first |

**Do not integrate** the legacy `app/gait/` video-upload stack or `creative-motion-gait-ai` API — those surfaces use classification, clinical flags, symmetry scoring, and treatment recommendations outside RASQ safety boundaries.

---

## Minimal Gait v1 scope (recommended)

Metrics aligned with the existing shell (`PLANNED_GAIT_METRICS`) and user constraints:

| Metric | v1 include | Notes |
|--------|------------|-------|
| **Walking duration** | **Yes** | Wall-clock tracked walking time (`session_duration_s`) |
| **Movement detected** | **Yes** | Boolean — sustained lower-limb motion during pass |
| **Tracking quality** | **Yes** | Session rollup: good / fair / poor / unknown |
| **Left/right visibility** | **Yes, if feasible** | Per-side hip/knee/ankle visibility % from landmarks (in-memory only) |
| **Step/cycle estimate** | **Conditional** | Only when tracking confidence ≥ fair and bilateral visibility sustained; otherwise omit or flag `step_estimate_low_confidence` |
| **Retest recommendation** | **Yes** | Reuse `capture-quality.ts` session scoring + `capture_setup_limited` |
| **Therapist review required** | **Yes** | Fixed banner + `reviewRequired: true` on pilot record |

### Explicitly out of Gait v1

| Excluded | Reason |
|----------|--------|
| Gait speed (m/s), cadence norms, 6MWT distance | Implies clinical norm comparison |
| Symmetry score, pathology flags, “classification” | Diagnosis-adjacent; forbidden in `cv_session_metrics` POST |
| Fall risk, injury risk, Trendelenburg, foot drop | User constraint + product boundary |
| Parkinsonian / neurological gait labels | User constraint |
| Pace consistency (shell lists it) | **Defer to v1.1** — needs calibrated cycle timing; not required for minimal actionable v1 |
| Video upload / server-side gait AI | Legacy stack; separate product surface |
| Open-ended room walking / path analysis | Fails RASQ “bounded repeatable” criterion |

### Recommended capture geometry (v1)

**Bounded walking observation pass** — one of:

1. **Short in-place walk / march** (10–30 s) — camera fixed, sagittal or slight angle; patient stays in frame. *Lowest risk; closest to existing rep-detector patterns.*
2. **Short forward pass** (walk toward camera, 5–10 steps) — higher framing risk; require strict retest when body exits frame.

**Not v1:** 10-metre walk test, TUG with turn analysis, treadmill, backward walking.

---

## Current code inventory

### A. RASQ Assessment Center (in scope)

| Asset | Path | State |
|-------|------|-------|
| Assessment Center hub | `app/clinician/assessments/page.tsx` | Live — Gait card links to shell |
| Gait Assessment shell | `app/clinician/assessments/gait/page.tsx` | Live — planned metrics UI only; no data fetch |
| STS Assessment review (reference) | `app/clinician/assessments/sit-to-stand/page.tsx` | Live — fetches `/api/cv/session-metrics`, filters `sit-to-stand`, uses `CvReviewSummary` |

### B. RASQ CV patient stack (partial reuse)

| Asset | Path | Gait relevance |
|-------|------|----------------|
| Patient CV allowlist | `app/lib/cv/cv-patient-config.ts` | **No gait ID** — 7 Sports Knee exercises only |
| `PatientCvExerciseId` | `app/lib/cv/bio-0-contracts.ts` | **No gait** — patient POST blocked without allowlist change |
| `PatientCvCapture` | `app/components/patient/cv/PatientCvCapture.tsx` | Factory for allowlisted exercises only |
| Capture readiness | `app/lib/cv/patient-cv-capture-readiness.ts` | Reusable pattern; no walking-specific checks |
| Capture quality | `app/lib/cv/capture-quality.ts` | **Reusable** — `assessCaptureQualityFromLandmarks` + `assessCaptureQualityFromSession` |
| Body framing profiles | `app/lib/cv/body-framing-profiles.ts` | **No walking profile** — only `seated-rise`, `standing-sagittal-rep` |
| Motion pilot records | `sts-motion-pilot-record.ts`, `heel-raise-motion-pilot-record.ts`, etc. | Template for new `gaitPilot` — **none exists** |
| Clinician review | `CvReviewSummary.tsx`, `MotionAnalysisReportPanel.tsx` | Exercise-agnostic when metrics exist; gait-specific parse **missing** |
| PR103 consent | `patient-cv-consent.ts` | Reusable for any new capture surface |

### C. Session metrics API

| Endpoint | Path | Gait relevance |
|----------|------|----------------|
| Clinician POST/GET | `app/api/cv/session-metrics/route.ts` | Accepts **any** `exerciseId` string; sources include `assessment_movement` |
| Patient POST | `app/api/patient/cv-session-metrics/route.ts` | **Allowlist enforced** — gait would be rejected today |
| Forbidden POST keys | `session-metrics/route.ts` | Blocks `diagnosis`, `symmetryScore`, `riskFlag`, `landmarks`, `video`, etc. |
| Storage | `cv_session_metrics` table | `exercise_id`, `motion_quality` JSONB — **no migration needed** for new exercise ID |

**Implication:** Gait v1 should initially use **`source: assessment_movement`** via an **assessment capture flow** (clinician-supervised or assessment token), not patient-portal plan exercise sessions — unless allowlist is deliberately extended later.

### D. Legacy / isolated gait code (out of scope for RASQ v1)

| Asset | Path | Why not reuse |
|-------|------|---------------|
| Gait video upload UI | `app/gait/page.tsx` | 10MWT video → external AI; classification + recommendations |
| Gait AI API client | `app/lib/api/gait.ts` | `GaitSummary.classification`, `flags`, `recommendations`; symmetry/trunk scores |
| Gait AI rewrite | `next.config.ts` → `/api/gait/*` | Separate FastAPI service |
| Therapy gait session | `app/therapy/components/GaitTherapySession.tsx` | **March-in-place gamification** — isolated `/therapy` route; localStorage persistence |
| Therapy pose camera | `app/therapy/components/PoseCamera.tsx` | Knee-lift step detection for marching — **not forward walking** |
| Therapy biomechanics | `app/therapy/lib/gait/biomechanics.ts` | ROM/posture/symmetry **scores** — decision-support language incompatible with RASQ v1 minimal scope |
| Gait training program lib | `app/therapy/lib/gait/*` | Program progression — not Assessment Center capture |

### E. CV detectors in `app/lib/cv` (no gait)

| Detector | Exercise | Locomotion? |
|----------|----------|-------------|
| `sit-to-stand-detector` | STS | No — vertical rise |
| `heel-raise-detector` | Heel raise | No — ankle Y rise |
| `mini-squat-detector` | Mini squat | No |
| `step-up-detector` | Step up | No |
| `lateral-step-detector` | Lateral step | Lateral, not walking |
| `functional-reach-detector` | Functional reach | No |
| `single-leg-stance-detector` | SLS | Hold, not walk |

**No `gait-walk-detector`, `locomotion-engine`, or `march-in-place` detector in RASQ CV lib.**

### F. Documentation cross-references

| Doc | Gait position |
|-----|---------------|
| `docs/cv/CV_EXERCISE_ALLOWLIST_PLAN.md` | **Defer** full gait capture (6MWT, TUG, path analysis) |
| `docs/cv-roadmap/RASQ-motion-trackable-rehab-framework.md` | Walking tolerance **explicitly not on CV roadmap**; open ambulation fails “repeatable” criterion |
| `docs/cv/HEEL_RAISE_CV_HARDENING_PLAN.md` | Heel raise P1 is next CV expansion after STS |

---

## What exists (summary)

| Capability | Status |
|------------|--------|
| Clinician Gait Assessment shell page | ✅ Live |
| Assessment Center navigation | ✅ Live |
| STS review pattern (fetch metrics + `CvReviewSummary`) | ✅ Reusable template |
| MediaPipe pose shell (STS / heel raise) | ✅ Reusable init/camera/stream pattern |
| Capture quality scoring module | ✅ Reusable |
| Consent gate (PR103) | ✅ Reusable |
| `cv_session_metrics` + `motion_quality` JSONB | ✅ No migration needed |
| `assessment_movement` source on clinician API | ✅ Defined |
| Gait-specific exercise ID / detector / pilot record | ❌ Missing |
| Gait capture UI (patient or assessment) | ❌ Missing |
| Walking body framing profile | ❌ Missing |
| Gait review page data wiring | ❌ Missing (shell only) |
| Manual gait smoke QA doc | ❌ Missing |

---

## What is missing

### P0 — Required for minimal actionable Gait v1

| # | Component | Description |
|---|-----------|-------------|
| 1 | **`gait-walking-observation` exercise ID** | New ID for Assessment Center (not necessarily patient allowlist v1) |
| 2 | **`GaitWalkPoseDetector`** (or bounded-walk detector) | MediaPipe shell + movement/duration/visibility engine |
| 3 | **`gaitPilot` motion record** | Safe JSONB shape: duration, movementDetected, trackingSignal, visibility L/R, optional stepEstimate + confidence flag, captureQuality, reviewRequired |
| 4 | **Assessment capture surface** | Clinician-facilitated or token-based capture page — **not** legacy `/gait` upload |
| 5 | **Gait review page wiring** | Mirror STS: GET `/api/cv/session-metrics`, filter by gait exercise ID, `CvReviewSummary` |
| 6 | **Walking framing profile** | Full-body in frame; bilateral lower limbs; fixed camera |
| 7 | **Patient/clinician copy** | Therapist-review-only; no gait pattern labels |
| 8 | **Manual smoke checklist** | `docs/pilot/gait-assessment-v1-qa-validation.md` |

### P1 — Should have for reliability

| # | Component | Description |
|---|-----------|-------------|
| 9 | **In-memory gait timeline** (`gait-1`) | 1 Hz snapshots for visibility L/R and optional cycle events |
| 10 | **`motion-analysis-report` gait parse** | `gaitPilot` + `captureQuality` in clinician panel |
| 11 | **`validateCvMotionQualityPayload` gait branch** | Schema validation for `gaitPilot` |
| 12 | **Step estimate confidence gate** | Suppress or flag when tracking poor or pose loss high |

### P2 — Defer

| # | Component | Reason |
|---|-----------|--------|
| 13 | Patient portal allowlist entry | Assessment-first is safer |
| 14 | Pace consistency metric | Shell placeholder; not minimal v1 |
| 15 | 6MWT / TUG / turn detection | PR107 defer |
| 16 | Port therapy `PoseCamera` step logic | Scores incompatible; marching ≠ assessment walking |

---

## MediaPipe pipeline feasibility

| Capability | Feasible? | Confidence | Notes |
|------------|-----------|------------|-------|
| Walking duration | Yes | High | Session timer + pose-present gate |
| Movement detected | Yes | High | Hip/knee displacement or alternating flexion |
| Tracking quality | Yes | High | Reuse `session-visibility-summary` pattern |
| Left/right visibility | Yes | Medium–high | Per-landmark visibility sampling each tick |
| Step/cycle estimate (bounded pass) | Partial | Medium | Alternating knee events work for **in-place** walk; forward walk adds occlusion/frame-exit risk |
| Retest recommendation | Yes | High | Reuse `capture-quality.ts` |
| Side-view 10 m gait speed | No (v1) | — | Legacy gait AI territory; normative speed excluded |

**Architecture conclusion:** MediaPipe **can support** minimal Gait v1 as **bounded walking observation** using the same on-device-only, derived-metrics-only contract as STS. It **cannot** safely support diagnostic gait analysis or unconstrained room walking without new risk controls.

---

## Capture quality layer reuse

| Function | Reuse for gait? |
|----------|-----------------|
| `assessCaptureQualityFromLandmarks` | **Yes** — setup preview; extend warnings for “full body not visible during walk” |
| `assessCaptureQualityFromSession` | **Yes** — feed gait timeline visibility ratios + pose loss count |
| `CAPTURE_SETUP_LIMITED_FLAG` | **Yes** — shared readiness pattern |
| `CaptureQualitySection` (clinician) | **Yes** — once `gaitPilot.captureQuality` persisted |
| STS landmark coverage (`sts-landmark-coverage.ts`) | **Partial** — template for `gait-visibility-coverage.ts` (bilateral ankles required for step estimate) |

**New gait-specific QC needs:** frame-exit detection (body bbox leaves margins), walking-pass-too-short, single-side visibility collapse.

---

## Recommended implementation phases

### Phase 0 — Make shell actionable without capture (PR110 docs + small UI)

**Goal:** Clinician page does something useful today.

- Wire `app/clinician/assessments/gait/page.tsx` like STS review: fetch metrics, filter `exercise_id === 'gait-walking-observation'`, show `CvReviewSummary` or empty state.
- Keep “Start capture” as disabled / “Coming in next release” until Phase 1.
- **No detector.** Zero CV risk.

### Phase 1 — Bounded walking capture foundation (PR111–112)

**Goal:** First saved assessment movement sessions.

| Slice | Deliverable |
|-------|-------------|
| **PR111a** | `gait-walking-observation` contracts + `gaitPilot` record + payload validation |
| **PR111b** | `GaitWalkPoseDetector` — duration, movementDetected, trackingQuality, L/R visibility |
| **PR111c** | Assessment capture UI (consent + readiness + timed pass) |
| **PR111d** | POST `assessment_movement` via clinician API or secured assessment route |
| **PR111e** | `captureQuality` on `gaitPilot` + clinician report parse |

### Phase 2 — Conditional step estimate (PR113)

- Add cycle detection only when confidence gate passes.
- `stepEstimate` + `stepEstimateConfidence: 'high' | 'low' | 'omitted'`.
- Never surface step count to patient as “correct steps.”

### Phase 3 — Pilot validation (PR114 docs)

- Manual smoke doc + 2-device pass.
- Controlled gait assessment pilot plan (mirror PR106 STS pattern).

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Integrating legacy gait AI API | **Critical** | Explicitly out of scope; classification/recommendations forbidden |
| Patient exits camera frame while walking | High | Bounded pass + frame-exit flag + retest |
| Step count false precision | High | Confidence gate; omit when fair/poor tracking |
| Neurological/diagnosis wording drift | High | Copy audit; forbidden terms list |
| Building before STS workflow proven | High | Gate on STS internal smoke + controlled pilot go |
| Confusion with `/therapy` marching | Medium | Separate routes; assessment vs gamified rehab |
| `symmetryScore` in therapy biomechanics ported by mistake | High | Do not port therapy scores into RASQ gait v1 |
| Patient portal allowlist too early | Medium | Assessment `assessment_movement` source first |

---

## Gait v1 before or after internal STS testing?

### Recommendation: **After internal STS testing**

| Order | Work | Rationale |
|-------|------|-----------|
| 1 | STS manual smoke + controlled pilot (PR104 / PR106) | Validates consent, capture quality, clinician review, save path |
| 2 | Heel Raise hardening (PR109 implementation per PR108) | Proves second-exercise expansion pattern at lower risk |
| 3 | Gait Phase 0 — wire review surface | Actionable shell with empty/live states; no CV |
| 4 | Gait Phase 1 — bounded capture | New locomotion engine only after rep-exercise playbook is stable |

**Gait v1 should not be built before internal STS testing** because:

1. STS is the **reference architecture** for capture quality, consent, pilot records, and clinician panels.
2. Walking observation is **higher ambiguity** than sagittal rep exercises (frame exit, occlusion, cycle confidence).
3. PR107 and the motion-trackable framework **explicitly defer** open ambulation.
4. Legacy gait code paths create **classification/treatment recommendation** risk if merged hastily.

**Exception:** Phase 0 (review wiring only) can ship **in parallel with late STS testing** — it has no capture risk and makes the shell actionable with an empty state.

---

## PR110+ recommendation (next after this audit)

| PR | Title | Type |
|----|-------|------|
| **PR110** | Gait Assessment review surface wiring | Small UI — fetch metrics, empty state, no capture |
| **PR111** | Gait walking observation capture foundation | Code — detector + gaitPilot + assessment capture |
| **PR112** | Gait assessment v1 QA validation | Docs — manual smoke |

**Alternative priority:** If product insists on Assessment Center breadth over CV expansion, **PR110** (review wiring) unblocks demos immediately; defer **PR111** until STS go.

---

## Safety wording (Gait v1)

**May say**

- Camera-assisted walking observation for therapist review.
- Walking duration, movement detected, tracking signal.
- Left/right visibility assist (when both sides were observable).
- Estimated step/cycle count **only** with confidence caveat.

**Must not say**

- Normal/abnormal gait, pathology, neurological syndromes.
- Fall risk, injury risk, Trendelenburg, foot drop.
- Gait speed norms, clinical classification, treatment recommendations.
- “Good walking form” or diagnostic labels.

---

## Related documents

- `app/clinician/assessments/gait/page.tsx` — current shell
- `app/clinician/assessments/sit-to-stand/page.tsx` — review pattern to mirror
- `docs/cv/CV_EXERCISE_ALLOWLIST_PLAN.md` — gait defer rationale
- `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md` — sequencing gate
- `docs/cv/HEEL_RAISE_CV_HARDENING_PLAN.md` — P1 CV expansion before gait capture

---

## Document history

| Date | PR | Change |
|------|-----|--------|
| 2026-06-05 | PR109 | Initial gait capture audit (docs only) |
