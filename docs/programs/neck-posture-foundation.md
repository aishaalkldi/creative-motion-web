# Neck & Posture Foundation — RASQ Clinical Program Library v0

**Program ID:** `neck-posture-foundation`  
**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  
**Body region:** Cervical  
**Condition category:** MSK rehabilitation (foundation phase)

**Related:** `program-library-index.md` · Related pilot template: neck foundation concepts in `program-templates.ts`

---

## Program overview

Neck & Posture Foundation addresses **non-specific neck pain**, postural neck discomfort, and upper-quarter stiffness in patients **without significant radiculopathy**. Graded mobility, deep cervical flexor activation, scapular setting, and postural awareness — **clinician-supervised only**.

**Future sensor note (deferred):** Q-Motion / Q-Line cervical posture sensing is documented under `docs/hardware/` as **future research** — **not part of RASQ v0**, not available to patients or clinicians in pilot.

---

## Target users

- Office workers, drivers, students with neck discomfort  
- Subacute/chronic neck pain after clinician exam  
- No acute whiplash < 72 h without clearance  

---

## Inclusion criteria

- Non-specific or postural neck pain  
- No progressive neurological signs  
- ROM exercises tolerated  
- Pain typically ≤ 5/10 with gentle movement  

---

## Exclusion / red flags

- Myelopathy signs, progressive weakness  
- Drop attacks, severe unremitting night pain  
- Post-trauma fracture suspicion  
- Vascular symptoms (dizziness, diplopia with neck movement — evaluate first)  
- Acute whiplash with significant concussion without clearance  

---

## Clinical goals

1. Reduce cervical irritability with graded ROM  
2. Activate deep cervical flexors (chin tuck)  
3. Improve scapular control and upper thoracic mobility  
4. Postural awareness for daily tasks  
5. Optional gentle shoulder/neck integration  

---

## Program duration

4 weeks · 3/week · 12 sessions · 15–30 min

---

## Levels / phases

| Phase | Week | Focus |
|-------|------|-------|
| 1 | 1 | Chin tuck, cervical rotation ROM, breathing |
| 2 | 2 | Scapular setting, upper trap stretch, posture reset |
| 3 | 3 | Cervical lateral flexion stretch, wall slide, postural awareness |
| 4 | 4 | Gentle neck rotation, shoulder circles, seated trunk rotation, review |

---

## Session structure

Neck mobility → scapular/posture → integration → pain/effort. **All manual.**

### exerciseIds

`chin-tuck`, `cervical-rotation-rom`, `cervical-lateral-flexion-stretch`, `upper-trapezius-stretch`, `scapular-setting`, `posture-reset`, `wall-slide`, `postural-awareness`, `gentle-neck-rotation`, `shoulder-circles`, `seated-trunk-rotation`, `diaphragmatic-breathing`

---

## Sets / reps / duration ranges

| Type | Dose |
|------|------|
| Chin tuck | 3 × 10 holds 5 s |
| ROM exercises | 2 × 8–10 slow |
| Stretches | 2–3 × 20–30 s |
| Scapular sets | 3 × 10 |
| Postural awareness | 1 × daily cues |

Avoid end-range loading in irritable phase.

---

## Pain and effort rules

- Pain ≤ 4/10 during neck exercise (default — neck is irritable)  
- Stop if radiating arm pain develops  
- No high-velocity manipulation in program  
- Effort ≥ 7/10 → review (lower threshold for neck)  

---

## Maintain / regress / progress rules

Regress to isometrics and smaller ROM if symptoms worsen. Progress only with clinician exam. **No automatic advance.**

---

## Therapist review checkpoints

Assign (verify no radiculopathy) · session 6 · session 12.

---

## Patient instructions

Slow movements; avoid pulling on head. Screen height and sleep posture discussed in clinic — not automated in RASQ. Arabic: library strings when enabled in portal.

---

## Clinician notes

Cervicogenic headache only if therapist confirms. **Q-Motion sensor:** future/deferred — do not reference in patient-facing copy as available feature. English-only clinician dashboard.

---

## Outcome measures

Session pain/effort; optional NDI external; in-clinic ROM / Spurling — clinician only.

---

## RASQ data fields to track

Session logs, completion, notes. No CV in v0.

---

## CV role if any

**None.** Neck program fully manual. Q-Motion is **future** hardware track only.

---

## Manual-only exercises

**All exercises manual-only.**

---

## AI Clinician Summary boundaries

No radiculopathy diagnosis from logs. No imaging advice. No manipulation recommendations. English draft + disclaimer.

---

## MQE future integration

Not applicable. If Q-Motion ships in distant future, separate approved track — not MQE v0.

---

## Safety wording

Emphasize stop if arm symptoms. Therapist review for progression. Not emergency care.

---

## What not to claim

Cervical diagnosis, posture “score,” sensor-based feedback (not available), automatic progression, cure of headache disorder.

---

## Pilot evaluation metrics

Adherence, arm symptom reports in notes, clinician confirmation of red-flag screening documented.

---

## Document control

| RASQ code impact | **None** |
| Commit | **Awaiting approval** |
