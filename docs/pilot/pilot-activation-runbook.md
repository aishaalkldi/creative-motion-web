# RASQ — PILOT-ACTIVATION-0 Runbook

**Purpose:** First supervised clinic activation session for AI Clinician Summary Draft v0 and existing workflow validation.

**Production URL:** https://creative-motion-web.vercel.app

**Scope:** Process and observation only — not clinical outcome claims.

---

## Session parameters

| Item | Spec |
|------|------|
| **Clinicians** | 1 licensed physiotherapist (supervised) |
| **Patients** | 2–3 test patients first (synthetic or clinic-approved) |
| **Duration** | 60 minutes observation + 15 min debrief |
| **Environment** | Production URL only |
| **Devices** | Clinician laptop + patient phone (portal / assessment) |
| **Network** | Clinic Wi‑Fi + backup hotspot |

---

## Hard rules (non-negotiable)

| Rule | Detail |
|------|--------|
| **No patient-facing AI** | Clinician-only AI draft summary is available for review only |
| **No AI output to patient** | Never share draft text via portal, SMS, or print to patient |
| **No treatment plan mutation from AI** | Generate / Approve / Edit / Dismiss must not change plan |
| **No diagnosis** | RASQ does not diagnose; AI draft is narrative assist only |
| **No clinical scoring** | No recovery grades or readiness scores |
| **No automatic progression** | Clinician decides all phase changes |
| **No patient-facing medical advice** | All clinical communication is clinician-owned |
| **No movement quality judgment** | CV metrics are assistive counts only |
| **No video / landmarks / hipY / raw motion to AI** | Structured data only |
| **Approve / Edit / Dismiss** | Local UI only — not persisted to patient record in v0 |
| **AI disclaimer required** | Must be visible whenever draft is shown |
| **Sit-to-Stand CV only** | Optional; not pilot-critical |
| **Supine / manual exercises** | Manual completion only |
| **Therapist review only** | All flags, CV rows, and AI drafts require clinician judgment |

---

## Roles

| Role | Responsibility |
|------|----------------|
| **Clinician** | Clinical decisions; Generate / Edit / Dismiss; patient communication |
| **Observer (product)** | Timing, checklist, feedback capture — no clinical advice |
| **Patient (test)** | Complete sessions honestly; optional Sit-to-Stand CV |

---

## Pre-session (day before or morning of)

- [ ] Complete `ai-clinician-summary-smoke-test.md` on production
- [ ] Review `known-limitations.md` with clinician
- [ ] Confirm 2–3 test patients created or selected
- [ ] Second device ready for patient portal
- [ ] `pilot-evidence-log.md` and `clinician-feedback-form.md` open
- [ ] Clinician login tested

---

## 60-minute session timeline

| Time | Activity | Owner |
|------|----------|-------|
| **0–5 min** | Frame intended use; state safety boundaries (Section above) | Observer |
| **5–15 min** | Create or select patient → send assessment OR use existing → assign plan | Clinician |
| **15–25 min** | Patient completes portal session — manual exercises; Sit-to-Stand CV **optional** | Patient |
| **25–35 min** | Clinician reviews Progress Snapshot, clinical action, CV rows (if used) | Clinician |
| **35–45 min** | **AI activation block:** Generate → read disclaimer → Edit or Approve → Dismiss | Clinician |
| **45–55 min** | Confirm patient portal has no AI; confirm plan unchanged | Observer + Clinician |
| **55–60 min** | Capture quick feedback; note confusion points | Observer |

---

## AI activation block (35–45 min) — detailed steps

1. Open patient profile (`/clinician/patients/[id]`).
2. Scroll to **AI draft summary — clinician review required**.
3. Read disclaimer aloud with clinician.
4. Click **Generate summary**; wait for draft.
5. Clinician reads draft — assess usefulness and safety wording.
6. Test **Edit** (optional correction) or **Approve** (local badge).
7. Click **Dismiss** — confirm card hides.
8. Optionally **Regenerate** once — compare drafts.
9. Open patient portal on second device — confirm **no AI surface**.
10. Compare plan before/after — confirm **no treatment plan mutation**.

**Say to clinician:** “This draft helps you review session context faster. It is not clinical decision support and does not replace your judgment. You decide what — if anything — goes in the chart or to the patient.”

---

## Patient session block (15–25 min) — detailed steps

1. Patient opens portal link (`/patient/[token]`).
2. Complete today’s session exercises.
3. For **Sit-to-Stand only:** patient may use optional camera OR **Continue without camera**.
4. For **supine / manual exercises:** complete manually — no CV.
5. Submit effort, pain, optional note.
6. Clinician verifies session appears in Progress Snapshot and session activity.

---

## Debrief (within 15 min after session)

- [ ] Fill `pilot-evidence-log.md` for each patient
- [ ] Complete `clinician-feedback-form.md` (including AI questions)
- [ ] Record metrics per `pilot-activation-metrics.md`
- [ ] Log any unsafe wording incidents (target: **zero**)
- [ ] Decide: proceed to next patients / iterate / pause

---

## Stop conditions

**Pause activation immediately if:**

- AI draft appears on patient portal
- Treatment plan changes after Generate / Approve / Edit / Dismiss
- Draft contains diagnosis, progression recommendation, or patient-facing medical advice
- Generate fails repeatedly (503 / key missing)
- Clinician reports they would not trust the feature

---

## After activation (within 48 hours)

- [ ] Roll up metrics in `pilot-metrics-manual-tracker.md`
- [ ] Update team on go/no-go for AI Summary v1 (see PILOT-ACTIVATION-0 report criteria)
- [ ] **Do not** add `project-log.md` entry until this runbook session is complete

---

## Related documents

| Document | Use |
|----------|-----|
| `ai-clinician-summary-smoke-test.md` | Pre-session smoke test |
| `pilot-activation-metrics.md` | Measurement rubric |
| `pilot-checklist.md` | Before / during / after checklist |
| `clinic-pilot-script.md` | Extended demo script |
| `known-limitations.md` | Platform boundaries |
