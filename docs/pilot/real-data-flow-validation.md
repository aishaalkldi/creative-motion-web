# RASQ — Real Data Flow Validation (PR114)

**Purpose:** Validate the full clinician → patient → Outcomes Hub path with **real persisted data**, and clarify when an empty hub is expected vs a wiring defect.

**Scope:** Assessment → treatment plan → patient portal session → session log → Outcomes Hub. No AI, no DB migration, no new patient fields.

**When to use:** Before demo or pilot sign-off when reviewers report “0 logged sessions” or empty pain/CV sections.

---

## Safety framing

- Outcomes Hub shows **patient-reported trends** and **derived observations** only.
- **Therapist interpretation required** — empty sections are not clinical failures.
- Camera-assisted rows are **camera-assisted observation**; capture reliability is **technical capture reliability only**.
- An empty hub on a **new patient who has not completed a portal session** is **expected**.

---

## Data flow (production path)

```
Clinician: assessment submitted     → assessments
Clinician: plan assigned            → treatment_plans, plan_sessions, patient_access_tokens
Patient: portal session completed   → session_logs, plan_sessions.status = completed
Patient: optional CV exercise       → cv_session_metrics (patient_id scoped)
Clinician: Outcomes Hub             → GET /api/clinician/progress-outcomes
```

| Outcomes section | Primary source | Plan-scoped? |
|------------------|----------------|--------------|
| Session activity | `plan_sessions` + current plan | Yes |
| Patient-reported pain | `session_logs` (effort, pain after, notes) | Yes (current plan) |
| Assessment history | `assessments` | No |
| Camera-assisted observation | `cv_session_metrics` | No (patient-wide) |
| Technical capture reliability | `motion_quality` on CV rows | No |

**Plan selection (PR114):** When `planId` is omitted, the API uses the same rule as the patient profile — **newest active plan**, otherwise **newest plan overall** (`resolveCurrentAndPreviousPlans`).

---

## Empty hub: expected vs investigate

| Observation | Likely cause | Action |
|-------------|--------------|--------|
| All sections empty | No assessment, plan, or portal session yet | Run journey checklist below |
| Assessments only | Plan not assigned or no session completed | Assign plan; patient completes session |
| Session activity 0/N, empty pain table | No `session_logs` on **current** plan | Complete portal wrap-up (effort + pain after) |
| Profile shows activity, hub empty | Was plan-resolution mismatch (fixed PR114) | Re-test; if still wrong, check `planId` param |
| Sessions + pain populated, CV empty | Camera skipped or non-CV exercise | Optional: repeat with CV-allowlisted exercise + consent |
| CV populated, capture reliability empty | No STS pilot `captureQuality` stored | Expected for most exercises today |

**Note:** Patient-reported **pain before** is not collected in the current portal wrap-up; the hub may show pain **after** and effort while the “before” column stays blank. That is a known product gap — not an Outcomes Hub defect.

---

## One-patient journey checklist

Complete in order. Record patient id and portal token for traceability.

### Phase A — Assessment

| # | Step | Pass criteria |
|---|------|----------------|
| A1 | Create patient (`/clinician/patients/new`) | Patient appears in list |
| A2 | Record or receive assessment | Row in `assessments` |
| A3 | Open Outcomes Hub | **Assessment history** ≥ 1 entry |

### Phase B — Treatment plan

| # | Step | Pass criteria |
|---|------|----------------|
| B1 | Assign plan (`/clinician/plans/new?patientId=…`) | Plan on patient profile |
| B2 | Copy patient portal link (`/patient/[token]`) | Token opens portal |
| B3 | Open Outcomes Hub | **Session activity** shows plan title; adherence 0/N if no completions |

### Phase C — Patient session (required for logs + pain)

| # | Step | Pass criteria |
|---|------|----------------|
| C1 | Patient: start session from portal | Session player loads |
| C2 | Complete exercises through wrap-up | Effort (1–10) + pain after (0–10) entered |
| C3 | Submit **Complete session** | Success; session marked completed on portal |
| C4 | Clinician: refresh patient profile `#progress-snapshot` | Latest effort/pain visible |
| C5 | Open Outcomes Hub | Summary: **≥ 1 logged session**; pain table has ≥ 1 row |

### Phase D — Optional camera-assisted observation

| # | Step | Pass criteria |
|---|------|----------------|
| D1 | Plan includes CV-allowlisted exercise (e.g. sit-to-stand) | Exercise in session |
| D2 | Patient: consent + camera + complete CV exercise | CV save succeeds |
| D3 | Open Outcomes Hub | **Camera-assisted observation** ≥ 1 row |
| D4 | STS with pilot metadata | **Technical capture reliability** may show rows |

### Phase E — Cross-surface consistency

| # | Step | Pass criteria |
|---|------|----------------|
| E1 | Profile → Outcomes link | Same patient, same plan context |
| E2 | Results queue → Progress & outcomes | Hub loads |
| E3 | Compare logged session count | Profile current plan matches hub summary line |

---

## Pass / fail record

| Phase | Result | Reviewer | Date | Notes |
|-------|--------|----------|------|-------|
| A — Assessment | | | | |
| B — Plan | | | | |
| C — Session | | | | |
| D — CV (optional) | | | | |
| E — Cross-links | | | | |

---

## Related documents

- [`docs/pilot/progress-outcomes-hub-qa.md`](./progress-outcomes-hub-qa.md) — UI, wording, and hub section QA (PR113)
- [`docs/pilot/pilot-workflow.md`](./pilot-workflow.md) — End-to-end clinician workflow
- [`docs/progress/PROGRESS_OUTCOMES_HUB_AUDIT.md`](../progress/PROGRESS_OUTCOMES_HUB_AUDIT.md) — PR111 data inventory

---

## Revision history

| Date | PR | Notes |
|------|-----|-------|
| 2026-06-05 | PR114 | Initial real data flow validation doc; plan resolution aligned with profile |
