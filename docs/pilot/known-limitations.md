# RASQ Clinic Pilot — Known Limitations

This document states platform limitations for **controlled clinic pilots** and **workflow validation**. Share with clinicians before demo and reference in consent / clinic communications as appropriate.

**Production build:** Through **PR101** on `main` — Assessment Center (STS review + Gait shell), STS capture quality/reliability (PR100), STS adaptive framing readiness (PR101), plus prior clinician operational layer and **AI Clinician Summary Draft v0** (clinician-only). Patient portal has no AI surface.

---

## Clinical scope

### RASQ does not diagnose

RASQ collects **patient-reported** assessment data and presents it for **clinician review**. It does not produce a medical diagnosis, differential diagnosis, or diagnostic label for clinical decision-making without a licensed clinician.

### RASQ does not prescribe autonomously

Exercise programs are **assigned by the clinician** from templates and editable content. RASQ does not automatically select, dose, or modify treatment without clinician action.

### Clinician review is required

Assessment reports, plan assignments, progress interpretation, and review-queue items require **licensed clinician judgment**. Flags (e.g. pain increase, safety concern) are **prompts to review**, not automated clinical decisions.

### Not a substitute for in-person care

Remote assessment and the patient portal support rehabilitation workflow; they **do not replace** in-person evaluation, hands-on examination, or emergency care when indicated.

---

## Technology scope (current pilot build)

### No patient-facing AI — clinician-only AI draft summary (v0)

**No patient-facing AI.** Clinician-only AI draft summary is available for review only.

The pilot build includes **AI Clinician Summary Draft v0** on the clinician patient profile (`/clinician/patients/[id]`). It is **not clinical decision support** and does **not** replace clinician judgment.

**What AI v0 does:**

- Generates a **narrative draft** from **structured data only** (session logs, effort/pain, operational flags) — no video, landmarks, hipY, or raw motion data
- Shows a **required disclaimer** — clinician review required
- Supports **Approve / Edit / Dismiss** — **local UI only** in v0 (not sent to the patient, not persisted to chart)

**What AI v0 does not do:**

- No diagnosis or differential diagnosis
- No clinical scoring or recovery grades
- No automatic progression or phase recommendations
- No treatment plan mutation
- No patient-facing medical advice
- No movement quality judgment
- No AI triage or autonomous treatment recommendations

**Patient portal:** No AI summary surface — patients never see the draft.

### Assessment Center (clinician)

The pilot build includes a clinician **Assessment Center** (`/clinician/assessments`) for structured movement assessment planning and review.

**Live today:**

- **Sit-to-Stand assessment review** (`/clinician/assessments/sit-to-stand`) — lists STS session metrics from patient portal captures for **therapist review only**
- **Gait Assessment v1 shell** (`/clinician/assessments/gait`) — clinician review surface and planned walking metrics; **no live gait capture yet**

**Coming next:** Balance Assessment, Functional Movement, Patient-Reported Forms (cards shown as coming next in Assessment Center).

Assessment modules provide **movement observations to support therapist review** — not diagnostic labels and not automatic treatment decisions.

### Optional patient computer vision (CV) — experimental, not pilot-critical

The pilot build includes **optional, experimental** camera assist during active patient portal exercises (`PatientCvCapture`). It is **not clinically validated** and is **for therapist review only**.

**Sit-to-stand** is the **most mature** CV path (capture quality scoring, reliability flags, adaptive framing readiness as of PR100–PR101). Additional Sports Knee Foundation exercises on the patient CV allowlist (e.g. mini squat, single-leg stance, heel raise, step-up, lateral step, functional reach) may also offer optional camera assist when wired in an assigned plan — treat these as **experimental** unless your clinic demo plan specifies otherwise.

- **The pilot workflow does not depend on CV.** Assessment, plan assignment, session completion, pain/effort reporting, and clinician review work without camera use.
- **Patient choice:** Patients can select **Continue without camera** and complete the session manually.
- **Camera consent (PR103):** Enabling the camera requires an explicit checkbox acknowledgment plus links to Privacy Policy and Terms. Consent version and timestamp are saved in `motion_quality.captureConsent` when metrics are stored (no new database table).
- **If camera tracking fails:** Poor signal, limited setup, or a metrics save error does **not** block exercise completion. Limited captures may be flagged for therapist review and optional retest (PR100).
- **CV-derived metrics** (e.g. rep count, duration, tracking signal, capture quality level) are **therapist-review only** — assistive, not a clinical assessment.
- **What CV does not do:** No diagnosis, no clinical score, no automatic treatment recommendation, and no automatic progression decision. It does not judge whether movement is correct or wrong.

**CV Lab** (`/clinician/cv-lab`) is **internal clinician tooling** for experimentation and review — separate from the **required** patient pilot path. Do not position optional home camera assist as proof of form quality or clinical outcome in pilot communications.

### No voice input in pilot

The current pilot build does **not** rely on voice dictation or speech recognition for patient or clinician workflows in the **supported pilot feature set**.

*(Experimental voice-related code may exist in the repository; it is **not** approved for controlled clinic pilots unless explicitly enabled and documented by the product team.)*

### No clinical scoring or automatic progression

RASQ does **not** compute clinical scores, recovery grades, or “ready to progress” decisions for treatment. Session activity on the clinician **Patients** list and profile (e.g. `Sessions: N of M`, **Last session**, **No recent session**) is **operational readiness** only — labeled **Operational status only** — and requires **clinician review**, not autonomous action.

---

## Operational limitations

### Rate limits are in-memory

API rate limiting for sensitive endpoints uses **in-memory** counters. Limits may **reset on server restart or deployment**. Do not rely on rate limits as durable abuse prevention for production contracts without infrastructure hardening.

Pilot build limits include:

- Patient portal routes (plan, logs, token validation, session complete)
- Remote assessment token routes (GET + submit)
- Clinician write routes (create/update/delete patients, plans, assessments, remote assessment links)

All use per-IP or per-provider sliding windows in process memory — not shared across Vercel instances.

### Single-clinician ownership model

Patient records and plans are scoped to the **authenticated clinician** who created them. Multi-clinic / multi-provider EMR-style sharing is not in pilot scope.

### Token-based patient access

Assessment and portal access use **unguessable tokens** in URLs. Links must be treated as credentials: do not share in public channels; rotate by issuing new links/plans if compromised.

### Deployment and availability

Hosted on Vercel; brief downtime or cold starts may occur. Plan demos with a tested login shortly before the session.

---

## Legal and privacy

### Legal pages are pilot-ready, not counsel-reviewed

The following pages are provided for **pilot transparency** and align with intended-use messaging:

- `/privacy` — Privacy Policy  
- `/terms` — Terms of Service  
- `/intended-use` — Intended Use  
- `/clinical-safety` — Clinical Safety  

They are **not** a substitute for review by qualified legal counsel in your jurisdiction.

### Review before paid contracts

**Privacy policy, terms, data processing agreements, and clinical disclaimers** must be reviewed and updated by legal counsel **before** paid commercial contracts, regulated deployments, or processing of real patient data at scale.

### Data residency and subprocessors

Pilot operators should confirm Supabase / hosting subprocessors and data locations against clinic policy. RASQ pilot docs do not constitute legal advice.

---

## Product boundaries (PILOT-ACTIVATION-0)

The following are explicitly **out of scope** for this pilot activation:

- AI Summary v1 (persistence, audit trail, approved summary storage)
- Patient-facing AI, Coach AI, or Speech AI
- Sports program, Gamification, or Motion Framework
- Supine CV or automatic plan adjustment
- Clinical scoring engines or autonomous progression
- New product features beyond what is already in production

**In scope for PILOT-ACTIVATION-0:** supervised use of existing production features — clinician-only AI draft summary v0, Assessment Center (STS review + Gait shell), optional patient CV (sit-to-stand primary; other allowlisted exercises experimental), manual supine exercises, therapist review only.

---

## What to tell patients (short script)

> “This program supports exercises your physiotherapist assigned. It does not diagnose you or change your treatment on its own. If you see an optional camera during an exercise, it only helps record movement observations for your therapist to review — you can skip it and continue manually. Stop if you feel sharp pain or unwell, and contact your therapist or emergency services as your clinic advises.”

Arabic safety messaging is also shown in the patient portal (`PatientSafetyNotice`).

---

## What to tell clinicians (short script)

> “RASQ organizes remote intake, plans, and home sessions under your license. You review all assessments and flags. The Assessment Center supports structured movement review — Sit-to-Stand session evidence is live; Gait is a planning shell only. No patient-facing AI — a clinician-only AI draft summary is available for your review only; it is not clinical decision support and does not replace your judgment. There is no voice in the supported workflow. Optional camera assist is experimental, therapist-review only, and not clinically validated — sit-to-stand is the most mature path; the pilot does not depend on CV. Legal pages are for pilot use — get counsel sign-off before commercial rollout.”

---

## Related documents

- `docs/RASQ_CURRENT_STATE.md` — Single-page platform state (architecture, PR99–101, pilot readiness)
- `clinician-onboarding-guide.md` — First-time clinician steps  
- `pilot-workflow.md` — End-to-end flow (Sprint V/W operational layer)  
- `patient-guide-ar.md` — Arabic patient handout  
- `clinic-pilot-script.md` — Live demo steps  
- `demo-scenarios.md` — Knee, lumbar, shoulder scenarios  
- `pilot-checklist.md` — Before / during / after checklist  
- `ai-clinician-summary-smoke-test.md` — AI v0 smoke test before activation  
- `pilot-activation-runbook.md` — 60-minute first activation session  
- `pilot-activation-metrics.md` — Activation measurement rubric  
- `pilot-success-metrics.md` — Required pilot metrics  
- `success-metrics.md` — Extended metrics rubrics  
- `pilot-feedback-questions.md` — Clinician and patient questions  

Trust pages in app: https://creative-motion-web.vercel.app/intended-use
