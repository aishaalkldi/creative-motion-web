# RASQ Motion-Trackable Rehabilitation Framework

**Track:** RASQ-MOTION-TRACKABLE-FRAMEWORK-0  
**Status:** Documentation / design only — **not implemented**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Product:** RASQ by Creative Motion Lab  

**Related docs:** `docs/programs/program-library-index.md` · `docs/programs/sports-knee-foundation.md` · `docs/mqe/MQE-0-movement-completion-analysis.md` · `docs/mqe/MQE-0-safety-language.md` · `docs/pilot/known-limitations.md`

**RASQ code impact:** None in this track. No app, API, schema, or production CV logic changes.

---

## 1. Core principle

RASQ camera assist is **not** general exercise tracking. It is a **Motion-Trackable Rehabilitation Framework** — a curated set of standing, home-friendly movements that a **single smartphone camera** can observe reliably enough to produce **assistive derived metrics** for **clinician review**.

### A movement is trackable in RASQ only if it meets **all** criteria:

| Criterion | Meaning |
|-----------|---------|
| **Standing** | Patient upright; supine, prone, and seated-only exercises stay **manual-only** unless a standing variant exists |
| **Camera visible** | Hips, knees, and/or ankles can remain in frame from one fixed phone position without constant repositioning |
| **Repeatable** | Discrete reps or bounded holds — not open-ended ambulation across a room |
| **Home-friendly** | No lab equipment, markers, or second person required; minimal setup (chair, step, wall) |
| **Clinically interpretable** | A licensed clinician can relate saved metrics to prescribed dose and session context — not autonomous clinical judgment |
| **Reliable from one smartphone** | MediaPipe-class pose landmarks produce stable signals in typical home lighting at 2–3 m framing |

### What this framework is

- **Camera-assisted** movement metrics for therapist-guided rehabilitation  
- **Optional** at every exercise — manual completion always valid  
- **Derived counts, durations, and observation patterns** — not video, not landmarks stored  
- **Clinician review suggested** — not treatment automation  

### What this framework is not

- A fitness rep-counter or form-coaching app  
- A diagnosis, scoring, or progression engine  
- Return-to-sport clearance or movement quality grading for patients  
- A replacement for in-clinic examination  

**Design rule:** If an exercise fails any criterion above, it remains **manual-only** until a standing, visible, repeatable variant is certified.

---

## 2. Tier 1 — Certified camera-ready exercises

Tier 1 exercises are **approved for RASQ CV roadmap consideration**. Certification means the exercise **can** be implemented with defined camera geometry and metric class — not that all are shipped today.

| # | Exercise | `exerciseId` (target) | Metric class | Production status |
|---|----------|----------------------|--------------|-------------------|
| 1 | **Sit-to-Stand** | `sit-to-stand` | Rep count | **Live** (optional assist) |
| 2 | **Mini Squat** | `mini-squat` | Rep count | Planned — Phase A |
| 3 | **Double Heel Raise** | `heel-raise` | Rep count | Planned — Phase C |
| 4 | **Single-Leg Stance** | `single-leg-stance` | Hold duration | Planned — Phase B |
| 5 | **Tandem Stance** | `tandem-stance` | Hold duration | Planned — Phase B |
| 6 | **March in Place** | `march-in-place` | Rep count (alternating) | Planned — Phase B+ |
| 7 | **Functional Reach** | `functional-reach` | Reach / excursion estimate | Planned — Phase E |
| 8 | **Lateral Step** | `lateral-step` | Rep count | Planned — Phase D+ |
| 9 | **Step-Up** | `step-up` | Rep count (per leg) | Planned — Phase D |
| 10 | **Box Squat** | `box-squat` | Rep count | Planned — Phase A extension |

**Note:** Tier 1 is a **framework catalog**. Supine activation exercises (quad set, heel slide, SLR, etc.) are **explicitly excluded** — they remain manual-only in all foundation programs.

---

## 3. Exercise priority table

Priority reflects **clinical value × technical feasibility × program fit** for RASQ pilot and Sports Knee–class programs. Difficulty is **engineering + reliability** risk, not patient difficulty.

| Exercise | Priority | Difficulty | Camera position | Primary metric type | Implementation phase |
|----------|----------|------------|-----------------|----------------------|----------------------|
| Sit-to-Stand | **P0** | Low | Front sagittal, 2–3 m, hips + chair visible | Rep count | **Live** (STS-CV-1 stabilize) |
| Mini Squat | **P1** | Low–medium | Same as STS — front sagittal, full lower body | Rep count | **Phase A** |
| Box Squat | **P2** | Low–medium | Same as mini squat; box/chair behind optional | Rep count | **Phase A** (after mini squat) |
| Single-Leg Stance | **P1** | Medium | Front sagittal, full body, support hand visible | Hold duration | **Phase B** |
| Tandem Stance | **P2** | Medium | Front sagittal, feet visible if possible | Hold duration | **Phase B** |
| March in Place | **P3** | Medium | Front sagittal, hips + knees | Rep count (alternating) | **Phase B+** |
| Double Heel Raise | **P3** | Medium–high | **Side or 45° profile preferred**; front view fallback with reduced confidence | Rep count | **Phase C** |
| Step-Up | **P4** | High | Front or 45°; step edge visible | Rep count per leg | **Phase D** |
| Lateral Step | **P4** | High | Front view; lateral displacement subtle | Rep count | **Phase D+** |
| Functional Reach | **P5** | High | Front sagittal; arm + trunk excursion | Range / reach estimate | **Phase E** |

### Priority legend

| Code | Meaning |
|------|---------|
| **P0** | Production — stabilize and validate before expanding |
| **P1** | Next ship candidates after P0 PASS |
| **P2** | Same phase family as P1; ship after P1 pilot data |
| **P3–P5** | Deferred until balance/rep foundation proven |

---

## 4. Universal metrics

Universal metrics apply to **all** Tier 1 exercises. They map to existing or planned `cv_session_metrics` fields where noted.

| Metric | Definition | Patient sees | Clinician sees | Storage (current) |
|--------|------------|--------------|----------------|-------------------|
| **Session duration** | Wall-clock time camera tracking was active for one exercise attempt | Optional (“Session duration: MM:SS”) | Duration column | `session_duration_s` |
| **Exercise duration** | Prescribed dose time (e.g. hold 30 s) vs tracked time — context for holds | Hold timer during assist | Prescribed vs tracked comparison | Derived / MQE read-time |
| **Rep count** | Assistive count of discrete movement cycles | “Reps counted: N” | Rep count + footer disclaimer | `rep_count` |
| **Hold duration** | Continuous time in stable single- or tandem-stance phase | “Hold tracked: MM:SS” | Hold seconds vs prescribed | Phase B: `session_duration_s` primary; optional `metric_kind` later |
| **Completion observation** | Rules-based session pattern (completed, under target, manual path) | **Never** | MQE clinician lines | Read-time MQE (no schema v0) |
| **Tracking quality** | Session-level landmark visibility summary — **not** movement quality | Tracking signal (Good / Fair / Weak) | Good / Fair / Limited camera visibility | `tracking_quality` |

**Universal rule:** Manual completion without camera is **neutral** — never penalized in MQE or patient UX.

---

## 5. Motion metrics

Motion metrics are **assistive derivatives** for clinician context. They are **not** clinical scores and **not** shown as grades to patients in v0.

| Metric | Definition | Feasibility | Clinician-facing language |
|--------|------------|-------------|---------------------------|
| **Tempo** | `session_duration_s / rep_count` when reps > 0 | High for rep exercises | “Estimated average ~{n}s per rep · assistive estimate only” |
| **Movement consistency** | Session-level variance of rep intervals or cycle amplitude (in-memory → optional aggregate) | Medium — research phase | “Movement consistency: variable · review suggested” (never “inconsistent form”) |
| **Range estimate** | Normalized hip/knee excursion proxy vs baseline — **not** goniometry | Medium for squat/STS; low confidence | “Range estimate: assistive only · not ROM measurement” |
| **Symmetry trend** | Left vs right rep counts or hold times across sets (step-up, march) | Medium — requires per-side tracking | “Side-to-side count difference noted · review suggested” |

**Forbidden patient copy:** depth score, form rating, “good squat,” performance rank.

**MQE integration:** Tempo and under-target are **Phase 1 read-time** observations. Consistency, range, and symmetry are **Phase 2+** and require pilot calibration before clinician copy is locked.

---

## 6. Stability metrics

Stability metrics apply primarily to **balance-class** exercises (Single-Leg Stance, Tandem Stance) and optionally to functional tasks.

| Metric | Definition | Signal source | Safety framing |
|--------|------------|---------------|----------------|
| **Balance interruptions** | Detected foot down, support grab, or large sway event ending hold phase | Ankle/hip variance spikes, pose loss | “Balance interruption detected · review suggested” — not fall prediction |
| **Recovery steps** | Steps taken after interruption before hold restarts | Foot landmark displacement | Assistive count only; not gait analysis claim |
| **Weight shift indicators** | Pelvis center X drift during hold or lateral step | Hip midpoint lateral position | “Weight shift observed · review suggested” — not valgus diagnosis |

**Critical boundary:** RASQ **does not** detect falls, predict fall risk, or replace clinical balance testing (e.g. BESS, mCTSIB). Stability metrics are **session observation aids** only.

---

## 7. Clinician dashboard model

The clinician dashboard presents CV output as **review-oriented summaries** — not autonomous clinical decisions. English only per platform policy.

### 7.1 Motion Summary

**Purpose:** Assistive rep and duration context per patient portal session.

| Element | Content |
|---------|---------|
| Exercise name | From exercise library |
| Date / session link | Plan session reference |
| Metric type | Reps **or** hold time |
| Value | Count or duration |
| Session duration | Tracking window |
| Tracking signal | Good / Fair / Limited camera visibility |
| Movement detected | Yes / No |
| Footer | “Rep count is an assistive movement metric…” |

**Location:** Patient profile → **Movement tracking sessions** (existing section).

### 7.2 Stability Summary

**Purpose:** Balance-assist context when Phase B ships.

| Element | Content |
|---------|---------|
| Hold tracked vs prescribed | e.g. “~22s of 30s prescribed” |
| Interruption count | If detected |
| Tracking signal | Visibility only |
| Disclaimer | Not a clinical balance test |

**Location:** Same Movement tracking card — tagged `metric_class: hold` or exercise filter “Balance assist”.

### 7.3 Therapist Notes

**Purpose:** Human-authored context — **not** generated by CV.

| Source | Use |
|--------|-----|
| Clinician chart / plan notes | Precautions, surgical protocol |
| Session log `notes` | Patient-reported context |
| AI Clinician Summary v0/v1 | Optional draft — clinician-only, disclaimer required |

CV metrics **never** overwrite therapist notes or auto-insert treatment changes.

### 7.4 Review Suggested

**Purpose:** MQE rules-based prompts — composite, explainable, dismissible by clinician action (acknowledge in chart).

| Trigger examples | Clinician line |
|------------------|----------------|
| Under prescribed reps/hold | “Completion pattern: below prescribed target · review suggested” |
| Low visibility | “Camera visibility: limited · review suggested” |
| No movement detected | “No movement detected during tracking · review suggested” |
| Short tracking duration | “Short tracking duration · review suggested” |
| CV without session log | Data integrity edge |

**Rule:** “Review suggested” is always **optional follow-up** — not an alert that changes the plan.

---

## 8. Product roadmap

Phases are **sequential gates**. Each phase requires pilot evidence before the next begins.

### Phase A — STS-CV-1 + Mini Squat CV

| Item | Detail |
|------|--------|
| **Goal** | Stabilize Sit-to-Stand on Sports Knee Session 4; ship Mini Squat as first new exercise |
| **Exercises** | Sit-to-Stand (validate), Mini Squat; optional Box Squat extension |
| **Metrics** | Rep count, duration, tracking quality, movement detected, MQE tempo/under-target |
| **Programs** | Sports Knee Foundation (sessions 4–5, 7, 8, 10, 12) |
| **Exit gate** | Mobile STS PASS; 5+ mini-squat pilot sessions; STS regression green; MQE on production |

### Phase B — Balance CV: Single-Leg Stance + Tandem Stance

| Item | Detail |
|------|--------|
| **Goal** | Introduce **hold-duration** metric class; expand “CV-guided program” beyond reps |
| **Exercises** | Single-Leg Stance, Tandem Stance |
| **Metrics** | Hold duration, interruptions, tracking quality |
| **Programs** | Sports Knee, Balance & Stability track |
| **Exit gate** | Hold time within ±20% of prescribed in 60% of sessions with fair+ visibility |

### Phase C — Heel Raise CV

| Item | Detail |
|------|--------|
| **Goal** | Ankle-region rep assist with explicit **side/45° setup** guidance |
| **Exercises** | Double Heel Raise (`heel-raise`) |
| **Metrics** | Rep count; visibility may be lower — document limitations |
| **Programs** | Knee / Ankle foundation accessory blocks |
| **Exit gate** | Clinician usefulness ≥3/5; false rep rate documented |

### Phase D — Step-Up CV

| Item | Detail |
|------|--------|
| **Goal** | Unilateral functional loading with per-leg rep context |
| **Exercises** | Step-Up; Lateral Step deferred to D+ if needed |
| **Metrics** | Rep count per leg, symmetry trend (clinician-only) |
| **Programs** | Sports Knee sessions 6, 7, 9, 11 |
| **Exit gate** | 15+ combined Phase A+B pilot rows; step visibility acceptable |

### Phase E — Functional Reach CV

| Item | Detail |
|------|--------|
| **Goal** | Reach excursion estimate for balance / aging programs |
| **Exercises** | Functional Reach |
| **Metrics** | Normalized reach proxy — **not** validated reach test replacement |
| **Programs** | Active Aging, Balance & Stability |
| **Exit gate** | Research/feasibility framing approved; clinician copy review |

**Explicitly not on roadmap until re-certified:** supine exercises, lateral band walk (front-camera unreliable), walking tolerance (duration-only manual), running, jumping, sport-specific drills.

---

## 9. Program mapping

Framework tiers map to **Motion Foundation** program families — clinician-assigned templates, not auto-prescribed tracks.

### Knee Motion Foundation

**Example:** Sports Knee Foundation (`sports-knee-foundation`)

| Phase | Sessions | Manual-only | Optional CV assist |
|-------|----------|-------------|-------------------|
| Week 1 activation | 1–3 | Quad set, heel slide, TKE, SLR | — |
| Week 2 functional intro | 4–6 | Heel raise (manual until Phase C) | STS (live), Mini Squat (A), SLS (B) |
| Week 3 load | 7–9 | Walking tolerance | Mini Squat, STS, Step-Up (D) |
| Week 4 integration | 10–12 | — | Mini Squat, STS, SLS, Box Squat |

### Ankle Motion Foundation

| CV candidates | Phase |
|---------------|-------|
| Double Heel Raise | C |
| Single-Leg Stance, Tandem | B |
| Sit-to-Stand (if in hybrid plan) | Live |

Supine/circulation exercises — manual only.

### Hip Motion Foundation

| CV candidates | Phase |
|---------------|-------|
| Mini Squat, Box Squat | A |
| Lateral Step | D+ |
| March in Place | B+ |

### Balance & Stability

| CV candidates | Phase |
|---------------|-------|
| Single-Leg Stance, Tandem Stance | B |
| Functional Reach | E |
| March in Place | B+ |

Primary narrative: **hold duration + stability observations** — not balance scoring.

### Active Aging

| CV candidates | Phase |
|---------------|-------|
| Sit-to-Stand, Mini Squat | A |
| Functional Reach | E |
| Tandem Stance | B |
| March in Place | B+ |

Emphasis: safe home setup, optional camera, clear stop rules, no performance ranking.

---

## 10. Safety boundaries

Locked for all Motion-Trackable exercises and all phases.

### Required

| Boundary | Implementation |
|----------|----------------|
| **No diagnosis** | No injury labels from CV data |
| **No movement quality score to patient** | No form grades, depth scores, or “correct/incorrect” |
| **No automatic progression** | Plan changes require clinician action |
| **No return-to-sport clearance** | No “ready to play” or RTS language |
| **Clinician review only** | MQE and CV cards use “review suggested” |
| **Optional camera** | Skip path + manual completion always valid |
| **No video/landmark storage** | Derived metrics only |
| **Not clinically validated** | Disclaimers on patient consent and clinician cards |
| **Therapist in the loop** | AI Summary, if used, is clinician-only draft |

### Forbidden terms (patient and clinician MQE)

Bad form · poor quality · unsafe movement · ready to progress · movement score · performance rank · diagnosis · clearance · validated outcome

### Approved terms

Camera-assisted · assistive movement metrics · session observation · completion pattern · tracking signal · camera visibility · review suggested · manual completion · assistive estimate only

See `docs/mqe/MQE-0-safety-language.md` for full MQE copy rules.

---

## 11. Final positioning

### Motion Intelligence for Therapist-Guided Rehabilitation

RASQ Motion-Trackable Framework positions Creative Motion Lab as building **motion intelligence infrastructure** for licensed rehabilitation — not autonomous rehab AI.

| Audience | Message |
|----------|---------|
| **Clinicians** | “Optional camera assist counts reps and hold time so you can review adherence and session context faster — you stay in control of every decision.” |
| **Patients** | “Your therapist’s plan comes first. Camera help is optional, counts movement for their review, and never decides your treatment.” |
| **Investors / research** | “Single-camera, on-device pose derivatives with a certified exercise catalog and clinician-in-the-loop observation layer — feasibility and workflow validation, not efficacy claims.” |

**Differentiator vs fitness CV:** Curated **Tier 1 clinical motion catalog**, **MQE completion observations**, **no patient-facing AI**, **no progression automation**, **program-aware dose comparison**.

**Honest limitation:** RASQ measures **visibility-bounded assistive metrics** from one phone — not laboratory motion capture, not diagnosis, not replacement for hands-on examination.

---

## Document control

| Field | Value |
|-------|-------|
| Track ID | RASQ-MOTION-TRACKABLE-FRAMEWORK-0 |
| File | `docs/cv-roadmap/RASQ-motion-trackable-rehab-framework.md` |
| RASQ code impact | **None** |
| Commit | **Awaiting approval** — do not commit until explicitly approved |
| Next recommended step | STS Sports Knee Session 4 mobile validation PASS → MINI-SQUAT-CV-0 implementation (separate track) |

---

## Appendix — Tier 1 setup reference (design)

Quick reference for implementers. Values are **starting points** — pilot tuning required.

| Exercise | Setup | Landmarks (primary) |
|----------|-------|---------------------|
| Sit-to-Stand | Seated, chair visible, front camera | Hips, shoulders |
| Mini Squat / Box Squat | Standing, feet shoulder-width, front camera | Hips, knees |
| Double Heel Raise | Side or 45° profile; wall support | Ankles, heels |
| Single-Leg Stance | Front view, support nearby | Stance hip, ankle |
| Tandem Stance | Front view, feet aligned if visible | Ankles, hips |
| March in Place | Front view, knees visible | Knees, hips |
| Functional Reach | Front view, arm raise to horizon | Wrist, shoulder, hip |
| Lateral Step | Front view, step width marked | Hip X, ankles |
| Step-Up | 45° or front, low step visible | Hips, knees, lead ankle |
