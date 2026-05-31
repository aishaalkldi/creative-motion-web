# MINI-SQUAT-CV-0 — Design Specification

**Track:** MINI-SQUAT-CV-0  
**Status:** Documentation / design only — **not implemented**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Product:** RASQ by Creative Motion Lab  

**Related docs:** `RASQ-motion-trackable-rehab-framework.md` · `docs/programs/sports-knee-foundation.md` · `docs/mqe/MQE-0-movement-completion-analysis.md` · `docs/mqe/MQE-0-safety-language.md` · `docs/pilot/known-limitations.md`

**RASQ code impact:** None in this track. No app, API, schema, or production CV logic changes until explicitly approved.

**Prerequisite:** STS-CV-1 validated on Sports Knee Session 4 (mobile real-world validation PASS or PARTIAL with framing fix retest).

---

## Safety boundaries (locked)

| Rule | Status |
|------|--------|
| No diagnosis | Required |
| No clinical scoring | Required |
| No movement quality score (patient or clinician grade) | Required |
| No automatic progression | Required |
| No return-to-sport clearance | Required |
| No injury prediction | Required |
| No performance ranking | Required |
| No patient-facing AI | Required |
| Clinician review only | Required |
| Optional camera — manual completion always valid | Required |
| No video or landmark persistence | Required |
| Not clinically validated — disclaimers on all surfaces | Required |

**Approved framing:** camera-assisted · assistive movement metrics · session observation · estimated depth observation · tracking signal · review suggested · assistive estimate only.

**Forbidden terms:** bad form · poor quality · unsafe movement · ready to progress · movement score · performance rank · diagnosis · clearance · validated outcome.

See `docs/mqe/MQE-0-safety-language.md` for MQE copy rules.

---

## 1. Clinical purpose

### Why Mini Squat is valuable in sports rehabilitation

Mini squat (0–45° knee flexion) is a **closed-chain, partial-load** exercise that trains quadriceps and glute control in weight-bearing, knee flexion tolerance under load, and trunk–hip–knee coordination relevant to return-to-training preparation. It is a standard dose task in knee foundation programs — **not** a diagnostic test.

### Why it belongs in Sports Knee Foundation

Mini squat (`mini-squat`) appears in **5 of 12 sessions** (5, 7, 8, 10, 12). Sit-to-Stand CV (Session 4+) covers functional rise; mini squat provides **repeated closed-chain squat exposure** across Weeks 2–4. Adding optional CV assist is the first expansion of the Motion-Trackable Framework Phase A beyond STS.

### Why it is appropriate for home use

- Standing exercise; minimal equipment (optional wall/chair touch)  
- Same smartphone geometry as STS (front sagittal, 2–3 m)  
- Discrete rep prescription (typically 10–15 reps × 3 sets)  
- Pain/effort already captured via session log — CV adds **assistive count context only**

### Clinical limitations

| Limitation | Detail |
|------------|--------|
| No goniometry | Phone pose cannot replace inclinometer or clinician ROM measurement |
| No frontal-plane assessment | Knee valgus/varus not reliable from single front camera |
| No load measurement | Cannot infer % body weight or external load |
| Trunk lean vs knee flexion | Hip drop may count without true knee flexion |
| Pain/context blind | CV unaware of effusion, giving way, surgical restrictions |
| Single camera angle | Side view improves depth estimate; v0 ships **front view only** |

### What Mini Squat CV must NOT claim

- Correct or incorrect form  
- Safe vs unsafe movement  
- Ready to progress or return to sport  
- Injury risk or reinjury prediction  
- Comparison to normative “healthy” squat  
- Replacement for clinician examination or protocol compliance  

---

## 2. Camera requirements

### Views

| View | Role in v0 |
|------|------------|
| **Front (patient faces camera)** | **Production default** — same as Sit-to-Stand |
| **Side (90° profile)** | CV Lab tuning only; not required for patient portal v0 |
| **Preferred production view** | Front, portrait, phone propped waist-high |

### Setup parameters

| Parameter | Specification |
|-----------|---------------|
| Distance | 2.0–3.5 m from patient |
| Frame | Head to mid-shin minimum; feet visible when possible |
| Phone height | ~0.9–1.1 m on stable surface |
| Orientation | Portrait |
| Background | Uncluttered; patient–background contrast preferred |

### Minimum visible landmarks (readiness gate)

Before rep counting starts:

- Both hips (23, 24): visibility ≥ **0.35 each** (match `PATIENT_STS_CONFIG`)  
- Knees (25, 26): ≥ **0.30** on at least one knee for depth assist (optional — rep count may proceed hip-only with depth confidence reduced)  
- Shoulders (11, 12): sum visibility ≥ **0.6** when torso span scaling enabled  

### Lighting

- Normal indoor ambient; avoid strong backlight  
- Poor visibility reflected in **tracking signal** only — never as movement judgement

### Common failure scenarios

| Scenario | Effect |
|----------|--------|
| Phone too close | Lower body clipped; poor visibility |
| Phone too low | Torso span unreliable |
| Dark room | Session tracking quality → fair/poor |
| Baggy clothing | Landmark jitter; depth noise |
| Patient leaves frame | Pose lost; partial session save |
| Heavy wall support / pulling | Hip trajectory ≠ squat; over-count risk |
| Hip hinge without knee bend | Rep may increment — document as assistive-count limitation |

---

## 3. Landmark strategy (MediaPipe Pose)

Landmark indices: hips 23/24, knees 25/26, ankles 27/28, shoulders 11/12.

| Landmark | Required / optional | Purpose |
|----------|---------------------|---------|
| **Hip** | **Required** | Primary rep signal — hip mid-Y vs standing baseline |
| **Knee** | Recommended | Depth proxy; knee visible frame percentage |
| **Ankle** | Optional | Stability hint only; not used for rep count v0 |
| **Shoulder** | **Required for scaling** | Torso span normalization (`computeTorsoSpan`) |

### Reliability requirements

- **Rep counting:** frame must meet `minHipVisibility` to update FSM  
- **Depth category:** knees visible on ≥ **40%** of bottom-phase frames across session; else depth → `unknown` (omit category or show assistive-only unknown line to clinician)  
- **Tracking quality:** reuse `session-visibility-summary.ts` on hip visibility sum (MQ-SIGNAL-1B pattern)

**Ankle not required for v0:** front-view ankle occlusion during squat is common; blocking reps on ankles would reduce home reliability.

---

## 4. Rep detection state machine

### Design principle

Invert Sit-to-Stand polarity: **standing baseline**, count **down → bottom → up** cycles (hip Y increases on descent in normalized MediaPipe coordinates).

### States

```
CALIBRATING → STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING → rep++
```

| Internal state | Spec label |
|----------------|------------|
| CALIBRATING | Idle (baseline window) |
| STANDING | Idle / ready between reps |
| DESCENDING | Descending |
| BOTTOM | Bottom |
| ASCENDING | Ascending |
| Return to STANDING band | Completed rep |

**v0 simplification option:** ship 3-phase FSM (standing / descended / ascending) equivalent to STS stand-phase inversion if pilot shows BOTTOM dwell adds latency without accuracy gain. CV Lab validates full 5-state first.

### Signals

After standing baseline `baselineHipY` (median over 3 s):

```
squatDownThreshold = baselineHipY + squatDeltaDown
squatUpThreshold   = baselineHipY + squatDeltaUp    // squatDeltaUp < squatDeltaDown
```

Torso-scaled deltas (starting points — CV Lab tune):

| Parameter | Starting value |
|-----------|----------------|
| `ratioDown` | 0.10–0.12 × torsoSpan |
| `ratioUp` | 0.05–0.06 × torsoSpan |
| `minDown` | 0.025 normalized floor |
| `minMsBetweenReps` | 900–1200 ms |
| `baselineDurationMs` | 3000 ms |
| `readinessCheckMs` | 2000 ms |

### Transitions

| From | To | Condition |
|------|-----|-----------|
| CALIBRATING | STANDING | Baseline complete + readiness pass |
| STANDING | DESCENDING | `hipY > squatDownThreshold` |
| DESCENDING | BOTTOM | Local max hipY or bottom dwell |
| BOTTOM | ASCENDING | Hip rises from bottom by hysteresis |
| ASCENDING | STANDING | `hipY ≤ squatUpThreshold` |
| STANDING | rep++ | Full cycle + debounce elapsed |

### Debounce and false-positive protection

- Require return to standing band before next descent  
- Ignore micro-bounces below `squatDeltaUp`  
- Pause FSM on brief pose loss (< 500 ms gap)  
- Do not increment during baseline calibration  
- `minSaveDurationS`: 3 s (existing platform gate)

---

## 5. Safe metrics (clinician-facing)

| Metric | Patient sees | Clinician sees |
|--------|--------------|----------------|
| **Rep count** | “Reps counted: N” | Assistive rep count + footer disclaimer |
| **Session duration** | Optional MM:SS | Duration column |
| **Exercise duration** | Same tracking window | Context vs prescribed sets |
| **Estimated squat depth** | **No (v0)** | “Estimated depth observation: …” |
| **Tempo** | **No** | “Estimated ~N s per rep · assistive estimate only” |
| **Completion observation** | **Never** | MQE lines |
| **Tracking quality** | Tracking signal (Good/Fair/Weak) | Good / Fair / Limited camera visibility |

### Prohibited metrics

Movement quality score · good form score · bad form score · readiness score · injury risk score · return-to-sport score · performance rank.

---

## 6. Squat depth estimation

### Method (assistive observation only)

**Primary signal:** peak hip drop per rep cycle:

```
depthRatio = (peakHipY - baselineHipY) / torsoSpan
```

**Optional:** knee flexion proxy when knees visible (internal; not degrees).

**Session aggregate:** median `depthRatio` across counted reps.

### Categories (clinician-only)

**Option A — three categories (CV Lab default):**

| Category | Median depthRatio (initial tune) | Clinician label |
|----------|----------------------------------|-----------------|
| Partial | < 0.08 | Estimated depth observation: partial |
| Moderate | 0.08 – 0.14 | Estimated depth observation: moderate |
| Deep | > 0.14 | Estimated depth observation: deep |

**Option B — binary (recommended for v0 ship):**

| Category | Rule |
|----------|------|
| Above threshold | median depthRatio < 0.10 |
| Reached threshold | median depthRatio ≥ 0.10 |

### Why observation only

- Depth ratio ≠ knee flexion degrees  
- Trunk lean inflates hip drop  
- No pain, effusion, or protocol context  
- Labels describe **estimated camera observation** — not “adequate” or “inadequate” squat  

---

## 7. Tracking quality model

### Persistence

Store in existing `cv_session_metrics.tracking_quality`: `good` | `fair` | `poor` | `unknown`.

### Derivation

Reuse MQ-SIGNAL-1B session-level visibility summary:

- Per-frame hip visibility sum → label counts  
- `summarizeSessionVisibility()` at save  
- Minimum pose frame gate (`SESSION_VISIBILITY_MIN_POSE_FRAMES`)

### Display mapping

| Stored | Clinician UI | Patient UI |
|--------|--------------|------------|
| good | Good signal | Tracking signal: Good |
| fair | Fair signal | Tracking signal: Fair — results may vary |
| poor | Limited camera visibility | Tracking signal: Weak — adjust phone or lighting |
| unknown | Unknown signal | Neutral / unknown |

**Do not label:** High/Medium/Low **performance** — visibility only.

### Interruptions

`frames_with_pose / frames_total` persisted; low ratio contributes to fair/poor session summary.

---

## 8. Clinician dashboard output

### Movement tracking session card

```
Mini Squat (0–45°) · Patient session · [date]
─────────────────────────────────────────────
Assistive rep count: 12
Session duration: 2:15
Estimated depth observation: moderate          [clinician-only]
Tracking signal: Good
Movement detected: Yes

Completion observation:
  Session observation: completion recorded
  [If applicable] Completion pattern: rep count below prescribed target · review suggested
  [If applicable] Camera visibility: limited · review suggested

Rep count is an assistive movement metric and must be reviewed with the patient's clinical context.
Optional experimental assist — therapist review only — not clinically validated.
```

### Review suggested (MQE language)

Use **“Review suggested”** — not automated clinical recommendation.

| Condition | Example line |
|-----------|--------------|
| Under target | Completion pattern: rep count below prescribed target (12 recorded, 30 prescribed) · review suggested |
| Low visibility | Camera visibility: limited · review suggested |
| No movement | No movement detected during tracking · review suggested |

### Session schedule line (clinician variant)

> Camera used · Mini Squat reps: 12 · visibility: fair

---

## 9. Patient portal output

### Allowed

| Element | Content |
|---------|---------|
| Consent | Same structure as STS; bullets reference mini squat counting |
| Setup | “Stand facing the camera, feet shoulder-width. Squat down slowly, then stand.” |
| Live assist | Reps counted · tracking signal · session duration |
| Skip | Continue without camera |
| After save | Saved — your therapist can review this session |

### Prohibited

- Depth category or depth feedback  
- Quality / form messages  
- “Good squat” / “go deeper”  
- Progression or next-session unlock  
- Clinical interpretation  
- AI summary or coaching  

---

## 10. Data model recommendation

### Current production (`cv_session_metrics` — migration 008)

No `motion_quality` JSONB exists today. **Phase A can ship without schema migration.**

| Column | Mini squat value |
|--------|------------------|
| exercise_id | `mini-squat` |
| rep_count | integer |
| session_duration_s | integer |
| tracking_quality | good / fair / poor / unknown |
| movement_detected | boolean |
| frames_with_pose / frames_total | integer |
| prototype_version | `cv-y2-mini-squat` |
| source | `patient_session` |

Depth and tempo: MQE read-time or clinician UI derivation until optional JSONB phase.

### Phase B — optional `motion_observations` JSONB

Preferred column name over `motion_quality` (avoids implying clinical quality).

```json
{
  "schemaVersion": "cv-obs-1",
  "exerciseId": "mini-squat",
  "metricClass": "reps",
  "repCount": 12,
  "sessionDurationS": 135,
  "trackingQuality": "good",
  "movementDetected": true,
  "depthObservation": {
    "category": "moderate",
    "method": "hip_drop_torso_normalized",
    "medianDepthRatio": 0.11,
    "confidence": "assistive_only",
    "kneeVisibleFramePct": 0.62
  },
  "tempo": {
    "estimatedSecPerRep": 11.25,
    "assistiveOnly": true
  },
  "visibility": {
    "framesWithPose": 4200,
    "framesTotal": 4500,
    "sessionVisibilityLabel": "good"
  },
  "disclaimer": "Derived assistive metrics only. Not clinically validated. Therapist review required."
}
```

**Patient API POST:** extend exercise allowlist; optional validated `motionObservations` object; existing forbidden-keys guard unchanged.

---

## 11. Shared detector architecture (RASQ Shared CV Engine)

### Detector interface (conceptual)

```typescript
interface RasqExerciseCvDetector<TConfig, TMetrics> {
  readonly exerciseId: string;
  readonly metricClass: "reps" | "hold" | "reach";
  init(config: TConfig): Promise<void>;
  start(): void;
  stop(): TMetrics;
  getSnapshot(): DetectorSnapshot;
  dispose(): void;
}
```

### Shared modules

| Module | Role |
|--------|------|
| `pose-session-runner.ts` (future) | MediaPipe init, camera, frame loop |
| `session-visibility-summary.ts` | Session tracking quality |
| `sagittal-hip-rep-core.ts` (new) | Baseline + rep FSM — STS and mini squat polarities |
| `mini-squat-detector.ts` (new) | Config + depth aggregator |
| `cv-exercise-registry.ts` (new) | exerciseId → factory + config + copy |

### Sit-to-Stand protection

- `SitToStandDetector` delegates to shared core — **frozen STS thresholds** in `PATIENT_STS_CONFIG`  
- Mini squat thresholds live only in `PATIENT_MINI_SQUAT_CONFIG`  
- STS regression suite required before merge  

### Future exercise mapping

| Exercise | metricClass | Detector base |
|----------|-------------|---------------|
| sit-to-stand | reps | SagittalHipRep (seated baseline, rise) |
| mini-squat | reps | SagittalHipRep (standing baseline, drop) |
| heel-raise | reps | AnkleVerticalRep (Phase C) |
| single-leg-stance / tandem-stance | hold | HoldDurationDetector (Phase B) |
| functional-reach | reach | ReachExcursionDetector (Phase E) |
| step-up | reps | UnilateralStepRep (Phase D) |

---

## 12. MQE integration

Extend read-time `deriveMqeObservation()` for `exerciseId === "mini-squat"`.

### Allowed observations

| Flag | Rule |
|------|------|
| Completed | Session status completed / done |
| Under target | rep_count < sets × min(reps) from plan exercise |
| Low visibility | tracking_quality poor or unknown |
| No movement | movement_detected false |
| Tempo | session_duration_s / rep_count when reps > 0 |
| Depth (optional) | Estimated depth observation line — assistive only; not a review trigger alone |

### Not allowed

Movement score · form judgement · progression suggestion · clinical grading

### Version

Bump `MQE_RULES_VERSION` to `mqe-0.2` when mini squat ships; STS rules unchanged.

---

## 13. AI Summary integration

### Allowed (clinician-only draft, factual)

- Optional camera assist used on mini squat in N sessions  
- Assistive rep counts recorded (with disclaimer)  
- Tracking signal limited in X of Y sessions  
- Descriptive rep trend over time — not interpretive  

### Not allowed

- Diagnosis or injury labeling  
- Progression or plan-change recommendation  
- “Squat depth inadequate” as clinical advice  
- Automatic treatment plan mutation  

AI Summary remains parallel to MQE; MQE lines in AI input require explicit product approval (same as MQE-0 policy).

---

## 14. Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Front camera angle limits depth | Medium | Front-only v0; depth as observation; CV Lab side-view research |
| False rep (trunk lean) | Medium | Conservative thresholds; pilot tune; assistive-count disclaimer |
| False rep (weight shift) | Low–medium | Full up-reset band; minMsBetweenReps |
| Knee occlusion | Medium | Hip-only rep path; depth unknown if knees absent |
| Patient setup drift | Medium | Readiness gate; framing copy; visibility flags |
| Clinician over-interpretation | High | “Observation” / “assistive” language; MQE never “fail” |
| Regulatory overclaim | High | No form score; disclaimers on consent, save, clinician card |
| STS regression | High | Shared core extraction + STS golden tests gate merge |

---

## 15. Implementation plan

### Sprint A — Foundation (≈2 weeks)

**Engineering**

- Extract `sagittal-hip-rep-core` from STS without behavior change  
- Implement `MiniSquatDetector` + unit tests  
- `PATIENT_MINI_SQUAT_CONFIG`  
- CV Lab mini-squat tuning mode  

**Clinical review**

- Approve EN/AR patient and clinician copy  
- Choose binary vs three-category depth for v0 ship  

**QA**

- STS regression 100% pass  
- Mini squat unit tests (≥ 15 synthetic sequences)  

**Pilot gate**

- STS Sports Knee Session 4 mobile validation PASS before patient enable  

---

### Sprint B — Patient + API integration (≈1.5 weeks)

**Engineering**

- Generalize `PatientCvCapture` exercise factory  
- Allowlist `mini-squat` on POST `/api/patient/cv-session-metrics`  
- Generic metrics in `useCvSessionCapture`  
- Clinician card depth observation line  

**Clinical review**

- Dashboard mock review (good / under-target / poor visibility rows)  

**QA**

- Sports Knee Session 5 mobile script  
- Skip-camera path regression  

**Pilot**

- 3 internal sessions: manual vs CV rep count log  

---

### Sprint C — MQE + pilot hardening (≈1 week)

**Engineering**

- MQE rules for mini-squat  
- Clinician session schedule camera lines  
- Optional `motion_observations` JSONB migration (if depth persist required)  

**Clinical review**

- MQE false-positive review from pilot log  

**QA**

- Build pass; confirm no patient-facing depth  
- Arabic copy smoke  

**Pilot validation**

- 5+ sessions; target ≥ 80% within ±2 reps of manual count (aspire 90% before broad rollout)  

---

## 16. File impact assessment

### Required

| File | Change |
|------|--------|
| `app/lib/cv/sagittal-hip-rep-core.ts` | New — shared FSM |
| `app/lib/cv/mini-squat-detector.ts` | New |
| `app/lib/cv/mini-squat-detector.test.ts` | New |
| `app/lib/cv/exercises/mini-squat.config.ts` | New |
| `app/lib/cv/sit-to-stand-detector.ts` | Delegate to core; STS behavior frozen |
| `app/lib/cv/cv-patient-config.ts` | Add allowlist entry |
| `app/lib/cv/bio-0-contracts.ts` | Types, copy, prototype version |
| `app/components/patient/cv/PatientCvCapture.tsx` | Exercise factory |
| `app/hooks/useCvSessionCapture.ts` | Generic metrics |
| `app/components/patient/ExerciseMediaArea.tsx` | Pass exerciseId |
| `app/api/patient/cv-session-metrics/route.ts` | Allowlist + validation |
| `app/lib/mqe/derive-mqe-observation.ts` | Per-exercise MQE |
| `app/lib/mqe/derive-mqe-observation.test.ts` | Mini squat cases |
| `app/components/clinician/cv/CvReviewSummary.tsx` | Depth observation line |
| `app/lib/cv/clinician-session-camera-status.ts` | Generalize CV session detection |

### Optional

| File | Change |
|------|--------|
| `app/lib/cv/cv-exercise-registry.ts` | Central registry |
| `app/components/clinician/cv/CvLabSession.tsx` | Mini squat CV Lab tab |
| `supabase/migrations/00X_motion_observations.sql` | JSONB column |
| `docs/cv-roadmap/MINI-SQUAT-CV-0-pilot-script.md` | Field validation script |

### Future

| File | Change |
|------|--------|
| `app/lib/ai/clinician-summary-input.ts` | Mini squat context lines |
| `app/components/SessionScheduleView.tsx` | Multi-exercise MQE lines |
| Hold / heel / step detectors | Separate tracks |

---

## 17. Success criteria (production readiness)

| Criterion | Target |
|-----------|--------|
| STS regression | Zero behavior change on STS golden tests |
| Rep agreement (pilot) | ≥ 80% sessions within ±2 reps of manual count; aspire 90% |
| Tracking stability | ≥ 50% sessions good or fair visibility (home-realistic bar) |
| Save reliability | CV row when tracking ≥ 3 s and movement detected |
| Patient safety | No form/quality/progression copy in portal |
| Clinician usability | ≥ 3.5/5 on pilot feedback form |
| MQE false positives | Tune if > 40% review-suggested flags dismissed as noise |
| Regulatory | Disclaimers on all surfaces; no new patient AI |

---

## 18. Final recommendation

### Mini Squat should be the next exercise after Sit-to-Stand

| Dimension | Justification |
|-----------|---------------|
| Clinical value | Core closed-chain dose; 5/12 Sports Knee sessions |
| Engineering complexity | Low–medium — ~70% reuse of STS geometry, visibility, save, MQE |
| Regulatory safety | Same assistive-metrics class as STS; depth clinician-only in v0 |
| Product strategy | Motion-Trackable Framework Phase A second exercise |
| vs Heel Raise | Better front-camera reliability and program fit |
| vs Step-Up | Lower occlusion and unilateral complexity |

### Start condition

STS Sports Knee Session 4 mobile validation → **PASS** (or PARTIAL with framing fix + documented retest).

### Do not start if

STS visibility poor-rate remains > 60% without framing guidance fix — mini squat inherits same geometry.

### Do not delay if

STS validation passes — delay forfeits Phase A program narrative without reducing engineering risk meaningfully.

---

## Document control

| Field | Value |
|-------|-------|
| Track ID | MINI-SQUAT-CV-0 |
| File | `docs/cv-roadmap/MINI-SQUAT-CV-0-design-spec.md` |
| RASQ code impact | **None** until implementation approved |
| Commit | **Awaiting approval** |
| Next step | STS S4 validation PASS → Sprint A engineering branch |
