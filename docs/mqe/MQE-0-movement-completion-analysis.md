# MQE-0 — Movement Completion Analysis v0

**Track:** MQE-0  
**Status:** Planning and documentation only  
**Date:** 2026-05-30  
**Product:** RASQ — rules-based Sit-to-Stand **completion** layer for clinician review

**Related docs:**

- `MQE-0-data-audit.md` — what data exists today  
- `MQE-0-safety-language.md` — approved and forbidden language  

---

## Executive summary

**Movement Completion Analysis (MQE) v0** is a **rules-based, therapist-in-the-loop** layer that interprets **existing** Sit-to-Stand CV derived metrics alongside session completion and patient-reported pain/effort — to produce **completion patterns** and **review suggested** prompts for clinicians only.

**MQE-0 is not:**

- A biomechanics engine  
- ML or computer vision research product  
- Clinical scoring, diagnosis, or progression automation  
- Patient-facing movement quality feedback  

**MQE-0 can be defined entirely in documentation** using read-time rules over current tables. Implementation is a separate, explicitly approved step.

**RASQ impact in MQE-0:** None — no app, API, schema, or production CV logic changes.

---

## Design principles

1. **Use data already saved** — `cv_session_metrics`, `session_logs`, `plan_sessions.exercises`.  
2. **Rules, not models** — deterministic thresholds; document tunables; no training.  
3. **Clinician-only output** — English labels on patient profile / session context.  
4. **Review suggested, never decide** — no automatic plan changes.  
5. **Language safety first** — see `MQE-0-safety-language.md`.  
6. **Independent of camera** — manual completion remains valid; MQE must not penalize “no camera.”

---

## MQE-0 concepts

All concepts map to **session observations** — not clinical judgments.

| Concept | Definition | Primary inputs | Clinician-facing phrase |
|---------|------------|----------------|-------------------------|
| **Completed** | Plan session marked complete (`status` = `completed` or `done`) and/or `session_logs` row exists | `plan_sessions`, `session_logs` | “Session observation: completion recorded” |
| **Incomplete** | Session still `upcoming` / `today` or no completion log | `plan_sessions.status` | “Session observation: not completed” |
| **Under target** | CV `rep_count` < prescribed reps for sit-to-stand in session exercises | `rep_count`, `exercises[].reps` | “Completion pattern: rep count below prescribed target · review suggested” |
| **Stopped early** | Inferred: short `session_duration_s` vs prescribed `durationSec` or heuristic minimum | duration fields | “Completion pattern: short tracking duration · review suggested” |
| **Low visibility** | `tracking_quality` = `poor` or `unknown` | `tracking_quality` | “Camera visibility: limited · review suggested” |
| **Needs therapist review** | Composite: any of low visibility, under target, no movement, orphan CV, pain spike context | rule bundle | “Review suggested” (with specific reason lines) |
| **Adherence pattern** | Operational: sessions completed vs total in plan over time | `session_logs`, plan session counts | Use existing operational adherence — **not** an MQE score |
| **Tempo estimate** | If `rep_count` > 0: `session_duration_s / rep_count` (seconds per rep) | derived | “Estimated average ~{n}s per rep · assistive estimate only” |

### Sub-concepts (internal rules, safe copy)

| Internal | When | Notes |
|----------|------|-------|
| **At or above prescribed reps** | `rep_count` ≥ parsed prescribed reps | Still “review suggested” — not success/fail grade |
| **Manual completion** | Completed session, no CV row for STS | Neutral — expected path |
| **Camera used** | CV row with `source` = `patient_session` | Existing camera line pattern |
| **No movement detected** | `movement_detected` = false | Review camera setup, not patient blame |
| **CV without session log** | CV row exists, no matching log | Data integrity edge — review suggested |

### Explicitly out of MQE-0 concepts

- Movement quality / form correctness  
- Clinical readiness or phase progression  
- Risk stratification  
- Per-rep incomplete cycle labels in production (MQ-REP-1 shadow only today)

---

## Rules sketch (documentation only — not deployed)

Example evaluation order for a **single plan session** with sit-to-stand:

```
1. If session not completed → INCOMPLETE
2. If completed and no CV row for STS → COMPLETED_MANUAL
3. If CV row present:
   a. If tracking_quality in (poor, unknown) → flag LOW_VISIBILITY
   b. If movement_detected = false → flag NO_MOVEMENT
   c. Parse prescribed reps from plan_sessions.exercises (sit-to-stand)
      If rep_count < prescribed → UNDER_TARGET
   d. If session_duration_s < minDurationHeuristic → STOPPED_EARLY
   e. If rep_count > 0 → TEMPO_ESTIMATE = duration / reps
4. If any review flags → NEEDS_THERAPIST_REVIEW (list reasons)
5. Attach session_logs pain_score / effort_score as context lines (not MQE labels)
```

**Tunables (pilot-calibrated later):** min duration heuristic, whether `fair` visibility triggers review, multi-set rep math (sets × reps).

---

## Clinician-only output model

### Where MQE would appear (future — not built in MQE-0)

| Surface | v0 proposal |
|---------|-------------|
| Patient profile — Movement tracking sessions | Optional **“Completion observation”** block under existing CV card |
| Plan session list | Extend `deriveClinicianSessionCameraLine` with review-suggested suffix |
| Patient portal | **None** |
| AI summary | **Deferred** — do not feed MQE until approved |
| Email / push | **None** |

### Output shape (illustrative JSON for docs)

```json
{
  "schemaVersion": "mqe-0",
  "planSessionId": "…",
  "exerciseId": "sit-to-stand",
  "observations": [
    "Completion pattern: rep count below prescribed target (4 recorded, 10 prescribed)",
    "Camera visibility: fair signal"
  ],
  "reviewSuggested": true,
  "reviewReasons": ["under_target", "low_visibility"],
  "tempoEstimateSecPerRep": 18,
  "disclaimer": "Movement completion observations are derived… Therapist review required."
}
```

**Not stored in MQE-0** — computed at read time or cached in UI state only if option B approved later.

### Boundaries (locked)

| Rule | Status |
|------|--------|
| No patient-facing MQE | Required |
| No automatic treatment change | Required |
| No movement quality score to patient | Required |
| Therapist review required | Required |
| No RASQ production integration beyond clinician read-only labels | MQE-0 = docs only |
| English-only clinician copy | Required |

---

## Future research value (feasibility — not claims)

MQE-0 documentation enables a **supervised feasibility study** after pilot data:

| Research question | Data sources | Notes |
|-------------------|--------------|-------|
| Do CV rep counts correlate with prescribed dose completion? | CV + plan jsonb | Descriptive only |
| Is adherence associated with visibility quality? | CV quality × session completion rate | Operational |
| Completion consistency over weeks | `session_logs` time series | Not outcome study |
| Pain / effort trends when under target | `pain_score`, `effort_score` + MQE flags | Clinician interprets |
| False “review suggested” rate | Clinician feedback form | Tune thresholds |

**Not in scope:** efficacy, diagnostic accuracy, or automated progression validation.

---

## What can be built safely **now** (post-MQE-0 docs)

| Item | Risk | Track |
|------|------|-------|
| Documented rule set (this pack) | None | **MQE-0 ✓** |
| Spreadsheet prototype on exported CSV | None | Internal pilot |
| Read-time rule function in app (clinician-only badge) | Low if language locked | **Option B** — small UI |
| Show `frames_with_pose` / ratio in clinician UI | Low — visibility only | Option B adjunct |
| Persist MQE result column / JSON | Medium — schema change | **Option C** — defer |
| Enable MQ-REP-1 shadow → save per-rep | Medium — changes CV semantics | Separate from MQE-0 |
| Patient-facing completion grade | **Not allowed** | — |

---

## What must wait for pilot data

| Item | Why |
|------|-----|
| Threshold calibration (under target strictness, short duration cutoffs) | Need real session distribution |
| `fair` visibility → review suggested? | False-positive rate unknown |
| Multi-set prescribed rep parsing edge cases | Need plan templates in live use |
| Correlation claims in investor/clinic materials | Need n ≥ pilot minimum |
| AI summary inclusion of MQE observations | Need clinician trust + language review |
| Schema for cached MQE outputs | Need stable rule version from pilot |

---

## Recommended next step

| Option | Description | Recommendation |
|--------|-------------|----------------|
| **A) Docs only** | MQE-0 doc pack + pilot script note for clinicians | **✓ Do now (this track)** |
| **B) Small UI clinician-only flag** | Read-time `deriveMqeObservation()` + badge on profile CV card; no API/schema change | **Next after PILOT-ACTIVATION-0** if docs approved |
| **C) Data schema later** | `mqe_session_observations` table or jsonb on CV row | **Defer** until rule stability |
| **D) Wait until pilot data** | No UI until N patient sessions with CV | **Partial** — docs now; tune rules after 10–20 sessions |

**Recommended sequence:** **A → pilot sessions → B → tune → consider C**

Do **not** modify production CV detector logic for MQE-0.

---

## Relationship to existing tracks

| Track | Relationship |
|-------|--------------|
| **CV-Y1B** | Provides derived metrics MQE consumes — do not change |
| **MQ-REP-1** | Shadow per-rep FSM — not enabled; MQE-0 does not depend on it |
| **MQ-SIGNAL-1B** | Session visibility summary — already feeds saved `tracking_quality` |
| **AI Clinician Summary v0** | Parallel clinician tool — MQE not integrated in v0 |
| **PILOT-ACTIVATION-0** | MQE is optional review assist — not activation gate |
| **HARDWARE-0 (Q-Line)** | Unrelated — separate sensor track |

---

## MQE-0 deliverables checklist

- [x] Data audit (`MQE-0-data-audit.md`)  
- [x] Safety language (`MQE-0-safety-language.md`)  
- [x] Concepts and next-step recommendation (this file)  
- [ ] Clinician feedback questions for MQE (optional appendix — when approved)  
- [ ] Implementation PR (option B — when approved)  

---

## Document control

| Field | Value |
|-------|-------|
| Track ID | MQE-0 |
| RASQ code impact | **None** |
| Commit | **Not committed** until explicitly approved |
