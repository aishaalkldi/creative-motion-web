# SINGLE-LEG-STANCE-CV-SPEC-0 — Design Specification

**Track:** SINGLE-LEG-STANCE-CV-SPEC-0  
**Status:** Documentation / design only — **not implemented**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Product:** RASQ by Creative Motion Lab  

**Related docs:** `RASQ-motion-trackable-rehab-framework.md` · `MINI-SQUAT-CV-0-design-spec.md` · `docs/programs/sports-knee-foundation.md` · `docs/mqe/MQE-0-movement-completion-analysis.md` · `docs/mqe/MQE-0-safety-language.md` · `docs/pilot/known-limitations.md`

**RASQ code impact:** None in this track. No app, API, schema, or production CV logic changes until explicitly approved.

**Prerequisite:** Phase A exit gate PASS (STS mobile validation + Mini Squat CV pilot stable). Single-Leg Stance CV ships in **Motion-Trackable Framework Phase B**.

**Target `exerciseId`:** `single-leg-stance`  
**Metric class:** `hold` (hold duration — not rep count)

---

## Safety boundaries (locked)

| Rule | Status |
|------|--------|
| No diagnosis | Required |
| No clinical balance test score | Required |
| No movement quality score (patient or clinician grade) | Required |
| No fall prediction or fall-risk score | Required |
| No automatic progression | Required |
| No return-to-sport clearance | Required |
| No injury prediction | Required |
| No performance ranking | Required |
| No patient-facing AI | Required |
| Clinician review only | Required |
| Optional camera — manual completion always valid | Required |
| No video or landmark persistence | Required |
| Not clinically validated — disclaimers on all surfaces | Required |

**Approved framing:** camera-assisted · assistive hold tracking · session observation · balance interruption observed · tracking signal · review suggested · assistive estimate only.

**Forbidden terms:** bad form · poor balance · unsafe movement · fall risk · ready to progress · balance score · performance rank · diagnosis · clearance · validated outcome · failed balance test.

See `docs/mqe/MQE-0-safety-language.md` for MQE copy rules.

---

## 1. Clinical purpose

### Why Single-Leg Stance is valuable in sports rehabilitation

Single-leg stance (SLS) is a **closed-chain, static balance** task that supports proprioception, neuromuscular control of the stance limb, and preparatory work for single-limb loading (step-up, return-to-training progression). It is a standard dose task in knee and ankle foundation programs — **not** a clinical balance test (e.g. BESS, mCTSIB, Y-Balance).

### Why it belongs in Sports Knee Foundation

SLS (`single-leg-stance`) appears in **4 of 12 sessions** (6, 8, 10, 12). Typical prescription: **3 sets × 20–30 s each leg**, rest 45 s. Sit-to-Stand and Mini Squat CV (Phase A) cover rep-class functional tasks; SLS is the **first hold-duration** exercise in the Motion-Trackable catalog and validates the balance metric class before Tandem Stance.

### Why it is appropriate for home use

- Standing exercise; wall or chair **touch support** allowed per program copy  
- Same front-camera geometry as STS / Mini Squat (2–3 m, portrait)  
- Bounded hold prescription — not open-ended ambulation  
- Pain/effort captured via session log — CV adds **assistive hold-time context only**

### Clinical limitations

| Limitation | Detail |
|------------|--------|
| Not a validated balance test | Phone pose cannot replace timed clinical balance batteries |
| No sway quantification claim | Lateral hip drift is a coarse proxy — not center-of-pressure or force-plate data |
| Support hand use | Light fingertip wall touch may be invisible or misclassified |
| Leg identification | Front view may confuse left/right lift in baggy clothing or narrow stance |
| Eyes open/closed | Program assumes eyes open; CV cannot verify visual input |
| Footwear and surface | Carpet vs tile affects ankle landmark stability |
| Pain/context blind | CV unaware of giving way sensation, effusion, or surgical restrictions |

### What Single-Leg Stance CV must NOT claim

- Clinical balance score or pass/fail balance test  
- Fall risk or fall prediction  
- Correct or incorrect balance form  
- Ready to progress or return to sport  
- Comparison to normative age-matched balance norms  
- Replacement for in-clinic examination or BESS/mCTSIB  

---

## 2. Camera position

### Views

| View | Role in v0 |
|------|------------|
| **Front (patient faces camera)** | **Production default** — consistent with STS / Mini Squat |
| **Side (90° profile)** | CV Lab tuning only; not required for patient portal v0 |
| **Preferred production view** | Front, portrait, phone propped waist-high |

### Setup parameters

| Parameter | Specification |
|-----------|---------------|
| Distance | 2.0–3.5 m from patient |
| Frame | **Full body** — head to feet; both ankles must remain in frame when possible |
| Phone height | ~0.9–1.1 m on stable surface |
| Orientation | Portrait |
| Background | Uncluttered; patient–background contrast preferred |
| Support | Wall or chair within reach — **allowed**; document as limitation |

### Minimum visible landmarks (readiness gate)

Before hold timer starts:

- Both hips (23, 24): visibility ≥ **0.35 each**  
- Both ankles (27, 28): visibility ≥ **0.30 each** (critical for foot-down detection)  
- Both knees (25, 26): ≥ **0.25 each** (lift-leg flexion assist)  
- Shoulders (11, 12): sum visibility ≥ **0.6** when torso span scaling enabled  

### Patient positioning copy (design)

- Stand facing camera, feet hip-width apart initially  
- Lift **prescribed leg** (patient selects left/right in UI if plan does not auto-bind side)  
- Light fingertip support on wall allowed if prescribed  
- Hold until timer or clinician-prescribed duration  

### Common failure scenarios

| Scenario | Effect |
|----------|--------|
| Phone too close | Feet clipped; foot-down detection unreliable |
| Patient off-center | One ankle occluded; hold may not start |
| Dark room / backlight | Tracking signal → fair/poor |
| Heavy clothing | Ankle/knee landmarks jitter |
| Patient leaves frame | Pose lost; hold pauses; interruption may register |
| Tandem-like narrow stance | Both feet visible at same height — false bilateral |

---

## 3. Hold detection

### Design principle

Detect **unilateral weight-bearing phase** from front-view pose landmarks. Accumulate hold time only while the patient appears to maintain single-leg stance with stable pose visibility — not while calibrating or bilateral.

### Primary signals

| Signal | Source | Role |
|--------|--------|------|
| **Ankle height delta** | `ankleY_lift - ankleY_stance` (normalized Y; higher = lower in frame) | Lift leg foot off ground proxy |
| **Knee flexion delta** | Lift knee Y vs stance knee Y | Confirms non–weight-bearing limb flexion |
| **Hip midpoint stability** | Lateral (X) and vertical (Y) variance over sliding window | Sustained hold vs stepping |
| **Bilateral anchor** | Both ankles within `footDownDeltaY` | Foot-down / interruption |

**Stance vs lift leg assignment (v0):**

1. Patient selects **“Left leg standing”** or **“Right leg standing”** before camera start (recommended), **or**  
2. Auto-detect: whichever ankle rises first and sustains ≥ **400 ms** becomes lift leg (fallback — higher misclassification risk).

### Hold start condition

All must be true for **`holdStartConfirmMs`** (default **500 ms**):

- Readiness gate passed  
- `ankleY_delta > liftThreshold` (lift ankle materially higher than stance ankle)  
- Optional: lift knee flexion ≥ `kneeFlexMinDelta`  
- Hip midpoint variance below `maxSwayVariance` (calibrated in CV Lab)

→ Transition to **HOLD_ACTIVE**; timer accumulator starts.

### Hold end condition

Any of:

- Patient taps **Stop / Save** (normal completion)  
- `session_duration_s` reaches platform max (existing safety cap)  
- Sustained **INTERRUPTED** state (see §5)  
- Pose lost > **`poseLossHoldAbortMs`** (default **2000 ms**) — save partial hold with visibility flag  

### Hold active maintenance

While **HOLD_ACTIVE**:

- Re-evaluate foot-down each frame; brief ankle jitter below **`debounceFootDownMs`** (default **250 ms**) does not end hold  
- Pose gaps < **`poseGapTolerateMs`** (default **400 ms**) pause accumulator without interruption event  

---

## 4. Timer logic

### Timers (conceptual)

| Timer | Definition | Persisted |
|-------|------------|-----------|
| **Session wall clock** | Camera active from start → save | `session_duration_s` (existing column) |
| **Accumulated hold** | Sum of milliseconds in HOLD_ACTIVE | Primary assistive metric — see §10 |
| **Longest continuous hold** | Max uninterrupted HOLD_ACTIVE segment | Clinician observation (optional persist) |
| **Prescribed hold target** | From plan exercise dose (e.g. 30 s × 3 sets) | Read-time from plan — not CV-measured |

### v0 metric mapping (no schema migration)

Phase B v0 maps assistive hold output to existing fields:

| Field | SLS semantics |
|-------|---------------|
| `session_duration_s` | **Accumulated hold seconds** (rounded) — primary displayed hold metric |
| `rep_count` | **0** or **unused** for hold-class exercises |
| `movement_detected` | `true` if accumulated hold ≥ **3 s** |
| `tracking_quality` | Session visibility summary |

**Clinician copy clarifies:** “Assistive hold tracked: 22 s” — not “session lasted 22 s” if wall clock differs (future: separate `tracking_window_s` if product requires).

### Per-set vs single-session

Sports Knee prescription: **3 sets × 20–30 s each leg**.

| Mode | v0 recommendation |
|------|-------------------|
| **Single camera session per exercise block** | Accumulate hold across sets with **interruption events** marking set breaks — compare total accumulated hold to `sets × prescribed_seconds` |
| **Per-set restart (future)** | Patient taps “Next set” — cleaner dose comparison; optional Phase B+ UX |

### Live patient timer display

- Show **elapsed assistive hold** (MM:SS) incrementing during HOLD_ACTIVE  
- Do **not** show countdown to “pass” prescribed time  
- Do **not** show red/green pass-fail vs prescription on patient UI  

### Comparison to prescribed dose (clinician / MQE only)

```
prescribedTotalS = sets × parseHoldSeconds(repsField)   // e.g. 3 × 30 = 90
holdRatio = accumulatedHoldS / prescribedTotalS
```

MQE uses ratio bands — never “failed balance.”

---

## 5. Balance interruption detection

### Definition

A **balance interruption** is an observed event where single-leg hold tracking **pauses** because the patient likely placed the lift foot down, grabbed support abruptly, or exited stable unilateral pose — **not** a clinical fall classification.

### Detection rules (any sustained ≥ **`interruptionConfirmMs`**, default **350 ms**)

| Event type | Internal ID | Detection heuristic |
|------------|-------------|---------------------|
| **Foot down** | `FOOT_DOWN` | Lift ankle Y within `footDownDeltaY` of stance ankle Y |
| **Large sway** | `SWAY_BREAK` | Hip midpoint lateral X drift > `maxSwayBreakThreshold` × torso width |
| **Pose lost** | `POSE_LOST` | No pose landmarks above minimum visibility |
| **Step-out** | `STEP_OUT` | Both knees/ankles shift laterally > threshold with bilateral ankle alignment |

### What interruption is NOT

- Fall detection or fall alert  
- “Lost balance” clinical label to patient  
- Automatic session fail  

### Clinician-facing label

> Balance interruption observed: {count} · review suggested

Or per event type (clinician card detail, optional):

> Session observation: foot-down event during hold tracking · review suggested

### Counter

- `interruption_count` — integer, session-level  
- Increment once per distinct interruption episode (debounced re-entry to HOLD_ACTIVE starts new hold segment, not new interruption until next break)

---

## 6. Recovery event detection

### Definition

A **recovery event** occurs when the patient **returns to HOLD_ACTIVE** after an **INTERRUPTED** state — i.e. re-establishes single-leg pose after foot-down or sway break.

### FSM segment

```
HOLD_ACTIVE → INTERRUPTED → RECOVERING → HOLD_ACTIVE
                              ↑
                    recovery event counted here
```

### Detection

- From **INTERRUPTED**, when lift ankle rises above `liftThreshold` again for ≥ **`recoveryConfirmMs`** (default **500 ms**)  
- Increment **`recovery_event_count`**  
- Resume hold accumulator (new segment; longest-hold tracker updates if segment exceeds prior max)

### Clinician-facing label

> Recovery after interruption observed: {count} · assistive estimate only

**Not allowed:** “Patient recovered balance well” · “Stable recovery” · scoring recovery quality.

### Relationship to interruptions

| Metric | Meaning |
|--------|---------|
| `interruption_count` | Times hold broke |
| `recovery_event_count` | Times hold resumed after break |
| Typical | `recovery_event_count ≤ interruption_count` |

High recovery count with low accumulated hold → MQE **under-target** + visibility review — not automated regression.

---

## 7. Hold detection state machine

### States

```
CALIBRATING → READY → HOLD_ACTIVE ⇄ INTERRUPTED → RECOVERING → HOLD_ACTIVE → … → END
```

| State | Spec label | Timer behavior |
|-------|------------|----------------|
| CALIBRATING | Calibrating | No hold accumulate; establish bilateral baseline |
| READY | Ready | Waiting for lift detection |
| HOLD_ACTIVE | Hold active | Accumulator runs |
| INTERRUPTED | Interrupted | Accumulator paused; interruption counted |
| RECOVERING | Recovering | Brief; confirms re-lift before HOLD_ACTIVE |
| END | Session end | Flush metrics on save |

### Transitions (summary)

| From | To | Condition |
|------|-----|-----------|
| CALIBRATING | READY | Baseline window complete (default **2 s** bilateral) + readiness gate |
| READY | HOLD_ACTIVE | Hold start conditions met |
| HOLD_ACTIVE | INTERRUPTED | Interruption rule fired |
| INTERRUPTED | RECOVERING | Lift signal returns |
| RECOVERING | HOLD_ACTIVE | Recovery confirm elapsed |
| * | END | User save / max duration / abort |

### Parameters (CV Lab starting points)

| Parameter | Default |
|-----------|---------|
| `baselineDurationMs` | 2000 |
| `holdStartConfirmMs` | 500 |
| `liftThreshold` | 0.04 × torsoSpan (normalized Y) |
| `footDownDeltaY` | 0.025 × torsoSpan |
| `maxSwayVariance` | CV Lab tuned |
| `maxSwayBreakThreshold` | 0.15 × shoulder width |
| `debounceFootDownMs` | 250 |
| `interruptionConfirmMs` | 350 |
| `recoveryConfirmMs` | 500 |
| `poseGapTolerateMs` | 400 |
| `poseLossHoldAbortMs` | 2000 |
| `minSaveHoldS` | 3 |

---

## 8. Landmark strategy (MediaPipe Pose)

Landmark indices: hips 23/24, knees 25/26, ankles 27/28, shoulders 11/12.

| Landmark | Required / optional | Purpose |
|----------|---------------------|---------|
| **Ankle (both)** | **Required** | Foot-down vs lift-leg detection |
| **Knee (both)** | Recommended | Lift-leg flexion confirmation |
| **Hip (both)** | **Required** | Pelvis center; sway / weight shift |
| **Shoulder (both)** | **Required for scaling** | Torso span / shoulder width normalization |

**Wrists not required v0:** Support-hand touch unreliable from front view; do not block hold on wrist visibility.

---

## 9. Tracking quality model

### Persistence

Store in existing `cv_session_metrics.tracking_quality`: `good` | `fair` | `poor` | `unknown`.

### Derivation

Reuse MQ-SIGNAL-1B session-level visibility summary with **ankle-weighted** emphasis for hold exercises:

- Per-frame: sum hip visibility + sum ankle visibility  
- `summarizeSessionVisibility()` at save  
- Minimum pose frame gate (`SESSION_VISIBILITY_MIN_POSE_FRAMES`)

**Hold-specific rule:** If ankle visibility fair/poor for > **40%** of HOLD_ACTIVE frames, cap session tracking at **fair** even if hips good — foot-down confidence reduced (internal rule; patient still sees tracking signal only).

### Display mapping

| Stored | Clinician UI | Patient UI |
|--------|--------------|------------|
| good | Good signal | Tracking signal: Good |
| fair | Fair signal | Tracking signal: Fair — results may vary |
| poor | Limited camera visibility | Tracking signal: Weak — adjust phone or lighting |
| unknown | Unknown signal | Neutral / unknown |

**Do not label:** High/Medium/Low **balance performance** — visibility only.

---

## 10. Data model recommendation

### Current production (`cv_session_metrics` — migration 008)

**Phase B v0 can ship without schema migration** by mapping hold metrics to existing columns (see §4).

| Column | Single-leg stance value |
|--------|-------------------------|
| exercise_id | `single-leg-stance` |
| rep_count | `0` or null (hold-class) |
| session_duration_s | **Accumulated hold seconds** (primary) |
| tracking_quality | good / fair / poor / unknown |
| movement_detected | boolean (hold ≥ 3 s) |
| frames_with_pose / frames_total | integer |
| prototype_version | `cv-y2-sls-hold` |
| source | `patient_session` |

### Phase B+ — optional `motion_observations` JSONB

```json
{
  "schemaVersion": "cv-obs-1",
  "exerciseId": "single-leg-stance",
  "metricClass": "hold",
  "accumulatedHoldS": 22,
  "longestContinuousHoldS": 18,
  "interruptionCount": 2,
  "recoveryEventCount": 2,
  "stanceLeg": "left",
  "trackingQuality": "good",
  "movementDetected": true,
  "visibility": {
    "framesWithPose": 3800,
    "framesTotal": 4000,
    "ankleVisibleFramePct": 0.71,
    "sessionVisibilityLabel": "good"
  },
  "disclaimer": "Derived assistive metrics only. Not clinically validated. Not a balance test. Therapist review required."
}
```

Optional column: `metric_kind` = `hold` | `reps` | `reach` for clinician filtering without parsing JSON.

**Patient API POST:** extend exercise allowlist; validate hold-class payload; existing forbidden-keys guard unchanged.

---

## 11. MQE integration

Extend read-time `deriveMqeObservation()` for `exerciseId === "single-leg-stance"`.

### Allowed observations

| Flag | Rule |
|------|------|
| Completed | Session status completed / done |
| Under target | `accumulatedHoldS < prescribedTotalS × 0.8` (starting band — pilot tune) |
| Near target | Within ±20% of prescribed total hold |
| Low visibility | tracking_quality poor or unknown |
| No movement | movement_detected false |
| Interruptions | interruption_count ≥ 1 — informational review suggested |
| Short tracking | session wall clock ≪ expected dose window |

### Clinician copy examples

| Condition | Example line |
|-----------|--------------|
| Under target | Completion pattern: assistive hold below prescribed duration (22 s tracked, 30 s prescribed per set context) · review suggested |
| Low visibility | Camera visibility: limited · review suggested |
| Interruptions | Balance interruption observed: 2 · review suggested |
| No movement | No hold tracked during session · review suggested |

### Not allowed

Balance score · fall risk · form judgement · progression suggestion · “failed balance” · clinical grading

### Version

Bump `MQE_RULES_VERSION` to `mqe-0.3` when SLS ships; STS and mini-squat rules unchanged.

---

## 12. AI Summary integration

### Allowed (clinician-only draft, factual)

- Optional camera assist used on single-leg stance in N sessions  
- Assistive hold durations recorded (with disclaimer)  
- Tracking signal limited in X of Y sessions  
- Descriptive hold-time trend over time — not interpretive  
- Factual interruption counts — “interruptions observed during hold tracking”

### Not allowed

- Diagnosis or instability labeling  
- Fall risk language  
- Progression or plan-change recommendation  
- “Balance inadequate for return to sport”  
- Automatic treatment plan mutation  
- Comparison to normative balance standards  

AI Summary remains parallel to MQE; MQE lines in AI input require explicit product approval (same as MQE-0 policy).

---

## 13. Clinician dashboard output

### Movement tracking session card

```
Single-Leg Stance · Patient session · [date]
Stance leg: Left (patient-selected)
─────────────────────────────────────────────
Assistive hold tracked: 22 s
Longest continuous hold: 18 s
Balance interruptions observed: 2
Recovery after interruption observed: 2
Tracking signal: Good
Movement detected: Yes

Completion observation:
  Session observation: completion recorded
  [If applicable] Completion pattern: assistive hold below prescribed duration · review suggested
  [If applicable] Balance interruption observed: 2 · review suggested
  [If applicable] Camera visibility: limited · review suggested

Hold tracking is an assistive movement metric and must be reviewed with the patient's clinical context.
Not a clinical balance test. Optional experimental assist — therapist review only — not clinically validated.
```

### Stability Summary (Phase B section)

When hold-class exercises present, group under **Balance assist** filter:

| Element | Content |
|---------|---------|
| Hold tracked vs prescribed | “~22 s assistive hold tracked (30 s prescribed per set)” |
| Interruption count | If > 0 |
| Tracking signal | Visibility only |
| Disclaimer | Not a clinical balance test |

### Session schedule line (clinician variant)

> Camera used · Single-Leg Stance hold: 22 s · interruptions: 2 · visibility: fair

---

## 14. Patient portal output

### Allowed

| Element | Content |
|---------|---------|
| Consent | Same structure as STS; bullets reference **hold time tracking**, not balance testing |
| Setup | “Stand facing the camera. Select which leg you’re standing on. Lift the other foot and hold steady.” |
| Leg selector | Left / Right stance leg before start |
| Live assist | Hold tracked MM:SS · tracking signal · optional session duration |
| Skip | Continue without camera — manual completion |
| After save | Saved — your therapist can review this session |

### Prohibited

- Balance score or pass/fail vs prescription  
- “Good balance” / “unstable” / “try again” coaching  
- Fall warnings or fall-risk messaging  
- Progression or next-session unlock  
- Clinical interpretation  
- AI summary or coaching  
- Comparison to other patients or norms  

---

## 15. Safe language

### Approved terms (patient and clinician)

| Term | Use |
|------|-----|
| Assistive hold tracked | Primary metric label |
| Hold tracking | Feature name |
| Balance interruption observed | Event count — not “lost balance” |
| Recovery after interruption observed | Resume after break |
| Tracking signal | Visibility only |
| Review suggested | MQE prompt |
| Assistive estimate only | Footer / depth context |
| Manual completion | Skip camera path |
| Session observation | MQE header |

### Forbidden terms

| Avoid | Prefer |
|-------|--------|
| Failed balance | Assistive hold below prescribed duration |
| Poor balance | Balance interruption observed |
| Unstable | Session observation / interruption observed |
| Fall risk | *(omit entirely)* |
| Balance score | *(omit entirely)* |
| Passed / failed test | Completion pattern / review suggested |

### Disclaimers (required surfaces)

- Patient consent screen  
- Post-save confirmation  
- Clinician CV review card footer  
- Optional JSONB `disclaimer` field  

Standard footer (EN):

> Hold tracking is an assistive movement metric for therapist review. It is not a clinical balance test and is not clinically validated.

---

## 16. Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Foot-down false negative (lift leg occluded) | High | Ankle readiness gate; ankle-weighted visibility; fair/poor cap |
| Foot-down false positive (narrow stance) | Medium | Knee flexion confirm; patient setup copy; CV Lab tune |
| Leg side misclassification | Medium | Patient leg selector default; auto-detect fallback only |
| Support hand invisible | Medium | Document limitation; do not claim support detection v0 |
| Sway threshold too sensitive | Medium | Pilot tune; interruption as observation not alarm |
| Clinician over-interpretation as balance test | High | “Not a clinical balance test” on all surfaces |
| Patient anxiety from “interruption” copy | Medium | Neutral event language; no red alert UX |
| Regulatory overclaim | High | No balance score; no fall prediction; disclaimers |
| Phase A regression | Medium | Hold detector isolated module; STS/Mini Squat suites unchanged |

---

## 17. Shared detector architecture (reference)

Hold-class exercises use a separate detector from rep-class `SagittalHipRepCore`:

| Module | Role |
|--------|------|
| `hold-duration-core.ts` (new) | Baseline, lift detect, timer accumulator, interruption debounce |
| `single-leg-stance-detector.ts` (new) | SLS config + metrics flush |
| `session-visibility-summary.ts` | Session tracking quality (ankle-weighted variant) |
| `cv-exercise-registry.ts` | exerciseId → factory |

### Future exercise mapping

| Exercise | metricClass | Detector base |
|----------|-------------|---------------|
| single-leg-stance | hold | HoldDurationCore (unilateral) |
| tandem-stance | hold | HoldDurationCore (bilateral narrow) |
| sit-to-stand / mini-squat | reps | SagittalHipRep |

**Sit-to-Stand / Mini Squat protection:** No shared FSM with hold core — independent code paths; regression suites required before Phase B merge.

---

## 18. Future implementation plan

### Gate 0 — Prerequisites

| Item | Exit criteria |
|------|---------------|
| Phase A complete | Mini Squat CV pilot ≥ 5 sessions; STS regression green |
| Clinical copy approved | EN patient + clinician hold/interruption strings |
| CV Lab harness | SLS tuning tab with synthetic + recorded sequences |

### Sprint D — Hold core (≈2 weeks)

**Engineering**

- Implement `hold-duration-core.ts` + unit tests  
- Implement `SingleLegStanceDetector`  
- `PATIENT_SLS_CONFIG`  
- CV Lab SLS mode  

**QA**

- ≥ 20 synthetic hold sequences (clean hold, foot-down, sway break, recovery)  
- No changes to STS / mini-squat detectors  

**Pilot gate**

- Internal 5 sessions: manual stopwatch vs accumulated hold  

---

### Sprint E — Patient + API (≈1.5 weeks)

**Engineering**

- Leg selector in `PatientCvCapture`  
- Allowlist `single-leg-stance` on POST `/api/patient/cv-session-metrics`  
- Hold metrics in `useCvSessionCapture`  
- Clinician card: hold, longest hold, interruption/recovery lines  

**QA**

- Sports Knee Session 6 mobile script  
- Skip-camera regression  

**Pilot**

- 3 sessions: compare assistive hold to clinician stopwatch ±3 s target  

---

### Sprint F — MQE + pilot hardening (≈1 week)

**Engineering**

- MQE rules for single-leg-stance  
- Stability Summary clinician filter  
- Optional `motion_observations` JSONB if interruption persist required  

**Clinical review**

- MQE false-positive review from pilot log  
- Confirm no balance-test language in EN/AR  

**Pilot validation**

- 5+ sessions; target ≥ 60% within ±20% of prescribed hold with fair+ visibility (framework Phase B exit gate)  

---

### File impact assessment (future — not in this doc track)

| File | Change |
|------|--------|
| `app/lib/cv/hold-duration-core.ts` | New |
| `app/lib/cv/single-leg-stance-detector.ts` | New |
| `app/lib/cv/exercises/single-leg-stance.config.ts` | New |
| `app/lib/cv/cv-patient-config.ts` | Allowlist entry |
| `app/components/patient/cv/PatientCvCapture.tsx` | Leg selector + hold UI |
| `app/api/patient/cv-session-metrics/route.ts` | Allowlist + hold validation |
| `app/lib/mqe/derive-mqe-observation.ts` | Hold-class MQE rules |
| `app/components/clinician/cv/CvReviewSummary.tsx` | Hold + interruption lines |
| `supabase/migrations/00X_motion_observations.sql` | Optional JSONB |

---

## 19. Success criteria (production readiness)

| Criterion | Target |
|-----------|--------|
| STS / Mini Squat regression | Zero behavior change on existing golden tests |
| Hold agreement (pilot) | ≥ 60% sessions within ±20% of prescribed hold (framework Phase B gate); aspire ±3 s on 30 s target |
| Interruption sanity | Count correlates with intentional foot-down in scripted tests |
| Tracking stability | ≥ 50% sessions good or fair visibility |
| Save reliability | CV row when accumulated hold ≥ 3 s and movement_detected |
| Patient safety | No balance score / fall / coaching copy in portal |
| Clinician usability | ≥ 3.5/5 pilot feedback |
| MQE false positives | Tune if > 40% review-suggested flags dismissed as noise |
| Regulatory | “Not a clinical balance test” on all surfaces; no patient AI |

---

## 20. Final recommendation

### Single-Leg Stance should lead Phase B (before Tandem Stance)

| Dimension | Justification |
|-----------|---------------|
| Clinical value | Core balance dose; 4/12 Sports Knee sessions; ankle/hip programs |
| Engineering | Defines hold metric class; tandem reuses core with bilateral config |
| Safety | Assistive hold + interruption counts — no balance scoring |
| Sequencing | After Phase A rep-class CV proven; before heel raise (Phase C) side-camera complexity |

**Next step after doc approval:** Commit docs-only when explicitly approved → Phase A exit gate PASS → Sprint D engineering.

---

## Document control

| Field | Value |
|-------|-------|
| Track ID | SINGLE-LEG-STANCE-CV-SPEC-0 |
| File | `docs/cv-roadmap/single-leg-stance-cv-spec.md` |
| RASQ code impact | **None** |
| Commit | **Awaiting approval** — do not commit until explicitly approved |
| Implementation | **Deferred** — Phase B after Phase A exit gate |
