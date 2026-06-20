# RASQ — Progress & Outcomes Hub Audit (PR111)

**Document type:** Code review and implementation planning — documentation only  
**Status:** Audit complete; **no code changes in this PR**  
**Last updated:** 2026-06-05  
**Baseline:** PR110 gait review wiring; STS/CV pilot path; patient progress portal v1

---

## Purpose

Audit the current **progress and outcomes** flow across patient and clinician surfaces, and define the **safest minimal path** to show patient activity and self-reported responses over time — without claiming clinical improvement or making automatic treatment decisions.

**Scope:** Therapist-review-only presentation of **existing** data. **Not** a new analytics engine, diagnosis layer, or AI summary.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is progress data available today? | **Yes — fragmented** across `session_logs`, `plan_sessions`, `assessments`, `cv_session_metrics` |
| Is there a unified Outcomes Hub? | **No** — multiple partial surfaces (patient progress portal, results queue, patient profile) |
| Can we show safe outcome views without new schema? | **Yes** — aggregate read-only from existing tables/APIs |
| Can we claim clinical improvement? | **No** — only patient-reported trends and activity counts unless counsel/clinical study says otherwise |

**Recommendation:** Build **PR112** as a clinician-first **Progress & Outcomes Hub** that **joins existing APIs** with strict safe-language guards — not a new scoring engine.

---

## Files reviewed

### Patient progress surfaces

| File | Role |
|------|------|
| `app/patient/[token]/progress/page.tsx` | Token-scoped patient progress route |
| `app/components/patient/progress/PatientProgressPortal.tsx` | Progress hero, stats, achievements, recent sessions |
| `app/lib/patient-progress-portal.ts` | View model: completion %, effort labels, exercise highlights |
| `app/lib/patient-motivation.ts` | Derived stats: active days, completion counts |
| `app/patient/progress/page.tsx` | **Demo/mock** progress (FastAPI treatment-plans mock) — not production portal |

### Clinician progress surfaces

| File | Role |
|------|------|
| `app/clinician/results/page.tsx` | Results queue — patient pipeline cards |
| `app/api/clinician/results/route.ts` | Plan cards + assessment snapshots per patient |
| `app/clinician/patients/[id]/page.tsx` | Patient profile: progress snapshot, timeline, CV section, adherence |
| `app/clinician/progress/[id]/page.tsx` | **Redirect only** → patient profile or results |
| `app/api/clinician/patient-progress/route.ts` | Progress summary + timeline bundle API |
| `app/lib/clinician/patient-timeline.ts` | Unified timeline events (assessment, plan, session, review) |
| `app/components/clinician/cv/CvPatientCvMetricsSection.tsx` | CV metrics on patient profile (`CvReviewSummary`) |

### Session completion & self-report

| File | Role |
|------|------|
| `app/api/patient/session-complete/route.ts` | POST completion → `session_logs` + `plan_sessions.status` |
| `app/api/patient/logs/route.ts` | GET patient session logs (effort, pain, notes) |
| `app/lib/session-coach-metadata.ts` | Encodes `painBefore`, safety concern in `notes` JSON prefix |
| `app/components/patient/session/PatientGuidedSessionFlow.tsx` | Post-session effort + pain capture UI |

### Assessments

| File | Role |
|------|------|
| `app/lib/assessment-snapshot.ts` | Preferred assessment pick + pain/body region extraction |
| `app/clinician/assessment/report/AssessmentReportClient.tsx` | Assessment report (includes draft confidence — clinician-only) |
| `app/clinician/assessments/sit-to-stand/page.tsx` | STS motion evidence review (CV filtered) |
| `app/clinician/assessments/gait/page.tsx` | Gait observation review (PR110) |

### CV / motion evidence

| File | Role |
|------|------|
| `app/api/cv/session-metrics/route.ts` | Clinician GET/POST derived CV metrics |
| `app/api/patient/cv-session-metrics/route.ts` | Patient POST (allowlisted exercises) |
| `app/components/clinician/cv/CvReviewSummary.tsx` | Session-level CV review list |
| `app/lib/cv/motion-analysis-report.ts` | Clinician report builder; `captureQuality` from `smtPilot` today |
| `app/lib/cv/capture-quality.ts` | Shared capture QC scoring |
| `app/lib/patient-lifetime-summary.ts` | Aggregate: completed sessions, CV session count |

### Rules engines (clinician flags — not outcomes scores)

| File | Role |
|------|------|
| `app/lib/clinical-action-engine.ts` | Rules-based review flags (pain, effort, adherence) — **no auto-prescription** |
| `app/lib/clinical-review.ts` | Review acknowledgment triggers |

### Out of scope / legacy (do not wire into hub v1)

| File | Reason |
|------|--------|
| `app/lib/api/gait.ts`, `app/gait/page.tsx` | Legacy gait AI — classification and recommendations |
| `app/therapy/components/GaitTherapySession.tsx` | Isolated therapy gamification; localStorage; movement quality scores |
| `app/lib/api/treatment-plans.ts` | Mock store for demo `/patient/progress` only |

---

## Current progress architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES (existing, no migration)                │
├─────────────────────────────────────────────────────────────────────────────┤
│ assessments          │ remote_questionnaire, general_msk, structured         │
│ treatment_plans      │ program assignment                                    │
│ plan_sessions        │ scheduled sessions, status, exercises                 │
│ session_logs         │ effort_score, pain_score, notes (painBefore, safety)  │
│ cv_session_metrics   │ rep_count, duration, tracking_quality, motion_quality│
│ clinical_review_ack  │ therapist review acknowledgments                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   Patient portal              Clinician results            Patient profile
   PatientProgressPortal       pipeline cards               Progress Snapshot
   (completion %, effort,      (assessment → rehab,         PatientJourneyTimeline
    active days)                 pain, clinical action)       CvPatientCvMetricsSection
          │                           │                           │
          └───────────────────────────┴───────────────────────────┘
                                      │
                         NO unified Progress & Outcomes Hub
```

### Care pathway (as implemented today)

| Stage | Storage | Clinician sees | Patient sees |
|-------|---------|----------------|--------------|
| **1. Assessment** | `assessments` + optional remote | Results queue card, assessment archive, report link | Remote questionnaire submit only |
| **2. Plan assigned** | `treatment_plans`, `plan_sessions` | Plan on profile, pipeline “Plan assigned” | Plan home, session list |
| **3. Session activity** | `plan_sessions.status`, `session_logs` | Progress snapshot, timeline `session_completed`, adherence bars | Progress %, recent sessions, effort/comfort labels |
| **4. Optional CV** | `cv_session_metrics` + `motion_quality` | Per-session camera status on schedule; `CvReviewSummary` on profile; Assessment Center STS/gait | Optional camera on exercises; no outcomes hub |
| **5. Review flags** | `clinical-action-engine` read-time | `ClinicalActionCard`, needs-review badges | Patient-safe messages only when flagged |

---

## What progress data exists today

### Available now (safe to surface as activity / self-report)

| Data | Source | Fields | Safe framing |
|------|--------|--------|--------------|
| **Session adherence** | `plan_sessions.status` | completed / total | “Sessions completed” — not clinical compliance score |
| **Weekly adherence bars** | Derived in results/profile | `weeklyCompletions` | “Session activity by week” |
| **Completed sessions count** | `session_logs`, plan status | count, dates | Activity metric |
| **Patient-reported effort** | `session_logs.effort_score` | 0–10 per session | “Patient-reported effort” |
| **Patient-reported pain (after)** | `session_logs.pain_score` | 0–10 per session | “Pain after session (patient-reported)” |
| **Pain before → after** | `notes` + `parseSessionCoachNotes` | `painBefore`, `painAfter` | “Patient-reported pain response” — **not** “improved” unless therapist interprets |
| **Safety concern flag** | Coach metadata in notes | boolean | Review flag only |
| **Assessment timeline** | `assessments`, `assessment-snapshot` | type, date, pain at rest/movement (assessment-time) | “Assessment submitted” — point-in-time |
| **CV session timeline** | `cv_session_metrics` | exercise, duration, reps, tracking, `recorded_at` | “Camera-assisted session evidence” — therapist review |
| **Capture quality history** | `motion_quality.smtPilot.captureQuality` (STS only today) | high/medium/low, retest | “Capture quality (technical)” — not movement quality |
| **Lifetime summary** | `patient-lifetime-summary` | total sessions, CV count, last activity | Aggregate activity |
| **Active days (7d)** | `patient-motivation` | distinct completion days | Engagement proxy |
| **Review acknowledgments** | `clinical_review_acknowledgments` | reviewed_at | Workflow state |

### Partially available / exercise-specific

| Data | Status | Gap |
|------|--------|-----|
| **Capture quality (non-STS)** | `hrPilot` lacks `captureQuality` (PR108 plan) | No unified QC history across exercises |
| **CV evidence by assessment** | CV linked to `plan_session_id`, not assessment ID | Assessment Center and plan sessions are separate threads |
| **Gait assessment metrics** | Shell + review wiring (PR110); no rows yet | Empty until PR111+ capture |

### Not available in production patient session flow

| Data | Where it exists | Hub v1 recommendation |
|------|-----------------|----------------------|
| **Patient-reported confidence** | Assessment draft fields; therapy `confidenceLevel` (isolated `/therapy`) | **Defer** — not in `session_logs`; do not port therapy scores |
| **Clinical improvement score** | Nowhere (by design) | **Do not add** |
| **Pain trend chart (UI)** | Data exists in APIs; **no chart component** in hub | PR112 deliverable |
| **Unified outcomes page** | Nowhere | PR112 deliverable |

---

## Recommended outcome views (safe v1)

| View | Data source | Safe label | Do not say |
|------|-------------|------------|------------|
| **Pain trend** | `session_logs` + coach `painBefore` | “Patient-reported pain over sessions” | “Pain improving”, “clinical response” |
| **Session adherence** | `plan_sessions` + weekly rollup | “Sessions completed / scheduled” | “Compliant”, “non-adherent patient” |
| **Completed sessions** | `session_logs.completed_at` | “Completed sessions” with dates | “Recovery milestones” |
| **Latest assessment timeline** | `assessments` + snapshots | “Assessment history” | “Baseline vs outcome diagnosis” |
| **CV evidence timeline** | `cv_session_metrics` | “Camera-assisted session evidence” | “Objective improvement”, “validated progress” |
| **Capture quality history** | `motion_quality.*.captureQuality` | “Capture quality (technical)” | “Good movement”, “poor form” |
| **Effort trend** | `session_logs.effort_score` | “Patient-reported effort” | “Under-performing”, “max effort achieved” |
| **Confidence / effort (portal)** | Effort yes; confidence **no** in session_logs | Show effort only in v1 | Imply self-efficacy clinical scores |

---

## How to connect assessment → plan → sessions → outcomes

### Logical chain (read-only joins — no new FKs required for v1)

```
Assessment submitted
    │  assessments.id, patient_id, created_at, structured_data (pain at assessment time)
    ▼
Plan assigned
    │  treatment_plans.id, patient_id, created_at
    ▼
Plan sessions
    │  plan_sessions.plan_id, status, session_number
    ▼
Session complete
    │  session_logs.plan_session_id, effort_score, pain_score, notes (painBefore)
    ▼
Optional CV capture
    │  cv_session_metrics.plan_session_id, motion_quality (smtPilot / hrPilot / …)
    ▼
Outcomes Hub (PR112)
    └── Timeline + trends (display only, therapist review banners)
```

### Join keys in use today

| From | To | Key |
|------|-----|-----|
| Patient | Plans | `treatment_plans.patient_id` |
| Plan | Sessions | `plan_sessions.plan_id` |
| Session | Log | `session_logs.plan_session_id` |
| Session | CV metric | `cv_session_metrics.plan_session_id` |
| Patient | Assessments | `assessments.patient_id` |
| Patient | CV metrics | `cv_session_metrics.patient_id` |

**No migration needed** — PR112 aggregator queries existing APIs or a thin clinician BFF endpoint composing them.

### Suggested aggregator module (PR112)

`app/lib/progress/progress-outcomes-bundle.ts` (name TBD):

- Input: `patientId`, optional `planId`
- Output: `ProgressOutcomesBundle` with:
  - `assessmentTimeline[]`
  - `sessionActivityTimeline[]` (completion + pain/effort points)
  - `cvEvidenceTimeline[]`
  - `captureQualityHistory[]` (where present in motion_quality)
  - `adherenceSummary`
  - `disclaimer: therapist_review_required`

---

## Missing gaps

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No unified Progress & Outcomes Hub page** | Clinicians jump between Results, profile, Assessment Center |
| 2 | **No pain/effort trend visualization** | Data exists; only latest values in Progress Snapshot |
| 3 | **CV outcomes not time-series** | `CvReviewSummary` is session list, not timeline chart |
| 4 | **Capture quality history STS-only** | Heel raise and others lack persisted `captureQuality` |
| 5 | **Assessment outcomes disconnected from sessions** | No single view showing assessment date → first session → latest session |
| 6 | **Patient confidence not in session_logs** | Cannot show confidence trend in v1 without schema or new field |
| 7 | **`/clinician/progress/[id]` is redirect only** | URL suggests hub; lands on profile |
| 8 | **Demo `/patient/progress` confuses architecture** | Mock FastAPI — not Supabase portal |
| 9 | **Clinical action copy can sound like treatment advice** | Must keep “suggested clinician action” as review prompts only in hub |
| 10 | **No patient-facing outcomes hub** | Patient portal has progress % but not CV timeline or pain chart |

---

## Recommended PR112 implementation plan

**Title:** PR112 — Progress & Outcomes Hub v1 (read-only aggregation + clinician UI)

**Prerequisite:** PR111 merged (this audit). Optional: PR109 heel-raise `captureQuality` for richer QC history.

### Phase A — Data bundle (no new tables)

| Slice | Deliverable |
|-------|-------------|
| **PR112a** | `progress-outcomes-bundle.ts` — types + builders from patient-progress API, session logs timeline, CV metrics, assessments |
| **PR112b** | Unit tests with fixture rows — pain trend points, adherence counts, empty states |
| **PR112c** | Optional `GET /api/clinician/progress-outcomes?patientId=` composing existing queries |

### Phase B — Clinician hub UI

| Slice | Deliverable |
|-------|-------------|
| **PR112d** | `/clinician/patients/[id]/outcomes` or enhance `#progress-snapshot` with tabbed hub |
| **PR112e** | Pain trend (line/table) — patient-reported only, disclaimer on every chart |
| **PR112f** | Session adherence + completed sessions list (reuse `ProgressSnapshotSection` data) |
| **PR112g** | Assessment + CV evidence timeline (chronological merge via `buildPatientTimeline` pattern) |
| **PR112h** | Capture quality history panel — parse `motion_quality` per session; “technical QC only” |

### Phase C — Navigation & polish

| Slice | Deliverable |
|-------|-------------|
| **PR112i** | Link from Results queue → Outcomes hub per patient |
| **PR112j** | Replace or alias `/clinician/progress/[id]` redirect to outcomes hub |
| **PR112k** | Docs: `docs/pilot/progress-outcomes-hub-qa.md` manual smoke |

### Explicitly defer (PR113+)

- Patient-facing pain trend chart
- Confidence/effort composite “recovery index”
- AI-generated progress narrative
- Cross-patient population analytics
- Clinical improvement language or badges

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Implying clinical improvement from pain downtrend** | High | Label all charts “patient-reported”; fixed disclaimer; no green/red “better/worse” |
| **Automatic treatment decisions** | High | Hub is read-only; no plan mutation; clinical action stays review prompts |
| **Conflating CV reps with outcomes** | High | Separate “CV evidence” lane from “session completion” lane |
| **Therapy gamification scores leaking in** | Medium | Exclude `/therapy` localStorage and biomechanics scores |
| **Legacy gait AI metrics** | Medium | Exclude `app/lib/api/gait.ts` payloads |
| **Sparse data looks like failure** | Low | Empty states per view; “not enough sessions for trend” |
| **STS-only capture quality skew** | Low | Show “available for STS sessions” until hrPilot parity |
| **Demo page confusion** | Low | Document `/patient/progress` as non-production |

---

## Safe wording (hub v1)

**May say**

- Patient-reported pain and effort over time  
- Sessions completed and session activity  
- Assessment submission history  
- Camera-assisted movement evidence timeline (therapist review)  
- Capture quality — technical session reliability  
- Therapist review required  

**Must not say**

- Clinical improvement, recovery trajectory, “getting better”  
- Diagnosis, pathology, fall risk  
- Automatic progression or treatment recommendations  
- Validated functional gain  
- “Normal” vs “abnormal” trend  

---

## Sequencing vs other work

| Priority | Work | Rationale |
|----------|------|-----------|
| 1 | STS controlled pilot + heel raise hardening | Validates CV evidence quality before outcomes charts |
| 2 | **PR112 Progress & Outcomes Hub v1** | High clinician value; uses existing data |
| 3 | Gait capture (PR111+) | Adds another evidence lane to hub later |
| 4 | Patient-reported forms (Assessment Center) | New data source for hub v2 |

---

## Related documents

- `docs/assessments/GAIT_ASSESSMENT_V1_CAPTURE_AUDIT.md` — PR109 gait evidence lane  
- `docs/cv/HEEL_RAISE_CV_HARDENING_PLAN.md` — capture quality parity for QC history  
- `docs/pilot/CONTROLLED_STS_PILOT_PLAN.md` — pilot before outcome claims expand  
- `app/lib/clinical-action-engine.ts` — review flag rules (do not expose as outcomes scores)

---

## Document history

| Date | PR | Change |
|------|-----|--------|
| 2026-06-05 | PR111 | Initial progress & outcomes hub audit (docs only) |
