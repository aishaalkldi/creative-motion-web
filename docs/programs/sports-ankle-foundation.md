# Sports Ankle Foundation — RASQ Clinical Program Library v0

**Program ID:** `sports-ankle-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Ankle  
**Condition category:** Sports / orthopedic rehabilitation (foundation phase)

**Related:** `program-library-index.md` · Exercise Library v1

---

## Program overview

Sports Ankle Foundation is a **four-week, clinician-assigned** program for active individuals recovering from **subacute lateral ankle sprains**, chronic ankle instability (mild), or deconditioning after sport pause. Focus: ROM, peroneal/calf strength, proprioception, and return-to-walking/running prep — **without** return-to-sport clearance or autonomous progression.

---

## Target users

- Recreational athletes and active adults with ankle symptoms tolerating weight-bearing  
- Licensed clinician assigns and reviews all progression  
- Patient completes home sessions with pain/effort reporting  

---

## Inclusion criteria

- Clinical exam confirms no red flags; partial or full weight-bearing  
- Pain with activity typically ≤ 6/10 at start  
- ≥ 2 weeks post acute sprain (or chronic instability — clinician judgment)  
- Able to perform ankle pumps and short walks  

---

## Exclusion / red flags

- Suspected fracture, high-grade sprain requiring immobilization without clearance  
- Unable to weight-bear  
- Severe ligament rupture pending surgical decision  
- Neurovascular compromise, infection, DVT signs  
- Repeated giving way without supervision plan  

**Stop rules:** Sharp pain, new numbness, inability to bear weight after session.

---

## Clinical goals

1. Restore comfortable ankle ROM (dorsiflexion / eversion emphasis)  
2. Strengthen calf and peroneals  
3. Improve single-leg balance and proprioception  
4. Progress walking tolerance toward sport prep  
5. Establish therapist review rhythm  

---

## Program duration

| Parameter | Value |
|-----------|-------|
| Duration | 4 weeks |
| Sessions/week | 3 |
| Total sessions | 12 |
| Session time | 20–35 min |

---

## Levels / phases

| Phase | Weeks | Focus |
|-------|-------|-------|
| **1 — Mobility** | 1 | Pumps, circles, gentle ROM, heel raises seated |
| **2 — Strength** | 2 | Theraband DF/Eversion, bilateral calf raises, weight shift |
| **3 — Balance** | 3 | Single-leg stance, supported SLS, heel-to-toe supported |
| **4 — Integration** | 4 | Step-up low, walking tolerance, review |

Exit each phase via **clinician review** — not automatic.

---

## Session structure

1. ROM / activation (2 exercises)  
2. Strength (1–2)  
3. Balance or walking (1)  
4. Pain / effort log  
5. Optional: none use CV in v0  

### Exercise map (by phase)

| Phase | exerciseId examples |
|-------|---------------------|
| 1 | `heel-slide` (pumps alias), `theraband-ankle-dorsiflexion`, `heel-raise` |
| 2 | `theraband-ankle-eversion-inversion`, `heel-raise`, `weight-shift-standing` |
| 3 | `supported-single-leg-stance`, `single-leg-stance`, `heel-toe-walking-supported` |
| 4 | `step-up`, `walking-tolerance`, `single-leg-stance` |

---

## Exercise library

| exerciseId | Manual / CV |
|------------|-------------|
| `theraband-ankle-dorsiflexion` | Manual |
| `theraband-ankle-eversion-inversion` | Manual |
| `heel-raise` | Manual |
| `weight-shift-standing` | Manual |
| `supported-single-leg-stance` | Manual |
| `single-leg-stance` | Manual |
| `heel-toe-walking-supported` | Manual |
| `step-up` | Manual |
| `walking-tolerance` | Manual |

**CV role:** None in v0 (no ankle CV exercise allowlist).

---

## Sets / reps / duration ranges

| exerciseId | Sets | Reps / duration | Rest |
|------------|------|-----------------|------|
| Theraband exercises | 3 | 12–15 | 45 s |
| `heel-raise` | 3 | 15 | 45 s |
| `single-leg-stance` | 3 | 20–30 s each | 45 s |
| `walking-tolerance` | 1 | 5–15 min | — |
| `step-up` | 3 | 8 each leg | 60 s |

---

## Pain and effort rules

- Stay ≤ 5/10 during exercise unless clinician sets otherwise  
- Stop if sharp lateral ankle pain or giving way  
- Effort ≥ 8/10 × 3 sessions → clinician review  
- Pain +2 points over 2 sessions → review  

---

## Maintain / regress / progress rules

| Action | Trigger | Authority |
|--------|---------|-----------|
| Maintain | Stable symptoms | Clinician |
| Regress | Pain/swelling increase, failed balance | Clinician — reduce band resistance / hold time |
| Progress | Phase exit + exam | **Clinician only** |
| Discharge | Goals met | Clinician |

**No automatic progression in RASQ.**

---

## Therapist review checkpoints

- Before assign  
- After session 6 (mid-program)  
- After session 12 (end foundation)  
- Ad hoc on flags  

---

## Patient instructions

- Wear supportive footwear; use theraband as prescribed  
- Balance near wall or counter  
- Report giving way immediately  
- Program does not clear return to sport  
- Arabic instructions: use library `patientInstructionsAr` when portal supports  

---

## Clinician notes

- Align with Ottawa / imaging findings outside RASQ  
- Related app template: `ankle-foundation-01` (pilot) — this doc is canonical v0 spec  
- Taping/bracing decisions outside platform  
- English-only clinician dashboard  

---

## Outcome measures

- NRS pain / effort (session log) — in RASQ  
- FAAM / CAIT — optional external questionnaires  
- Star excursion balance test — in-clinic only  
- Return to run criteria — **clinician / clinic protocol**, not RASQ  

---

## RASQ data fields to track

`plan_sessions.status`, `session_logs.pain_score`, `session_logs.effort_score`, `session_logs.exercises_completed`, `session_logs.completed_at`, clinician assignment edits (manual audit).

**No CV fields** for this program in v0.

---

## CV role if any

**None.** Ankle exercises are manual-only. Sit-to-stand CV is not part of this program.

---

## Manual-only exercises

**All exercises manual-only** in v0.

---

## AI Clinician Summary boundaries

May summarize adherence and pain/effort trends. Must not diagnose sprain grade, predict reinjury, or recommend RTS. English only; disclaimer required.

---

## MQE future integration

Not applicable to ankle program until exercise-specific CV exists. If sit-to-stand appears in hybrid plans, MQE applies only to STS rows.

---

## Safety wording

Use platform CV/clinical disclaimers where relevant. Emphasize **therapist review required** for all progression.

---

## What not to claim

- Return-to-sport clearance  
- Reinjury prediction  
- Automatic progression  
- Diagnosis from session data  
- CV-based movement quality (N/A)  

---

## Pilot evaluation metrics

- Completion rate (sessions / 12)  
- Pain trend stability  
- Time to clinician mid-program review  
- Template edit rate at assign  
- Patient-reported giving-way events (notes field)  

---

## Document control

| Field | Value |
|-------|-------|
| RASQ code impact | **None** |
| Commit | **Awaiting approval** |
