# Low Back Foundation — RASQ Clinical Program Library v0

**Program ID:** `low-back-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Lumbar  
**Condition category:** MSK rehabilitation (foundation phase)

**Related:** `program-library-index.md` · Related pilot template: `lumbar-foundation-01`

---

## Program overview

Low Back Foundation is a **conservative four-week program** for non-specific and mechanical low back pain without red flags. Emphasizes breathing, mobility, core activation, and hip hinge education — **clinician-directed**, no autonomous loading progression.

---

## Target users

- Adults with subacute/chronic LBP tolerating independent mobility  
- Desk workers and active adults returning to movement  
- Clinician assigns after exam  

---

## Inclusion criteria

- No red flags (see below)  
- Independent ambulation  
- Pain typically ≤ 6/10 with movement  
- Understands stop rules  

---

## Exclusion / red flags

- Cauda equina symptoms (**emergency — do not assign**)  
- Progressive neurological deficit  
- Suspected fracture, malignancy, infection  
- Severe constant night pain  
- Bladder/bowel dysfunction  

**Stop session:** New leg pain below knee, numbness, or symptom peripheralisation.

---

## Clinical goals

1. Reduce symptom irritability through graded movement  
2. Restore lumbar/hip mobility within tolerance  
3. Build core endurance (dead bug, bird dog)  
4. Teach hip hinge and neutral spine awareness  
5. Improve walking tolerance  

---

## Program duration

4 weeks · 3/week · 12 sessions · 20–35 min

---

## Levels / phases

| Phase | Focus |
|-------|-------|
| 1 | Breathing, pelvic tilt, cat-cow |
| 2 | Dead bug, glute bridge, bird dog |
| 3 | Hip hinge, side plank intro, walking |
| 4 | Integration, prone press-up (if extension bias approved), review |

---

## Session structure

Warm-up mobility → activation → functional → pain/effort. **All manual** — no CV.

### exerciseIds

`diaphragmatic-breathing`, `pelvic-tilt`, `cat-cow`, `dead-bug`, `glute-bridge`, `bird-dog`, `hip-hinge`, `side-plank`, `prone-press-up`, `walking-tolerance`

**Supine exercises (`dead-bug`, `pelvic-tilt`) — manual-only per platform rule.**

---

## Sets / reps / duration ranges

| exerciseId | Typical dose |
|------------|--------------|
| Breathing | 5–10 min or 10 cycles |
| Mobility | 2 × 10 slow reps |
| Core (dead bug, bird dog) | 3 × 8–10 |
| Bridge | 3 × 10–12 |
| Side plank | 3 × 15–30 s |
| Walking | 5–15 min |

Clinician adjusts for flexion vs extension bias.

---

## Pain and effort rules

- Pain should not peripheralise to leg during session  
- Stay ≤ 5/10 during exercise (default)  
- Post-exercise soreness ≤ 24 h if familiar  
- Effort ≥ 8/10 → review  

---

## Maintain / regress / progress rules

Regress if leg symptoms emerge. **McKenzie / directional preference** applied by clinician outside RASQ automation. Progress only after clinician review.

---

## Therapist review checkpoints

Assign · session 6 · session 12 · ad hoc if leg symptoms.

---

## Patient instructions

Breathe steadily; avoid bouncing stretches. Stop if leg pain. Program not a substitute for emergency care.

---

## Clinician notes

Assess flexion vs extension tolerance before prone press-up. English-only clinician UI. Do not auto-select extension exercises.

---

## Outcome measures

Pain/effort logs; optional ODI / NPRS external; in-clinic SLR / repeated movement testing — clinician chart.

---

## RASQ data fields to track

`session_logs`, `plan_sessions`, no CV for this program.

---

## CV role if any

**None.** Low back program is fully manual in v0.

---

## Manual-only exercises

**Entire program manual-only** (includes all supine work).

---

## AI Clinician Summary boundaries

May note session adherence and pain trend. Must not diagnose disc herniation, recommend surgery, or advise progression.

---

## MQE future integration

Not applicable (no sit-to-stand CV in standard low back track).

---

## Safety wording

Red-flag education mandatory at assign. Therapist review for any progression.

---

## What not to claim

Cure LBP, imaging interpretation, automatic exercise progression, replacement for emergency care.

---

## Pilot evaluation metrics

Completion rate, peripheralisation reports in notes, clinician directional preference documentation rate (manual).

---

## Document control

| RASQ code impact | **None** |
| Commit | **Awaiting approval** |
