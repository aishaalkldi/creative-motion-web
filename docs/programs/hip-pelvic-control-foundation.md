# Hip & Pelvic Control Foundation — RASQ Clinical Program Library v0

**Program ID:** `hip-pelvic-control-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Hip / pelvis  
**Condition category:** MSK rehabilitation (foundation phase)

**Related:** `program-library-index.md` · Exercise Library v1

---

## Program overview

Hip & Pelvic Control Foundation targets **hip stability, glute activation, and lumbopelvic control** for patients with hip-related pain, glute weakness, or pelvic control deficits affecting gait and sport prep. Four weeks, clinician-supervised, **no automatic progression**.

---

## Target users

- Adults with hip/groin/lateral hip symptoms (non-acute)  
- Post-deconditioning active patients  
- Clinician assigns; patient executes home program  

---

## Inclusion criteria

- Clinical exam; no red flags  
- Weight-bearing tolerated  
- Pain with exercise typically ≤ 6/10  
- Can perform supine bridge and standing weight shift  

---

## Exclusion / red flags

- Acute fracture, stress fracture suspected without workup  
- Acute labral tear requiring surgical consult (clinician decision)  
- Progressive groin pain with systemic signs  
- Severe radicular pain / cauda equina symptoms  
- Ante/post-op hip restrictions without protocol alignment  

---

## Clinical goals

1. Activate glute med / max in low-load patterns  
2. Improve hip extension and abduction control  
3. Support lumbopelvic neutral during functional moves  
4. Introduce single-leg tolerance  
5. Optional sit-to-stand functional integration  

---

## Program duration

4 weeks · 3 sessions/week · 12 sessions · 25–40 min each

---

## Levels / phases

| Phase | Week | Focus |
|-------|------|-------|
| 1 | 1 | Breathing, pelvic tilt, glute bridge, supine hip flexion |
| 2 | 2 | Clamshell pattern, lateral band walk, hip hinge education |
| 3 | 3 | Weight shift, sit-to-stand, step-up low |
| 4 | 4 | Single-leg stance, walking tolerance, review |

---

## Session structure

Activation → main strength/control → functional → pain/effort log.

### Key exerciseIds

`diaphragmatic-breathing`, `pelvic-tilt`, `glute-bridge`, `supine-hip-flexion`, `lateral-band-walk`, `hip-hinge`, `piriformis-stretch`, `weight-shift-standing`, `sit-to-stand`, `step-up`, `single-leg-stance`, `walking-tolerance`

---

## Sets / reps / duration ranges

| Type | Range |
|------|-------|
| Activation | 2–3 × 10–12 |
| Bridge / clamshell | 3 × 10–15 |
| Band walk | 2–3 × 10 steps |
| Sit-to-stand | 3 × 8–12 |
| Balance | 3 × 20–30 s |
| Stretch | 2 × 30 s hold |

---

## Pain and effort rules

- Groin sharp pain → stop, contact clinic  
- Lateral hip pain ≤ 5/10 during exercise (default)  
- Effort ≥ 8/10 sustained → review load  
- No exercising through numbness  

---

## Maintain / regress / progress rules

**Clinician-only** decisions. Regress to supine work if symptoms peripheralise to back. Progress when phase exit criteria met on exam + stable logs.

---

## Therapist review checkpoints

Initial assign · session 6 · session 12 · ad hoc flags.

---

## Patient instructions

Move with control; avoid hiking hip during band walks. Sit-to-stand optional camera — counts only. Not sport clearance.

---

## Clinician notes

Differentiate hip vs lumbar source before assign. Related template concepts in `program-templates.ts` hip entries. Supine exercises manual-only.

---

## Outcome measures

Session pain/effort; optional HOOS external; in-clinic hip strength / single-leg squat obs — not in RASQ.

---

## RASQ data fields to track

Session logs, plan completion, optional `cv_session_metrics` if sit-to-stand included in session.

---

## CV role if any

**Optional assistive** for `sit-to-stand` only — not required. No CV on supine exercises.

---

## Manual-only exercises

All except optional sit-to-stand CV: supine, bridge, clamshell, band walk, stretch — **manual-only**.

---

## AI Clinician Summary boundaries

Trends only; no diagnosis of FAI/labral pathology; no progression advice; English clinician output.

---

## MQE future integration

MQE v0 may add completion observations for sit-to-stand sessions (rep vs prescribed, visibility). Read-time clinician-only.

---

## Safety wording

Therapist approval required for progression. Assistive metrics only.

---

## What not to claim

RTS clearance, injury prediction, automatic phase advance, hip pathology diagnosis from RASQ.

---

## Pilot evaluation metrics

Adherence, pain stability, CV opt-in on STS sessions, clinician edit rate, mid-program review completion.

---

## Document control

| RASQ code impact | **None** |
| Commit | **Awaiting approval** |
