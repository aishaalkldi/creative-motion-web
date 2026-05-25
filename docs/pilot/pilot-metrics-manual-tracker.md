# RASQ Pilot Metrics — Manual Tracker

**Purpose:** Track pilot evidence week-by-week without product analytics, database tables, or in-app dashboards.

**When to use:** Update after each pilot session. Roll up weekly for investor or internal review.

**Source data:** Clinician workspace counts, `pilot-evidence-log.md`, `clinician-feedback-form.md`, `patient-feedback-message.md`.

---

## How to use

1. Add a new row per **pilot week** or **demo day** (your choice — stay consistent).
2. Fill counts from observation or clinician report.
3. Record satisfaction scores from feedback forms.
4. Summarise trends in the **Weekly notes** section at the bottom.

---

## Tracker table

| Week / session | Date | Patients created | Assessment links sent | Assessments completed | Plans assigned | Sessions completed | Review flags raised | Review flags resolved | Clinician satisfaction (1–5) | Patient clarity (1–5) | NPS (0–10) |
|----------------|------|------------------|-----------------------|----------------------|----------------|--------------------|--------------------|-----------------------|------------------------------|----------------------|------------|
| Demo day 1 | | | | | | | | | | | |
| Week 1 | | | | | | | | | | | |
| Week 2 | | | | | | | | | | | |
| Week 3 | | | | | | | | | | | |
| Week 4 | | | | | | | | | | | |

---

## Derived rates (calculate manually)

| Rate | Formula | Week 1 | Week 2 | Week 3 | Week 4 |
|------|---------|--------|--------|--------|--------|
| Assessment completion | completed ÷ sent | | | | |
| Plan assignment | plans ÷ patients created | | | | |
| Session completion | sessions ÷ (plans × planned sessions) | | | | |
| Review resolution | resolved ÷ raised | | | | |

_Note: Session completion denominator depends on plan length — record assumption in notes._

---

## Metric definitions

| Metric | Definition | Where to observe |
|--------|------------|------------------|
| **Patients created** | New patient records in clinician workspace | Patients list |
| **Assessment links sent** | Remote assessment links copied or sent | Assessment / request flow |
| **Assessments completed** | Submitted assessments in chart | Clinical Assessment Summary |
| **Plans assigned** | Treatment plans assigned to patients | Patient profile · Rehabilitation Plan |
| **Sessions completed** | Patient-reported session completions | Results · Progress Snapshot · Rehabilitation Journey |
| **Review flags raised** | Items needing therapist review | Results · Review Queue |
| **Review flags resolved** | Flags marked reviewed / acknowledged | Patient profile · Progress Snapshot |
| **Clinician satisfaction** | Q1 from clinician feedback form (1–5) | `clinician-feedback-form.md` |
| **Patient clarity** | Composite from patient feedback (1–5) | `patient-feedback-message.md` |
| **NPS** | Q7 from clinician feedback form (0–10) | `clinician-feedback-form.md` |

---

## Patient clarity scoring guide

Use clinician judgment after patient feedback responses:

| Score | Meaning |
|-------|---------|
| 5 | All answers positive; no confusion reported |
| 4 | Mostly positive; minor confusion only |
| 3 | Mixed — partly understood exercises or link |
| 2 | Significant confusion; may not continue |
| 1 | Could not use link or understand program |

---

## Weekly notes

### Week 1

**Top win:**

**Top blocker:**

**Action for next week:**

---

### Week 2

**Top win:**

**Top blocker:**

**Action for next week:**

---

### Week 3

**Top win:**

**Top blocker:**

**Action for next week:**

---

### Week 4

**Top win:**

**Top blocker:**

**Action for next week:**

---

## Roll-up summary (fill after pilot period)

| Metric | Total / average |
|--------|-----------------|
| Total patients created | |
| Total assessments sent | |
| Total assessments completed | |
| Total plans assigned | |
| Total sessions completed | |
| Total review flags raised | |
| Total review flags resolved | |
| Average clinician satisfaction | |
| Average patient clarity | |
| Average NPS | |

**Pilot verdict:** Proceed / Iterate / Pause

**Primary evidence doc:** `investor-proof-template.md` (latest session)
