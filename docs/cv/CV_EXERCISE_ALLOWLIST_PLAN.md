# RASQ — CV Exercise Allowlist Expansion Plan

**Document type:** Product and engineering planning — documentation only  
**Status:** Planning foundation; **no CV logic changes in this PR**  
**Last updated:** 2026-06-05  
**Baseline:** STS production-ready for controlled pilot (PR100–104); other exercises experimental in codebase

---

## Purpose

Plan **which rehabilitation exercises** should receive camera-assisted CV support **after Sit-to-Stand**, and in what order. This document guides future implementation PRs without expanding CV to every exercise at once.

**Scope:** Therapist-review-only derived movement observations. **Not** clinical validation, diagnosis, or autonomous treatment.

---

## Why we should not add CV to all exercises at once

| Risk | If CV expands too fast |
|------|------------------------|
| **Pilot confusion** | Clinicians cannot explain which metrics are reliable vs experimental |
| **Support load** | Each exercise needs framing rules, copy, capture quality, clinician review surfaces, and QA |
| **Privacy/consent surface** | More camera paths increase consent and data-flow review burden |
| **False confidence** | Rep counts on poor geometry (rotation, occlusion, speed) look precise but mislead review |
| **Engineering debt** | Shared `PatientCvCapture` factory grows without per-exercise maturity gates |
| **Safety framing drift** | Harder to keep “therapist review only / not diagnostic” consistent across exercises |

**Principle:** One **reference path** (STS), then **sequential hardening** of adjacent exercises with similar camera geometry and landmark needs.

---

## Selection criteria for CV-supported exercises

An exercise is a **candidate** when it meets most of the following:

| Criterion | Requirement |
|-----------|-------------|
| **Sagittal or simple frontal plane** | Single primary movement axis; limited rotation |
| **Stable camera setup** | Phone can be fixed at hip height, 2–3 m away, full lower body or trunk visible |
| **Core landmarks visible** | Shoulders, hips, knees (and ankles or wrists as needed) reliably detectable with MediaPipe |
| **Countable or timed metric** | Reps, cycles, or hold duration — not clinical quality score |
| **Therapist interpretable** | Derived numbers assist review; clinician judges correctness |
| **Low speed** | Controlled clinic/home tempo; not ballistic or sport-speed |
| **Prescribed in Sports Knee / pilot plans** | Already in exercise library and patient portal flow |
| **Manual fallback** | Session completes without camera |

**Disqualifiers:** Jumping, cutting, throwing, full gait path, multi-plane sport drills, supine-only movements, exercises requiring diagnosis labels (“good form” / “bad form”).

---

## Recommended initial allowlist (post-STS pilot)

Phased **product** allowlist for **controlled pilot expansion** (aligned with Sports Knee Foundation priorities):

| Priority | Exercise ID | Role | Current codebase maturity |
|----------|-------------|------|---------------------------|
| **P0 — Reference** | `sit-to-stand` | Primary demo and first clinic pilot | **Production-ready path** (timeline, capture quality, PR101 framing) |
| **P1** | `heel-raise` | First expansion after STS pilot | Motion pilot wired; feature-flagged |
| **P2** | `mini-squat` | Sagittal squat pattern; rep counting | Wired; baseline detector |
| **P3** | `step-up` | Step height context; cycle detection | Motion pilot wired; needs setup QA |
| **P4** | `functional-reach` | Reach cycle; upper-body visibility | Motion pilot wired; experimental |

### In codebase today but deferred for pilot expansion messaging

| Exercise ID | Defer reason |
|-------------|--------------|
| `single-leg-stance` | Hold-time shell; balance-adjacent — expand after sagittal rep exercises prove review workflow |
| `lateral-step` | Lateral plane + width not scored — higher framing ambiguity |

These remain in `CV_Y1_ENABLED_EXERCISE_IDS` for engineering experiments but are **not** in the recommended **pilot expansion** sequence until P1–P4 mature.

---

## Exercises to defer (not in near-term allowlist)

| Category | Examples | Reason |
|----------|----------|--------|
| **Full gait capture** | Walking, 6MWT, TUG with path analysis | Requires locomotion engine, stride metrics, new Assessment Center capture — shell only today |
| **Jumping** | Jump landing, hop tests | High speed, occlusion, injury risk framing |
| **Complex rotation** | Trunk rotation, golf/throw patterns | Landmark stability poor; not sagittal |
| **High-speed sports movements** | Cutting, agility drills | Outside home/pilot setup; not clinically validated |
| **Diagnosis-based movement classification** | “Correct/incorrect form”, pathology labels | Forbidden product boundary |
| **Supine / prone mat work** | Bridges, clamshells on floor | Camera angle and occlusion unsuitable for phone tripod setup |
| **Upper extremity isolation** | Fine hand tasks | Outside lower-body pilot scope |

---

## Per-exercise requirements (planned expansion)

### 1. Sit-to-Stand (P0 — live)

| Dimension | Specification |
|-----------|---------------|
| **Camera angle** | Sagittal; phone at hip height; 2–3 m; full body + chair visible |
| **Required landmarks** | Shoulders, hips, knees (ankles bonus); PR101 coverage module |
| **Basic metrics** | Rep count, session duration, tracking signal, movement detected |
| **Motion pilot** | `smtPilot` — phase ratios, rep timings, visibility %, capture quality |
| **Capture quality** | PR100 scoring; `capture_setup_limited`; limited retest UX |
| **Safety wording** | Camera-assisted movement observation; therapist review; not diagnostic |

### 2. Heel Raise (P1 — first after STS)

| Dimension | Specification |
|-----------|---------------|
| **Camera angle** | Sagittal; feet and ankles in frame; stable support surface visible |
| **Required landmarks** | Hips, knees, ankles; bilateral or single-limb per prescription |
| **Basic metrics** | Rep count (raises), duration, tracking signal |
| **Motion pilot** | `hrPilot` when flag enabled — phase ratios, timings (no heel height score) |
| **Capture quality** | Reuse shared capture quality pattern; feet-visible readiness checks |
| **Safety wording** | No ankle strength score; no height measurement claim; therapist review only |
| **Do not claim** | Heel height, calf strength grade, balance pass/fail |

### 3. Mini Squat (P2)

| Dimension | Specification |
|-----------|---------------|
| **Camera angle** | Sagittal; full lower body; knees and hips visible throughout depth |
| **Required landmarks** | Hips, knees, ankles; shoulders for framing |
| **Basic metrics** | Rep count, duration, tracking signal |
| **Motion pilot** | `msPilot` when enabled — squat phase ratios |
| **Capture quality** | Feet-visible + distance checks; limited setup flag |
| **Safety wording** | Rep assist only; does not judge squat depth correctness |
| **Do not claim** | ROM degrees, knee valgus diagnosis, “good squat” label |

### 4. Step-Up (P3)

| Dimension | Specification |
|-----------|---------------|
| **Camera angle** | Sagittal; step/box in frame; full leg visible on ascent/descent |
| **Required landmarks** | Hips, knees, ankles |
| **Basic metrics** | Cycle/rep count, duration, tracking signal |
| **Motion pilot** | `suPilot` when enabled |
| **Capture quality** | Step surface in frame; setup wizard exercise hints |
| **Safety wording** | Experimental; optional assist; therapist reviews cycles not step height |
| **Do not claim** | Step height measurement, limb symmetry diagnosis |

### 5. Functional Reach (P4)

| Dimension | Specification |
|-----------|---------------|
| **Camera angle** | Sagittal or slight angle; shoulders, trunk, reaching arm visible |
| **Required landmarks** | Shoulders, hips; reach arm wrist/elbow when visible |
| **Basic metrics** | Reach cycle count, duration, tracking signal |
| **Motion pilot** | `frPilot` when enabled |
| **Capture quality** | Upper reach visibility checks (`setupGuidanceReachArmInFrame`) |
| **Safety wording** | No reach distance (cm); no balance grade |
| **Do not claim** | Functional reach distance, fall risk score |

---

## Capture quality requirements (all allowlisted exercises)

Shared minimum bar before promoting an exercise from **experimental** to **pilot-expanded**:

| Requirement | Description |
|-------------|-------------|
| Consent gate | PR103 checkbox + Privacy/Terms (shared) |
| Setup readiness | Exercise-specific checks documented and tested |
| Limited capture path | Amber patient message + retest guidance |
| Clinician limitations | `CaptureQualitySection` or equivalent when pilot record present |
| Forbidden payload keys | No video, landmarks, scores, diagnosis in POST |
| Manual smoke | Per-exercise checklist added to pilot docs |
| Therapist review copy | Assessment Center or profile disclaimer consistent with STS |

---

## Safety wording (standard for all CV exercises)

Use across patient consent, exercise copy, and clinician review:

- **Camera-assisted movement observation**  
- **Supports therapist review**  
- **Not a clinical assessment**  
- **Not diagnostic**  
- **Does not make automatic treatment decisions**  
- **Optional** — continue without camera  
- **Derived metrics only** — no video stored  

Negation bullets (what CV does **not** do) remain in consent gate per PR103.

---

## What not to claim (any exercise)

| Forbidden claim | Why |
|-----------------|-----|
| Diagnosis or pathology label | Platform boundary |
| Clinical score or pass/fail grade | No validated scoring engine |
| Automatic progression or plan change | Clinician assigns plans |
| Movement “correctness” judgment | Not form-quality AI |
| Distance/ROM in cm unless validated | Not metrology-grade |
| Comparison to normative population | No normative database in pilot |
| Replacement for in-person examination | Known limitation |

---

## Implementation phases

### Phase 0 — Complete (do not re-implement)

- STS reference path: detector, timeline, capture quality, consent, Assessment Center review  
- Controlled STS pilot plan (PR106)  
- PDPL readiness docs (PR105)  

### Phase 1 — Controlled STS pilot (operational)

- Run `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md`  
- Go/no-go before code expansion  

### Phase 2 — Heel Raise hardening (recommended first code PR after STS go)

- Promote from motion-pilot experimental to **pilot-expanded** messaging  
- Per-exercise manual smoke + capture quality alignment with STS patterns  
- Clinician review copy audit  
- Optional: Assessment Center filter card (if metrics volume warrants)  

### Phase 3 — Mini Squat hardening

- Motion pilot record maturity; framing/readiness parity with STS where applicable  
- Pilot doc updates  

### Phase 4 — Step-Up hardening

- Setup hints for step surface; cycle clarity flags  
- Limited-capture retest validation  

### Phase 5 — Functional Reach hardening

- Reach-arm framing; experimental label until smoke complete  

### Phase 6 — Re-evaluate deferred exercises

- `single-leg-stance` (hold metrics)  
- `lateral-step` (lateral plane)  
- Only after P1–P5 pilot feedback  

### Phase 7 — Gait (separate track)

- Not allowlist expansion — requires **Gait capture foundation** PR series and Assessment Center live capture  

---

## Recommended first exercise after STS

**Heel Raise (`heel-raise`)** — Priority P1

| Factor | Rationale |
|--------|-----------|
| Geometry | Sagittal ankle/knee motion similar to STS camera setup |
| Infrastructure | Detector and `hrPilot` record already wired behind feature flag |
| Metric clarity | Discrete rep count — therapist can sanity-check against observation |
| Risk | Lower than step-up (no prop height claims) or functional reach (no reach distance) |
| Pilot narrative | Natural progression in knee/ankle rehabilitation programs |

**Gate:** Proceed with Heel Raise hardening PR only after **STS controlled pilot go** decision (PR106 matrix).

**Second:** Mini Squat — already has baseline wiring; sagittal rep pattern.

---

## Relationship to codebase allowlist

Current `CV_Y1_ENABLED_EXERCISE_IDS` in `app/lib/cv/cv-patient-config.ts` includes seven exercises. This plan **does not change code**. It defines:

- **Pilot messaging allowlist** (5 exercises for expansion narrative)  
- **Engineering sequence** (STS → heel-raise → mini-squat → step-up → functional-reach)  
- **Deferred exercises** (gait, sport, rotation, diagnosis classification, SLS/lateral-step for later phases)  

Future PRs may align feature flags and docs with this plan; no allowlist code change in PR107.

---

## Related documents

- `docs/RASQ_CURRENT_STATE.md` — Platform CV maturity table  
- `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md` — First STS clinic pilot  
- `docs/pilot/sts-pilot-qa-validation.md` — STS technical QA  
- `docs/compliance/DATA_FLOW_MAP.md` — Stored vs not stored  
- `docs/pilot/known-limitations.md` — Clinician briefing  

---

## Safety reminder

All CV-supported exercises produce **derived movement observations for therapist review only**. Expand allowlist slowly to preserve trust, privacy posture, and supportable pilot claims.
