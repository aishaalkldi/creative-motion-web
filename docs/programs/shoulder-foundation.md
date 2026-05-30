# Shoulder Foundation — RASQ Clinical Program Library v0

**Program ID:** `shoulder-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Shoulder  
**Condition category:** Orthopedic rehabilitation (foundation phase)

**Related:** `program-library-index.md` · Related pilot template: `shoulder-foundation-01`

---

## Program overview

Shoulder Foundation restores **ROM, scapular control, and rotator cuff endurance** for patients with shoulder pain and functional limitation (non-acute). Four-week graded program — **clinician assigns and approves all progression**.

---

## Target users

- Rotator cuff tendinopathy (irritable, load-tolerant)  
- Subacromial pain / stiffness (non-acute)  
- Post-immobilization deconditioning (with clearance)  
- Clinician-supervised home exercise  

---

## Inclusion criteria

- Exam confirms no red flags  
- Partial ROM with therapist-defined safe arc  
- Pain typically ≤ 6/10 in prescribed arc  
- Able to perform pendulum and scapular setting  

---

## Exclusion / red flags

- Acute dislocation, fracture  
- Full-thickness tear requiring surgical consult (clinician)  
- Acute severe inflammatory phase  
- Suspected infection, tumor, vascular compromise  
- Post-op without protocol  

---

## Clinical goals

1. Restore pain-free passive / assisted ROM  
2. Scapular stabilization  
3. Rotator cuff activation (external rotation, serratus)  
4. Posture and thoracic mobility support  
5. Functional reaching tolerance  

---

## Program duration

4 weeks · 3/week · 12 sessions · 20–35 min

---

## Levels / phases

| Phase | Focus |
|-------|-------|
| 1 | Pendulum, scapular setting, table slide |
| 2 | External rotation, wall slide, cross-body stretch |
| 3 | Internal rotation, prone Y-T-W, serratus punch |
| 4 | Doorway stretch, posture reset, functional reach, review |

---

## Session structure

Mobility → cuff/scapular → integration → pain/effort. **All manual** — no shoulder CV in v0.

### exerciseIds

`pendulum`, `scapular-setting`, `table-slide`, `external-rotation`, `wall-slide`, `cross-body-stretch`, `internal-rotation`, `prone-ytw`, `serratus-punch`, `doorway-pectoral-stretch`, `posture-reset`, `upper-limb-reaching-seated`

---

## Sets / reps / duration ranges

| exerciseId | Dose |
|------------|------|
| Pendulum | 2 × 30 s |
| Scapular setting | 3 × 10–12 |
| Table slide | 2 × 10 |
| ER / IR theraband | 3 × 12–15 |
| Stretches | 2–3 × 20–30 s |
| Prone Y-T-W | 2 × 8 each |

Avoid painful arc loading until clinician clears.

---

## Pain and effort rules

- Stay below sharp pinching in arc  
- Pain ≤ 5/10 in prescribed range  
- Night pain increase → review  
- Effort ≥ 8/10 → review load  

---

## Maintain / regress / progress rules

Regress to pendulum / table slide if irritability increases. **Clinician-only** progression to overhead loading or sport tracks.

---

## Therapist review checkpoints

Assign · session 6 · session 12 · instability/clicking reports.

---

## Patient instructions

Stay in pain-free arc; no forcing overhead. Reach tasks within tolerance. Not sport clearance.

---

## Clinician notes

Differentiate instability vs impingement before ER loading. Supine/prone exercises manual-only. English clinician UI.

---

## Outcome measures

Pain/effort logs; optional DASH / WORC external; in-clinic ROM / strength — not RASQ.

---

## RASQ data fields to track

Session logs, plan completion, notes. No CV.

---

## CV role if any

**None** in v0 (shoulder CV not on allowlist).

---

## Manual-only exercises

**Entire program manual-only** (includes table slide, prone Y-T-W).

---

## AI Clinician Summary boundaries

No tear grading, no surgery recommendation, no RTS. English + disclaimer.

---

## MQE future integration

Not applicable unless sit-to-stand co-prescribed in same session (unusual for shoulder track).

---

## Safety wording

Therapist review required. Assistive platform metrics only if CV ever added in future — not v0.

---

## What not to claim

Rotator cuff diagnosis from app data, automatic progression, return to throwing/sport clearance.

---

## Pilot evaluation metrics

Adherence, painful arc reports, ROM progress documented in clinician chart (external to RASQ).

---

## Document control

| RASQ code impact | **None** |
| Commit | **Awaiting approval** |
