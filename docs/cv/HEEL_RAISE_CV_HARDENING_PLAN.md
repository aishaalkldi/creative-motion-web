# RASQ — Heel Raise CV Hardening Plan (PR108)

**Document type:** Gap analysis and implementation planning — documentation only  
**Status:** Assessment complete; **no code changes in this PR**  
**Last updated:** 2026-06-05  
**Baseline:** PR107 allowlist plan; STS reference path (PR100–104); heel-raise motion pilot wired (`hrm-1`)

---

## Purpose

Determine whether **Heel Raise** (`heel-raise`) can safely reach **STS-level quality and reliability** using the **existing CV architecture**, and define what hardening work is required before promoting it as the second supported camera-assisted exercise.

**Scope:** Therapist-review-only derived movement observations. **Not** clinical validation, diagnosis, treatment recommendations, or heel-height / strength scoring.

**Gate:** Controlled STS pilot go decision per `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md` before patient-facing promotion.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Can heel raise reach STS-level quality with existing architecture? | **Yes — with targeted hardening, not a new CV stack** |
| Is it ready to promote today? | **No** — capture quality and ankle visibility gaps remain |
| Safe to implement incrementally? | **Yes** — same `PatientCvCapture` factory, consent, readiness, timeline, and `hrPilot` patterns as STS |

Heel raise already has a **complete vertical slice**: dedicated detector (`HeelRaisePoseDetector`), rep engine (`HeelRaiseDetector`), phase classifier, in-memory timeline (`hrm-1`), persisted `hrPilot` record, clinician motion analysis report, and patient EN/AR copy. The gaps are **parity features** STS gained in PR100–101 (capture quality scoring, landmark-coverage readiness, clinician quality panel) plus **pilot validation** (manual smoke, copy de-experimentalization).

---

## Readiness score

**Current promotion readiness: 68 / 100**  
**Architectural feasibility to reach STS parity: 85 / 100**

| Area | Score | Notes |
|------|-------|-------|
| Rep detector & rep engine | 78 | Solid unit tests; bilateral double heel raise only; ankle-rise polarity on mid-Y |
| Patient capture wiring | 75 | `PatientCvCapture` uses `HeelRaisePoseDetector`; timeline + save path wired |
| Readiness path | 70 | `feet_visible` + `correct_distance` required; shared 3s stability gate; no ankle coverage module |
| Capture quality integration | 35 | `assessCaptureQualityFromSession` only wired to `smtPilot`; `hrPilot` lacks `captureQuality` |
| Motion pilot record (`hrPilot`) | 72 | Phase ratios, rep timings, clinician flags, forbidden-key guards; visibility uses tracking proxy |
| Clinician review compatibility | 65 | Report renders `hrPilot`; `CaptureQualitySection` only populated for STS |
| Patient setup & copy | 70 | Sagittal ~45° instructions; wizard `show_feet_ankles` state; copy still says **experimental** |
| Framing requirements | 60 | `STANDING_SAGITTAL_REP_FRAMING_PROFILE`; strict `move_back` (no STS-style coverage override) |
| QA & pilot validation | 25 | No heel-raise manual smoke doc (STS has PR104) |
| Safety & compliance framing | 85 | PR103 consent shared; no video/landmarks persisted; therapist-review disclaimers present |

**Interpretation:** Engineering foundation is **strong enough** to harden in place. Promotion blockers are **measurement transparency** (capture quality), **ankle visibility confidence** (landmark coverage), and **operational proof** (device smoke), not architectural rework.

---

## Gap analysis

### 1. Detector implementation

**Current state**

| Component | Location | Maturity |
|-----------|----------|----------|
| Lab / unit-test detector | `app/lib/cv/heel-raise-detector.ts` | Mature — rise polarity on ankle mid-Y |
| Patient pose shell | `app/lib/cv/heel-raise-pose-detector.ts` | Wired — MediaPipe shell reuses STS helpers |
| Patient rep config | `PATIENT_HEEL_RAISE_REP_CONFIG` in `cv-patient-config.ts` | Tuned separately from lab defaults |
| Phase classifier | `app/lib/cv/heel-raise-phase-classifier.ts` | Report-layer; 14 unit tests |
| Stand phase mapping | `app/lib/cv/heel-raise-stand-phase.ts` | Maps rep phase → standPhase edges |

**Strengths**

- Rep counting uses shared `sagittal-hip-rep-core` with **rise polarity** (heels up = lower ankle Y).
- `canSaveMetrics()` enforces min duration, movement detected, rep count > 0.
- Bilateral ankle visibility gate (`minAnkleVisibility: 0.28`) before frame counting.
- `heel-raise-detector.test.ts` covers debounce, insufficient rise, baseline calibration, session visibility.

**Gaps vs STS**

| Gap | Impact |
|-----|--------|
| **Bilateral only** — no single-leg heel raise variant | Prescription mismatch if plan assigns single-limb raises |
| **No heel-height metric** (by design) | Correct — but patient copy must stay explicit |
| **Rep thresholds untuned on real devices** | False negatives/positives possible on home lighting and floor angles |
| **Pose detector integration tests minimal** | `heel-raise-pose-detector.test.ts` has 3 tests vs deeper STS coverage |

### 2. Readiness path

**Current state**

- `requiredReadinessChecksForExercise("heel-raise")` → body, lower joints, **feet**, **distance**, lighting, **tracking_stable** (3s).
- `PATIENT_HEEL_RAISE_READINESS_MS = 2_000` before rep engine starts.
- `shouldFlagCaptureSetupLimited` and `capture_setup_limited` clinician flag shared via `PatientCvCapture`.
- `patient-cv-capture-readiness.test.ts` confirms heel-raise **strict** `correct_distance` on `move_back` (no STS override).

**Gaps vs STS**

| Gap | STS has | Heel raise |
|-----|---------|------------|
| Landmark coverage readiness | `sts-landmark-coverage.ts` + `stsLandmarkCoverageReady` | **Missing** — ankles critical but no dedicated coverage scorer |
| Adaptive framing on `move_back` | Coverage-ready override allows start | **Strict** — patient must step back even when ankles visible |
| Ankle-specific readiness signal | Shoulders/hips/knees scored; ankles bonus | Feet check inferred from poseReadiness + framing only |

### 3. Capture quality integration

**Current state**

- Shared module: `app/lib/cv/capture-quality.ts` (`assessCaptureQualityFromLandmarks`, `assessCaptureQualityFromSession`).
- STS persists `captureQuality` inside `smtPilot` via `buildStsMotionPilotRecord`.
- `motion-analysis-report.ts` parses `captureQuality` **only** when `exerciseId === "sit-to-stand"`.
- `CaptureQualitySection` in clinician UI shows quality badge, retest recommendation, warnings.

**Gaps**

| Gap | Detail |
|-----|--------|
| **`hrPilot` has no `captureQuality` field** | `HeelRaiseMotionPilotRecord` allowed keys omit capture quality |
| **Clinician panel empty for heel raise** | `report.captureQuality` is always `null` for heel-raise sessions |
| **Limited retest UX not exercise-branded** | Patient amber path exists via flags but without persisted quality object for therapist |

### 4. Motion pilot record integration

**Current state**

- Timeline: `heel-raise-motion-timeline.ts` — 1 Hz in-memory snapshots → `HeelRaiseSessionMotionSummary`.
- Pilot record: `heel-raise-motion-pilot-record.ts` — `hrm-1`, `buildHeelRaiseMotionPilotRecordFromSummary`.
- Save path: `PatientCvCapture.buildHeelRaisePilotMotionQuality()` → `motion_quality.hrPilot`.
- Validation: `cv-motion-quality-payload.ts` validates `hrPilot` shape.
- Wiring test: `patient-cv-heel-raise-wiring.test.ts` — end-to-end summary → record.

**Strengths**

- Forbidden payload keys guarded.
- `reviewRequired: true`, safe disclaimer string.
- Clinician flags: unclear reps, phase detection, pose interruption.

**Gaps**

| Gap | Detail |
|-----|--------|
| **Visibility ratios are proxies** | `heelRaiseVisibilityFromCaptureSnapshot` maps tracking quality → scalar; hip/knee/ankle get same value — not landmark-based |
| **Rep timings estimated when sparse** | `HEEL_RAISE_CYCLE_TIMING_ESTIMATED_NOTE` when synthesized |
| **No capture quality block** | See §3 |

### 5. Clinician review compatibility

**Current state**

- `motion-analysis-report.ts` parses / synthesizes `hrPilot` for `exerciseId === "heel-raise"`.
- `MotionAnalysisReportPanel` shows capture evidence from any motion pilot (`hrPilot` included).
- `heel-raise-biomechanical-contribution-review.ts` and `heel-raise-movement-quality-signals.ts` provide review-layer signals.
- `cv-evidence-integrity-gate` applies to heel raise sessions.

**Gaps**

| Gap | Detail |
|-----|--------|
| **`isStsPolishedReport` is STS-only** | Heel raise does not get polished timing labels / cycle metric naming |
| **No `CaptureQualitySection` data** | Therapist cannot see high/medium/low quality badge for heel raise |
| **Synthesized pilot fallback** | Sessions without timeline still get estimated `hrPilot` — must remain clearly labeled |

### 6. Patient setup instructions

**Current state**

- Copy: `PATIENT_HEEL_RAISE_CV_COPY` in `bio-0-contracts.ts` (EN/AR).
- Key strings: ~45° angle, both ankles visible, stand still for baseline, rise onto both toes slowly.
- Camera wizard: `camera-setup-wizard.ts` — `show_feet_ankles` state for heel-raise.
- Prototype version: `cv-y4-heel-raise`.

**Gaps**

| Gap | Detail |
|-----|--------|
| **"Experimental" in `optionalCameraNote`** | Conflicts with P1 promotion messaging after STS pilot |
| **No dedicated pilot smoke checklist** | STS has `docs/pilot/sts-pilot-qa-validation.md` |
| **Support surface hint present** | Good — wall/chair support copy included |

### 7. Framing requirements

**Current state**

- Profile: `STANDING_SAGITTAL_REP_FRAMING_PROFILE` (shared with other standing rep exercises).
- Body framing overlay drawn in `HeelRaisePoseDetector` detect loop.
- Camera wizard maps `adjust_camera_angle` → `show_feet_ankles` for heel-raise.

**Gaps vs STS (PR101)**

| Requirement (PR107 plan) | Status |
|--------------------------|--------|
| Sagittal; feet and ankles in frame | Partial — framing profile generic, not ankle-weighted |
| Hips, knees, ankles landmarks | Detector uses ankles; readiness does not score ankles independently |
| Feet-visible readiness checks | Present via `feet_visible` check |
| Reuse shared capture quality pattern | **Not wired to hrPilot** |

**Recommended framing spec (unchanged from PR107)**

- Phone at hip height, 2–3 m, slight angle (~45°) so **both ankles** remain visible during rise.
- Full lower body preferred; chair/wall nearby for support per plan.
- Flat, consistent floor surface; avoid toe-only crop at bottom of frame.

---

## Required changes (for PR109+)

Prioritized by promotion impact. **No DB migration. No AI. No diagnosis wording.**

### P0 — Must have before pilot promotion

| # | Change | Rationale |
|---|--------|-----------|
| 1 | Add `captureQuality` to `hrPilot` build path (mirror STS `assessCaptureQualityFromSession`) | Clinician retest guidance and limited-capture transparency |
| 2 | Parse `hrPilot.captureQuality` in `motion-analysis-report.ts` | Populate `CaptureQualitySection` for heel raise |
| 3 | Ankle landmark coverage readiness module (PR101 analogue) | Feet are primary signal; generic framing insufficient |
| 4 | Manual smoke QA doc (`docs/pilot/heel-raise-pilot-qa-validation.md`) | Operational proof before clinic expansion |
| 5 | Patient copy audit — remove "experimental" when promoted; keep therapist-review-only | Align messaging with P1 allowlist |

### P1 — Should have for STS parity

| # | Change | Rationale |
|---|--------|-----------|
| 6 | Landmark-based visibility in timeline (replace tracking scalar proxy) | Accurate `visibilityRatios.ankle` for clinician review |
| 7 | Adaptive framing when ankle coverage strong (optional `move_back` override) | Reduce false setup blocks in small rooms |
| 8 | Expand `heel-raise-pose-detector` integration tests | Catch readiness → rep engine handoff regressions |
| 9 | Rep threshold tuning from smoke results | Reduce false rep counts on real devices |

### P2 — Defer

| # | Change | Rationale |
|---|--------|-----------|
| 10 | Single-leg heel raise detector variant | Out of P1 scope; prescription edge case |
| 11 | `isHeelRaisePolishedReport` clinician UX | Nice-to-have; not blocking pilot |
| 12 | Assessment Center heel-raise card | Separate product PR |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **False rep counts** when ankles occluded during rise | High | Ankle coverage module + capture quality low → retest |
| **Promoting while copy says "experimental"** | Medium | Copy audit in P0 |
| **Clinician over-trust without capture quality panel** | High | Wire `captureQuality` before promotion |
| **Visibility ratios misleading** (proxy scalar) | Medium | Landmark-based visibility in P1 |
| **STS pilot not complete — premature expansion** | High | Enforce PR106 go gate |
| **Single-leg prescriptions** | Low | Document bilateral-only limit; manual count fallback |
| **Synthesized `hrPilot` on save failures** | Medium | Keep `hrPilotEvidenceMode` labels in clinician UI |
| **No heel-height claim drift** | Medium | Copy review + forbidden payload keys (existing) |

---

## Test plan

### Unit / automated (existing + PR109)

| Suite | Current | PR109 target |
|-------|---------|--------------|
| `heel-raise-detector.test.ts` | Pass | Maintain; add smoke-derived threshold cases |
| `heel-raise-phase-classifier.test.ts` | Pass | Maintain |
| `patient-cv-heel-raise-wiring.test.ts` | Pass | Add capture quality on `hrPilot` |
| `patient-cv-capture-readiness.test.ts` | Heel-raise cases | Add ankle coverage scenarios |
| `capture-quality.test.ts` | STS-oriented | Add heel-raise session fixtures |
| `motion-analysis-report.test.ts` | hrPilot cases | Add `captureQuality` parse for heel raise |
| `cv-motion-quality-payload.test.ts` | hrPilot validation | Extend if schema adds `captureQuality` |

### Manual smoke (required before promotion)

Create checklist in `docs/pilot/heel-raise-pilot-qa-validation.md` (PR109 doc slice):

1. **Setup** — HTTPS patient session; consent gate; camera wizard reaches ready with both ankles visible.
2. **Readiness** — 3s stable tracking; feet + distance checks pass; baseline stand-still hint shown.
3. **Rep counting** — 5 slow double heel raises; rep count increments; no false reps at rest.
4. **Limited capture** — Start before stable tracking; `capture_setup_limited` flag present; amber patient message.
5. **Save** — `hrPilot` persisted; `captureConsent` present; no forbidden keys.
6. **Clinician review** — Profile/session report shows reps, tracking signal, phase ratios, **capture quality** (after PR109).
7. **Fallback** — Continue without camera completes session.
8. **EN/AR** — Setup strings render; no diagnosis wording.
9. **Devices** — At least one iOS Safari + one Android Chrome pass.

### Regression guards

- STS capture path unchanged.
- Other motion pilots (`suPilot`, `frPilot`, etc.) unaffected.
- `resolvePatientCvDetectorKind("heel-raise")` remains `"heel-raise"`.

---

## Recommended implementation slices (PR109)

Execute in order; each slice is a reviewable PR-sized unit.

| Slice | Scope | Est. focus |
|-------|-------|------------|
| **PR109a** | `captureQuality` on `hrPilot` + clinician parse + unit tests | `heel-raise-motion-pilot-record.ts`, `motion-analysis-report.ts`, tests |
| **PR109b** | Ankle landmark coverage readiness + framing override | New `hr-ankle-landmark-coverage.ts`, `heel-raise-pose-detector.ts`, readiness tests |
| **PR109c** | Timeline visibility from landmarks (not proxy) | `heel-raise-motion-timeline.ts`, pilot record visibility ratios |
| **PR109d** | Patient copy + wizard label audit (de-experimentalize) | `bio-0-contracts.ts`, `camera-setup-wizard` labels if needed |
| **PR109e** | Manual smoke doc + threshold tuning from results | Docs + optional `PATIENT_HEEL_RAISE_REP_CONFIG` tuning |
| **PR109f** | Controlled heel-raise pilot plan (optional, mirrors PR106) | `docs/pilot/CONTROLLED_HEEL_RAISE_PILOT_PLAN.md` — only after PR109a–e |

**Minimum promotion bar:** PR109a + PR109b + PR109e (capture quality, ankle coverage, smoke proof).

---

## Missing components summary

| Component | Status |
|-----------|--------|
| `hrPilot.captureQuality` persistence | **Missing** |
| Ankle landmark coverage module (PR101 analogue) | **Missing** |
| Clinician `captureQuality` for heel raise | **Missing** |
| Landmark-based timeline visibility | **Partial** (proxy only) |
| Heel-raise manual smoke QA doc | **Missing** |
| Promotion-ready patient copy | **Partial** (experimental wording remains) |
| Device-validated rep thresholds | **Not validated** |
| Single-leg heel raise support | **Out of scope** |
| Assessment Center heel-raise review card | **Deferred** |

---

## PR109 implementation plan (recommended)

**Title:** PR109 — Heel Raise CV Hardening Implementation  
**Prerequisite:** STS controlled pilot go + PR108 merged  
**Goal:** Bring heel raise to promotable P1 parity with STS capture quality and ankle visibility bar.

### Phase 1 — Capture quality parity (PR109a)

1. Extend `HeelRaiseMotionPilotRecord` with optional `captureQuality: CaptureQualityResult` (mirror `StsMotionPilotRecord` pattern).
2. Call `assessCaptureQualityFromSession` in `buildHeelRaiseMotionPilotRecordFromSummary` using summary visibility, tracking distribution, capture flags, pose loss count.
3. Feed `capture_setup_limited` and `pose_tracking_interrupted` into quality scoring.
4. Parse in `buildMotionAnalysisReport` when `exerciseId === "heel-raise"`.
5. Unit tests: payload validation, report parse, clinician flags → medium/low quality.

### Phase 2 — Ankle coverage readiness (PR109b)

1. Add `hr-ankle-landmark-coverage.ts` — score bilateral ankle visibility; hips/knees as secondary.
2. Expose `hrAnkleCoverageReady` on heel-raise snapshot (mirror `stsLandmarkCoverageReady`).
3. Optional adaptive override: when ankles strong and framing is `move_back`, treat `correct_distance` as met.
4. Update `patient-cv-capture-readiness` tests.

### Phase 3 — Visibility fidelity (PR109c)

1. Sample hip/knee/ankle visibility from pose landmarks in timeline ticks (in-memory only).
2. Replace scalar proxy in `heelRaiseVisibilityFromCaptureSnapshot`.
3. Verify `visibilityRatios.ankle` in clinician report reflects ankle presence.

### Phase 4 — Copy and QA (PR109d + PR109e)

1. Update `optionalCameraNote` and prototype notice for P1 pilot (therapist-review-only; no experimental label).
2. Author `docs/pilot/heel-raise-pilot-qa-validation.md`.
3. Run manual smoke; tune `PATIENT_HEEL_RAISE_REP_CONFIG` if false reps observed.

### Promotion criteria (go / no-go)

| Criterion | Required |
|-----------|----------|
| Automated tests pass (including new capture quality + coverage tests) | Yes |
| Manual smoke pass on ≥2 device/browser combos | Yes |
| `hrPilot` includes `captureQuality` on saved sessions | Yes |
| Ankle coverage readiness reduces false "ready" states in smoke | Yes |
| No diagnosis, heel-height, or strength claims in copy or payloads | Yes |
| STS pilot go documented | Yes |

---

## Safety wording (unchanged boundaries)

**May say**

- Camera-assisted movement observation for **therapist review only**.
- Rep count assist and tracking signal (good / fair / poor).
- Session duration and derived motion evidence snapshots.

**Must not say**

- Heel raise height, calf strength grade, balance pass/fail.
- Clinical validation, diagnosis, or treatment recommendation.
- "Correct form" / pathology labels.

**Existing guardrails to preserve**

- PR103 consent gate.
- No video or landmark persistence.
- `reviewRequired: true` on `hrPilot`.
- Forbidden payload key scans.

---

## Related documents

- `docs/cv/CV_EXERCISE_ALLOWLIST_PLAN.md` — PR107 P1 sequencing
- `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md` — gate before expansion
- `docs/pilot/sts-pilot-qa-validation.md` — STS QA template for PR109e

---

## Document history

| Date | PR | Change |
|------|-----|--------|
| 2026-06-05 | PR108 | Initial gap analysis and PR109 plan (docs only) |
