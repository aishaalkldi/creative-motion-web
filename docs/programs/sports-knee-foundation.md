# Sports Knee Foundation — RASQ Clinical Program Library v0

**Program ID:** `sports-knee-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Knee  
**Condition category:** Sports / orthopedic rehabilitation (foundation phase)

**Related:** `program-library-index.md` · `docs/pilot/known-limitations.md` · Exercise Library v1 (`exercise-library-v1.ts`)

---

## Program overview

Sports Knee Foundation is a **clinician-assigned, therapist-supervised** four-week foundation program for active individuals with **subacute or chronic knee symptoms** who need structured strength, control, and functional loading before any sport-specific return. It bridges general knee rehabilitation and later sport-specific tracks — **without** providing return-to-sport clearance or autonomous progression.

The program uses RASQ Exercise Library v1 exercise IDs where available. Clinicians **edit dose, order, and exclusions** before assignment. RASQ does not auto-prescribe or auto-progress.

**Pilot framing:** Workflow validation and adherence support — not clinical validation of outcomes.

---

## Target users

| User | Role |
|------|------|
| **Licensed clinician** | Assigns program, reviews sessions, approves any progression |
| **Patient** | Completes home sessions, reports pain/effort, optional sit-to-stand CV assist |
| **Clinic admin / pilot lead** | Tracks operational metrics — not clinical scoring |

**Typical patient profile**

- Age 16–45 (clinician discretion outside range)
- Recreational or club-level athlete, or active adult returning to training
- Subacute/chronic knee pain or post-injury deconditioning (non-acute)
- Cleared for partial or full weight-bearing per clinician examination
- Motivated for structured home exercise with therapist oversight

---

## Inclusion criteria

All require **clinician confirmation** before assignment:

- Clinical examination completed; no unresolved red flags
- Pain during movement typically ≤ 6/10 at program start (clinician-adjustable)
- Able to perform sit-to-stand from standard chair with supervision or independently
- Understands stop rules and pain reporting
- Accepts therapist review requirement for progression

**Common clinical presentations (examples — not diagnoses)**

- Patellofemoral pain / anterior knee pain (irritable, load-tolerant)
- Knee OA — mild/moderate, active population
- Post-ACL reconstruction **foundation** phase (only with surgeon/protocol alignment — clinician sets dose)
- General knee deconditioning after training pause
- Tendinopathy (patellar / quadriceps) in irritable-but-loadable phase

---

## Exclusion / red flags

**Do not assign without medical review / clearance:**

| Category | Examples |
|----------|----------|
| **Structural emergency** | Locked knee, acute fracture suspicion, joint infection |
| **Neurovascular** | Numbness, foot drop, pulse deficit, severe swelling with compartment concern |
| **Weight-bearing** | Non–weight-bearing or touch-down weight-bearing unless protocol explicitly allows |
| **Acute post-op** | < 6 weeks post-op without surgeon-specific protocol |
| **Instability** | Repeated giving way without bracing/supervision plan |
| **Systemic** | Unexplained fever, night pain unrelenting, unexplained weight loss |

**Stop session and contact clinician if patient reports:**

- Sharp pain > 7/10 during exercise
- New giving way or locking
- Rapid swelling within 2 hours of session
- Pain that persists > 24 h significantly above baseline

---

## Clinical goals

1. Restore **voluntary quadriceps activation** and symmetrical extension control  
2. Improve **knee flexion ROM** within pain-free range  
3. Build **closed-chain tolerance** (mini squat, step-up, sit-to-stand)  
4. Improve **single-leg balance** and proprioception for sport readiness prep  
5. Establish **pain/effort reporting habit** and therapist review rhythm  
6. Prepare for clinician-led progression to intermediate/sport-specific track — **not automatic**

---

## Program duration

| Parameter | Value |
|-----------|-------|
| **Total duration** | 4 weeks |
| **Sessions per week** | 3 |
| **Total sessions** | 12 |
| **Estimated session time** | 25–40 minutes (clinician may shorten) |

---

## Levels / phases

### Phase 1 — Activation & ROM (Week 1, Sessions 1–3)

**Focus:** Quad activation, flexion mobility, low-load extension  
**Load:** Open-chain bias, minimal compressive load  
**Exit criteria (clinician review):** Pain stable ≤ 4/10 after sessions; quad set hold ≥ 5 s × 10; heel slide without sharp pain

### Phase 2 — Strength & control (Week 2, Sessions 4–6)

**Focus:** Terminal extension, short-arc quad, bilateral calf, intro sit-to-stand  
**Load:** Mixed open/closed chain  
**Exit criteria:** Sit-to-stand × 8–10 with controlled form; pain not increasing session-to-session

### Phase 3 — Functional loading (Week 3, Sessions 7–9)

**Focus:** Mini squat, step-up, sit-to-stand volume, balance  
**Load:** Closed-chain emphasis  
**Exit criteria:** Mini squat to ~30° without increase in effusion report; step-up low step tolerated

### Phase 4 — Integration & review (Week 4, Sessions 10–12)

**Focus:** Combined session, single-leg stance, walking tolerance, **review for next track**  
**Load:** Highest in program — still foundation, not sport-specific  
**Exit criteria:** Clinician review checkpoint — decide maintain, regress, progress, or discharge from RASQ track

---

## Session structure

Each session follows the same **RASQ session shell**:

1. **Optional CV assist** — sit-to-stand only, patient may skip  
2. **Warm-up / activation** — 1–2 exercises  
3. **Main block** — 2–3 exercises  
4. **Functional / balance** — 1 exercise  
5. **Session complete** — pain (0–10), effort (1–10), optional notes  
6. **Clinician review** — async; not real-time unless clinic policy requires

### Session-by-session exercise map

| Session | Title | Exercises (library `exerciseId`) |
|---------|-------|----------------------------------|
| 1 | Activation I | `quad-set`, `heel-slide`, `terminal-knee-extension` |
| 2 | Activation II | `quad-set`, `short-arc-quad`, `heel-slide` |
| 3 | Extension control | `straight-leg-raise`, `terminal-knee-extension`, `quad-set` |
| 4 | Sit-to-stand intro | `sit-to-stand`, `heel-raise`, `quad-set` |
| 5 | Closed-chain prep | `mini-squat`, `sit-to-stand`, `heel-raise` |
| 6 | Step & balance | `step-up`, `single-leg-stance`, `heel-raise` |
| 7 | Load week 3 | `mini-squat`, `step-up`, `sit-to-stand` |
| 8 | Lateral control | `lateral-band-walk`, `single-leg-stance`, `mini-squat` |
| 9 | Volume | `sit-to-stand`, `step-up`, `walking-tolerance` |
| 10 | Integration I | `mini-squat`, `single-leg-stance`, `sit-to-stand` |
| 11 | Integration II | `step-up`, `lateral-band-walk`, `walking-tolerance` |
| 12 | Review session | `sit-to-stand`, `single-leg-stance`, `mini-squat` |

Clinician may substitute equivalents from library; document in plan notes.

---

## Exercise library

| exerciseId | Name | Phase introduced | Manual / CV |
|------------|------|------------------|-------------|
| `quad-set` | Quad Set / Activation | 1 | Manual |
| `heel-slide` | Heel Slide | 1 | Manual |
| `terminal-knee-extension` | Terminal Knee Extension | 1 | Manual |
| `short-arc-quad` | Short Arc Quad | 2 | Manual |
| `straight-leg-raise` | Straight Leg Raise | 3 | Manual |
| `sit-to-stand` | Sit-to-Stand | 4 | **Optional CV assist** |
| `heel-raise` | Calf Raise | 4 | Manual |
| `mini-squat` | Mini Squat (0–45°) | 5 | Manual |
| `step-up` | Step-Up | 6 | Manual |
| `single-leg-stance` | Single-Leg Stance | 6 | Manual |
| `lateral-band-walk` | Lateral Band Walk | 8 | Manual |
| `walking-tolerance` | Walking Tolerance | 9 | Manual |

---

## Sets / reps / duration ranges

**Default ranges (clinician edits before assign):**

| exerciseId | Sets | Reps / duration | Rest (s) |
|------------|------|-----------------|----------|
| `quad-set` | 3 | 10 holds × 5 s | 30 |
| `heel-slide` | 2–3 | 12–15 | 45 |
| `terminal-knee-extension` | 3 | 10–12 | 45 |
| `short-arc-quad` | 3 | 10 | 45 |
| `straight-leg-raise` | 3 | 8–10 | 45 |
| `sit-to-stand` | 3 | 8–12 | 60 |
| `heel-raise` | 3 | 12–15 | 45 |
| `mini-squat` | 3 | 10–15 | 60 |
| `step-up` | 3 | 8–10 each leg | 60 |
| `single-leg-stance` | 3 | 20–30 s each | 45 |
| `lateral-band-walk` | 2–3 | 10 steps each direction | 60 |
| `walking-tolerance` | 1 | 5–10 min | — |

**Dose adjustment:** Clinician may reduce sets/reps by 30–50% in irritable week 1.

---

## Pain and effort rules

| Rule | Patient-facing (EN / AR optional later) | Clinician interpretation |
|------|----------------------------------------|---------------------------|
| **During exercise** | Stop if sharp pain; stay ≤ 5/10 unless clinician set higher | Rising pain trend → review |
| **After exercise** | Mild soreness ≤ 24 h acceptable if familiar | Pain +2 points × 2 sessions → review |
| **Effort** | Report 1–10 after session | Effort ≥ 8/10 × 3 sessions → review load |
| **Swelling** | Report if knee feels “puffy” after session | May regress phase |

**No automated alerts from pain/effort alone** — flags are review prompts for clinician.

---

## Maintain / regress / progress rules

| Decision | Criteria | Who decides |
|----------|----------|-------------|
| **Maintain** | Stable pain/effort, goals met for phase | Clinician |
| **Regress** | Pain spike, swelling, giving way report, failed exit criteria | Clinician — reduce dose or return to prior phase exercises |
| **Progress** | Phase exit criteria met × 2 sessions; clinician examination | **Clinician only** — may advance phase or assign next program |
| **Discharge from track** | Goals met; patient independent | Clinician |

**RASQ does not auto-maintain, regress, or progress.** Template text suggests review timing only.

---

## Therapist review checkpoints

| Checkpoint | Timing | Clinician actions |
|------------|--------|-------------------|
| **Initial assign** | Before session 1 | Confirm inclusion, edit dose, document precautions |
| **Mid-program** | After session 6 | Review pain/effort trend, adherence, optional CV rows |
| **End foundation** | After session 12 | Decide next track, maintain, or discharge |
| **Ad hoc** | On flag / patient message | Phone or in-clinic review |

**Review prompts (operational — not scores):**

- Pain increased ≥ 2 points over 2 consecutive sessions  
- Effort ≥ 8/10 consistently  
- New locking, giving way, or swelling report  
- Zero sessions completed in 7 days  

---

## Patient instructions

**Program-level (English — Arabic optional in portal later):**

- Complete 3 sessions per week; rest at least 1 day between hard days if sore  
- Move slowly; quality over speed  
- Use sturdy chair for sit-to-stand; optional camera counts reps — **does not judge form**  
- Report pain and effort honestly after each session  
- Contact clinic if stop rules triggered  
- This program does **not** clear you to return to sport — therapist decides  

**Per-exercise:** Use library `patientInstructions` / `patientInstructionsAr` from Exercise Library v1.

---

## Clinician notes

- Align with surgical protocol if post-ACL — this template is **foundation**, not protocol replacement  
- VMO activation pattern before heavy closed-chain loading  
- Consider patellar taping / bracing outside RASQ scope — document in chart  
- `knee-foundation-01` in app templates is a related pilot template; **this spec is the canonical Sports Knee Foundation v0 doc**  
- Clinician dashboard: **English only**  
- Do not use RASQ as sole documentation for medico-legal clearance  

---

## Outcome measures

**For clinician chart / research — not computed as RASQ scores:**

| Measure | Tool | Timing |
|---------|------|--------|
| Pain (NRS) | 0–10 session log | Each session |
| Effort (RPE-style) | 1–10 session log | Each session |
| KOOS / KOOS-PS | Validated questionnaire | Optional — external to RASQ v0 |
| Single-leg hop / RTS tests | Clinic testing | **Not in RASQ** — clinician-led |
| Gait / squat observation | In-clinic | Clinician documentation |

RASQ tracks **operational proxies** only (sessions completed, reps if CV used).

---

## RASQ data fields to track

| Field | Source | Use |
|-------|--------|-----|
| `plan_sessions.status` | DB | Completion |
| `session_logs.pain_score` | Patient portal | Trend context |
| `session_logs.effort_score` | Patient portal | Load monitoring |
| `session_logs.exercises_completed` | Portal | Manual completion count |
| `session_logs.notes` | Patient / coach metadata | Qualitative |
| `cv_session_metrics.rep_count` | Optional CV | Assistive rep context |
| `cv_session_metrics.session_duration_s` | Optional CV | Tempo context (future MQE) |
| `cv_session_metrics.tracking_quality` | Optional CV | Visibility — not quality |
| `cv_session_metrics.movement_detected` | Optional CV | Capture check |
| Clinician review actions | Future / manual | Progression decisions |

---

## CV role if any

| Aspect | Rule |
|--------|------|
| **Eligible exercise** | `sit-to-stand` only |
| **Required?** | **No** — pilot workflow does not depend on camera |
| **Patient sees** | Rep count, duration, tracking signal — **not** movement quality |
| **Clinician sees** | Derived metrics + disclaimer; future MQE completion observations |
| **Purpose** | Assistive context for therapist review |
| **Not** | Form scoring, progression trigger, RTS clearance |

---

## Manual-only exercises

All exercises in this program are **manual completion** except optional **sit-to-stand** CV assist.

Supine exercises (`straight-leg-raise`, `heel-slide`, `short-arc-quad`, `terminal-knee-extension`) — **no CV** in v0.

---

## AI Clinician Summary boundaries

| Allowed | Forbidden |
|---------|-----------|
| Summarize session count, pain/effort trends | Diagnosis or injury labeling |
| Note optional CV rep count as assistive | “Ready for sport” or progression advice |
| English draft with disclaimer | Movement quality judgment |
| Prompt clinician review | Auto plan changes |

AI does **not** ingest MQE labels until explicitly approved.

---

## MQE future integration

When MQE v0 is implemented (read-time, clinician-only):

- Compare sit-to-stand `rep_count` to prescribed reps  
- Flag low camera visibility, short duration, under-target patterns  
- **Review suggested** — not auto-regress/progress  
- Manual completion sessions remain valid  

See `docs/mqe/MQE-0-movement-completion-analysis.md`.

---

## Safety wording

**Required clinician disclaimer (inherit from platform):**

> Derived movement metrics and session observations are assistive only. Not clinically validated. Therapist review required. No automatic treatment decisions.

**Patient consent alignment (CV):**

> Does not judge whether movement is correct or wrong. Does not give diagnosis or automatic progression.

---

## What not to claim

- Return-to-sport clearance or “ready to play”  
- Injury prediction or risk scoring  
- Clinical validation of CV rep accuracy  
- Superior outcomes vs standard care  
- Diagnosis from RASQ data  
- Automatic progression between phases  
- Replacement for surgeon/physio protocol (post-op)  

---

## Pilot evaluation metrics

| Metric | Type | Target (pilot — descriptive) |
|--------|------|------------------------------|
| Assign → start rate | Operational | Document in pilot log |
| Sessions completed / 12 | Adherence | Track per patient |
| CV opt-in rate (sit-to-stand) | Optional feature | % sessions with CV row |
| Pain trend post-session | Safety | No sustained ↑ without review |
| Clinician edit rate before assign | Workflow | % templates edited |
| Time to mid-program review | Process | Days to session 6 review |
| False “review suggested” (MQE future) | Tuning | Clinician feedback form |
| Patient comprehension of stop rules | Qualitative | Activation script |

---

## Document control

| Field | Value |
|-------|-------|
| RASQ code impact | **None** |
| App implementation | **Not started** |
| Commit | **Awaiting approval** |
