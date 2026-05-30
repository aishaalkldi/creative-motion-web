# MQE-0 — Safety Language Guide

**Track:** MQE-0 (Movement Completion Analysis v0)  
**Status:** Approved planning constraints — documentation only  
**Date:** 2026-05-30  

**Related docs:** `MQE-0-movement-completion-analysis.md` · `MQE-0-data-audit.md`

**RASQ impact:** None in MQE-0. No app, API, schema, or production changes.

---

## Purpose

Define **mandatory language** for Movement Completion Analysis v0 so clinician-facing outputs remain **operational and review-oriented** — not diagnostic, not clinical scoring, not treatment automation.

Aligns with existing CV copy (`CV_CLINICIAN_DISCLAIMER`, `CV_CAMERA_VISIBILITY_HELPER`) and RASQ pilot boundaries (`docs/pilot/known-limitations.md`).

---

## Intended use

| Rule | Detail |
|------|--------|
| **Awareness / completion observation** | MQE describes **session observation patterns** from derived CV + completion data |
| **Therapist in the loop** | Every MQE label is **review suggested** — licensed clinician interprets in clinical context |
| **Clinician-only** | No patient-facing MQE surface in v0 |
| **Rules-based** | Deterministic thresholds on existing fields — not ML, not biomechanics engine |
| **Sit-to-Stand only** | MQE-0 scope matches CV allowlist (`sit-to-stand`) |

---

## Approved terms (use these)

| Term | Meaning | Example clinician line |
|------|---------|------------------------|
| **Completion pattern** | How session completion relates to prescribed dose and CV capture | “Completion pattern: reps below prescribed count” |
| **Camera visibility** | Landmark visibility / tracking signal — **not** movement quality | “Camera visibility: limited during session” |
| **Review suggested** | Neutral prompt for clinician follow-up | “Review suggested — low camera visibility with zero reps recorded” |
| **Session observation** | Single-session derived summary | “Session observation: 4 reps in 2:30, fair camera visibility” |
| **Tracking signal** | Same as production `formatCvTrackingSignal` | “Fair signal” |
| **Movement detected** | Boolean capture flag | “Movement detected: yes” |
| **Manual completion** | Session done without saved CV row | “Manual completion — camera not saved” |
| **Operational adherence** | Session log / plan progress counts | “Sessions completed: 3 of 8” (existing Sprint W — not MQE score) |
| **Assistive rep count** | Existing rep footer language | “Rep count is an assistive movement metric…” |
| **Capture summary** | Shadow FSM term if ever persisted | “Capture summary for therapist review” |

---

## Forbidden terms (never use in MQE v0)

| Avoid | Why |
|-------|-----|
| **Bad form** / **poor form** / **incorrect movement** | Implies clinical movement judgment |
| **Poor movement quality** / **movement quality score** | Quality scoring is out of scope |
| **Unsafe movement** / **dangerous pattern** | Safety triage belongs to clinician, not algorithm |
| **Ready to progress** / **not ready to progress** | Autonomous progression forbidden |
| **Clinical score** / **posture score** / **severity** | Clinical scoring forbidden |
| **Diagnosis** / ** pathology** / **dysfunction** | Not diagnostic |
| **Recommend** / **should increase reps** / **dose adjustment** | Treatment decision — clinician only |
| **Validated** / **accurate measurement** | CV not clinically validated |
| **Failed** (re: patient) | Blaming language — prefer “incomplete capture” or “below prescribed count” |

---

## Label mapping — internal concept → clinician copy

| Internal rule ID (implementation future) | Clinician-facing label |
|------------------------------------------|------------------------|
| `COMPLETED_WITH_CV` | Session observation: completion recorded · camera data saved |
| `COMPLETED_MANUAL` | Session observation: manual completion · camera not saved |
| `NOT_COMPLETED` | Session observation: not completed |
| `REPS_BELOW_PRESCRIBED` | Completion pattern: rep count below prescribed target · review suggested |
| `REPS_AT_OR_ABOVE_PRESCRIBED` | Completion pattern: rep count meets or exceeds prescribed target · review suggested |
| `LOW_VISIBILITY` | Camera visibility: limited · review suggested |
| `UNKNOWN_VISIBILITY` | Camera visibility: unknown · review suggested |
| `NO_MOVEMENT_DETECTED` | Session observation: movement not detected · review suggested |
| `SHORT_DURATION` | Session observation: short tracking duration · review suggested |
| `STOPPED_EARLY_INFERRED` | Completion pattern: tracking window shorter than typical · review suggested |
| `CV_WITHOUT_SESSION_LOG` | Session observation: camera data saved · session log missing · review suggested |
| `TEMPO_ESTIMATE` | Session observation: estimated average time per rep ~{s}s · assistive estimate only |

**Always append or inherit:** existing CV disclaimer — derived metrics, therapist review, not clinical assessment.

---

## Patient-facing boundary

Patients **must not** see MQE labels, completion grades, or movement quality feedback.

Existing patient CV copy already states the device does **not** judge correct/wrong movement (`bio-0-contracts.ts` consent bullets). MQE must not add new patient strings in v0.

---

## AI summary boundary

AI Clinician Summary v0 must **not** ingest MQE labels until explicitly approved. If added later, AI must paraphrase as **session observations** with disclaimer — never as scores or progression advice.

---

## English-only clinician surfaces

Per RASQ language policy: MQE clinician labels and tooltips are **English only** in v0.

---

## Required disclaimer block (MQE docs and future UI)

> **Movement completion observations are derived from assistive camera metrics and session records. They are not clinically validated, do not assess movement quality, and do not recommend treatment changes. Therapist review required.**

Short inline (badge tooltip):

> *Assistive completion observation — review suggested.*

---

## Examples — good vs bad

### Good (clinician dashboard)

- “Review suggested — completion pattern: 3 reps recorded, prescribed 10, limited camera visibility.”  
- “Session observation: manual completion, no camera save.”  
- “Camera visibility: fair signal. Rep count: 8. Review with patient-reported effort (6/10).”

### Bad

- “Poor sit-to-stand quality — patient not ready to progress.”  
- “Unsafe movement detected — reduce plan difficulty.”  
- “Clinical score: 62/100.”

---

## Regulatory and pilot framing

MQE-0 is **workflow assist for controlled pilots** — same framing as optional Sit-to-Stand CV in `known-limitations.md`:

- Experimental, therapist-review only  
- Not pilot-critical  
- Does not block session completion  

---

## Document control

| Field | Value |
|-------|-------|
| RASQ code impact | **None** |
| Commit | **Not committed** until explicitly approved |
