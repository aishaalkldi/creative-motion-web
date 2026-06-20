# RASQ — Progress & Outcomes Hub QA (PR113)

**Purpose:** Manual QA checklist for the clinician Progress & Outcomes Hub after PR112 implementation and PR113 polish, before demo or controlled pilot review.

**Route:** `/clinician/patients/[id]/outcomes`

**API:** `GET /api/clinician/progress-outcomes?patientId=`

**Validation method:** Manual browser walkthrough + language grep on hub UI files. No DB migration, no AI, no patient-facing changes.

**When to use:** Before demonstrating the outcomes hub to clinicians or including it in a pilot onboarding session.

**Populate real data first:** Run [`docs/pilot/real-data-flow-validation.md`](./real-data-flow-validation.md) when the hub shows zero logged sessions or empty pain/CV sections — empty is **expected** until a full patient journey is completed.

---

## Safety framing (read before review)

- Hub shows **patient-reported trends** and **derived observations** only.
- **Therapist interpretation required** on every section.
- Camera-assisted rows are **camera-assisted observation** — not clinical assessment.
- Capture reliability rows are **technical capture reliability only** — not movement quality scoring.
- Hub is **read-only** — no plan mutation, no automatic clinical actions, no charts.
- RASQ does **not** make automatic treatment decisions from this view.

---

## QA checklist

### Navigation & page shell

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | Route loads for owned patient | Page renders without error; patient name in header |
| 2 | Header nav: Patient chart | Link opens `/clinician/patients/[id]` |
| 3 | Header nav: Results queue | Link opens `/clinician/results` |
| 4 | Header nav: Assessment Center | Link opens `/clinician/assessments` |
| 5 | Summary line when data exists | Shows logged sessions · assessments · camera sessions counts |
| 6 | Loading skeleton | Skeleton shown while fetching; no layout jump crash |
| 7 | Error + retry | Invalid patient or network error shows retry button |
| 8 | Legacy redirect | `/clinician/progress/[id]` redirects to outcomes hub |

### Safety banner & section nav

| # | Check | Pass criteria |
|---|--------|----------------|
| 9 | Therapist interpretation banner | Amber banner visible at top |
| 10 | Approved safety copy | Banner uses patient-reported / derived observations framing |
| 11 | Section jump chips | Five anchor links scroll to correct sections |
| 12 | Footer nav links | Patient chart, Results queue, Assessment Center at bottom |

### Section badges & labels

| # | Check | Pass criteria |
|---|--------|----------------|
| 13 | Session activity badge | “Activity record” |
| 14 | Pain section badge | “Patient-reported trend” |
| 15 | Assessment section badge | “Derived observation” |
| 16 | Camera section badge | “Camera-assisted observation” |
| 17 | Capture section badge | “Technical capture reliability only” |
| 18 | Pain table headers | Columns prefixed with patient-reported wording |
| 19 | Camera section title | “Camera-assisted observation” (not “evidence” alone) |
| 20 | Capture section title | “Technical capture reliability” |
| 21 | CV footer | Hub footer present; no prohibited wording (see language audit) |

### Data sections (patient with data)

| # | Check | Pass criteria |
|---|--------|----------------|
| 22 | Session activity | Adherence tiles match plan; link to plan on chart |
| 23 | Patient-reported pain table | Rows chronological; before/after/effort values |
| 24 | Assessment history | Types, dates, intake fields; report links work |
| 25 | Camera-assisted observation | Exercise names, duration, reps, tracking signal |
| 26 | Technical capture reliability | STS rows when `motion_quality` stores capture QC |

### Empty states

| # | Check | Pass criteria |
|---|--------|----------------|
| 27 | Hub-level empty (new patient) | Consolidated empty message + safe CTAs |
| 28 | No plan | Empty state links to plan / create plan |
| 29 | No pain entries | Empty state links to plan & sessions |
| 30 | No assessments | Links to record assessment + Assessment Center |
| 31 | No camera sessions | Links to movement tracking + STS review + Assessment Center |
| 32 | No capture reliability | Links to STS review + Assessment Center; explains STS-only today |

### Language audit (must not appear in hub UI)

| Prohibited term | Hub files to grep |
|-----------------|-------------------|
| improvement | `ProgressOutcomesHub.tsx`, `outcomes/page.tsx` |
| recovery | same |
| clinical progress confirmed | same |
| diagnosis | same (hub must not use word even in negation) |
| prediction | same |
| treatment recommendation | same |

**Approved terms to verify present:** patient-reported trends, derived observations, therapist interpretation required, camera-assisted observation, technical capture reliability only.

---

## Pass / fail table (fill during review)

| Area | Result | Reviewer | Date | Notes |
|------|--------|----------|------|-------|
| Navigation | | | | |
| Safety banner | | | | |
| Section badges | | | | |
| Populated sections | | | | |
| Empty states | | | | |
| Language audit | | | | |

---

## Suggested test patients

| Profile | Expected hub behavior |
|---------|----------------------|
| New patient (no plan) | Hub-level empty + section empties; plan CTA |
| Patient with plan + session logs | Session activity + pain table populated |
| Patient with assessments | Assessment history with report links |
| Patient with STS CV sessions | Camera observation + capture reliability rows |
| Patient with plan only (no logs) | Adherence tiles; empty pain table |

---

## Related documents

- [`docs/pilot/real-data-flow-validation.md`](./real-data-flow-validation.md) — PR114 one-patient journey to populate hub with real data
- `docs/progress/PROGRESS_OUTCOMES_HUB_AUDIT.md` — PR111 audit and PR112 plan
- `docs/pilot/sts-pilot-qa-validation.md` — STS camera pilot QA (upstream of CV rows)
- `docs/RASQ_CURRENT_STATE.md` — platform state

---

## Revision history

| Date | PR | Notes |
|------|-----|-------|
| 2026-06-05 | PR114 | Cross-link to real data flow validation doc |
| 2026-06-05 | PR113 | Initial outcomes hub QA checklist |
