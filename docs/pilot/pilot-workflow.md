# RASQ — Controlled Pilot Workflow

**Purpose:** Single reference for the end-to-end clinician-led path in production.  
**Scope:** Workflow validation and operational readiness — not clinical outcome claims.

**Production URL:** https://creative-motion-web.vercel.app

---

## Full flow (overview)

```
Login
  → Create Patient
    → Send Assessment
      → Patient Submits
        → Clinician Reviews
          → Assign Plan
            → Patient Completes Session
              → Clinician Reviews Progress
                → (Optional) Clinician Generates AI Draft Summary
```

**Note:** AI draft summary is **clinician-only**, optional during PILOT-ACTIVATION-0, and does not replace steps 1–9.

---

## Step-by-step

| # | Actor | Action | Where in RASQ |
|---|--------|--------|----------------|
| 1 | Clinician | Sign in | `/login` → `/clinician` |
| 2 | Clinician | Create patient record | `/clinician/patients/new` |
| 3 | Clinician | Generate remote assessment link | Patient profile → Send remote assessment |
| 4 | Patient | Open link, consent, complete, submit | `/assessment/[token]` |
| 5 | Clinician | Review assessment report; document clinical judgment | `/clinician/assessment/report` · Results |
| 6 | Clinician | Assign rehabilitation plan from template | `/clinician/plans/new` |
| 7 | Clinician | Send patient portal link | Patient profile → portal URL `/patient/[token]` |
| 8 | Patient | Open portal, complete session, submit effort/pain | `/patient/[token]` → session flow |
| 9 | Clinician | Review progress, adherence signals, review queue | `/clinician/results` · `/clinician/patients` · patient profile |
| 10 | Clinician (optional — PILOT-ACTIVATION-0) | Generate AI draft summary; read disclaimer; Approve/Edit/Dismiss (local UI only) | Patient profile → **AI draft summary — clinician review required** |

---

## Clinician workspace (Sprint V — pilot operational layer)

After login, the dashboard supports **controlled pilot** coordination:

| Feature | Purpose |
|---------|---------|
| **Pilot Attention Queue** | Neutral list of patients who may need follow-up (e.g. assessment submitted, no plan, no recent session) |
| **Pilot workflow checklist** | Self-check for demo/pilot steps |
| **Operational badges** | On patient list — e.g. assessment available, plan assigned, in rehab (not clinical scores) |

---

## Adherence & session activity (Sprint W — operational readiness)

Clinician views show **operational** session data only:

| Location | What clinicians see |
|----------|---------------------|
| **Patients list** | `Sessions: N of M` · `Last session: …` · optional **No recent session** badge |
| **Patient profile** | **Session activity** block with same fields |
| **Label** | **Operational status only** — not automated clinical progression |

These fields come from existing plan/session logs. They help clinicians **prioritize follow-up**; they do not replace clinical judgment.

---

## Review queue (clinician follow-up)

| Signal | Meaning for pilot |
|--------|-------------------|
| Pain increase | Patient-reported; **suggested clinician follow-up** |
| Safety concern | Patient-reported; **suggested clinician follow-up** |
| Adherence / operational | Workflow prompts; clinician decides action |

Acknowledgment and documentation remain with the **licensed clinician**.

---

## Optional clinician-only AI draft summary (PILOT-ACTIVATION-0)

On the patient profile, clinicians may use **AI Clinician Summary Draft v0**:

| Aspect | Pilot rule |
|--------|------------|
| **Visibility** | Clinician profile only — **no patient portal AI surface** |
| **Input** | Structured data only — no video, landmarks, hipY, or raw motion |
| **Output** | Narrative draft + **required disclaimer** |
| **Actions** | Approve / Edit / Dismiss — **local UI only** in v0 |
| **Not** | Clinical decision support; does not replace clinician judgment |
| **Does not** | Diagnose, score clinically, recommend progression, mutate treatment plan, or give patient-facing medical advice |

See `ai-clinician-summary-smoke-test.md` and `pilot-activation-runbook.md`.

---

## Optional experimental path (not required)

- **Sit-to-stand camera assist only** — optional, experimental, not clinically validated; derived metrics for **therapist review only**
- **Supine / manual exercises** — manual completion only; no CV
- Patient may **continue without camera**; session completion does not depend on CV
- If tracking fails, the patient completes the exercise manually

## What is explicitly out of this pilot flow

- CV as a **pilot-critical** requirement or success criterion
- Automated form judgment, clinical scoring, or movement quality decisions for patients
- **Patient-facing AI**, Coach AI, Speech AI, or AI triage
- AI-generated treatment recommendations or autonomous clinical decisions
- Autonomous diagnosis or prescription
- Automatic progression to the next program phase
- Clinical scoring engines driving treatment
- Treatment plan mutation from AI Generate
- Sports program, Gamification, or Motion Framework

**CV Lab** (`/clinician/cv-lab`) is **internal clinician tooling** for experimentation — separate from the required patient workflow above.

---

## Parallel paths (reference)

| Path | Token? | Login? |
|------|--------|--------|
| Remote assessment | Yes (`/assessment/[token]`) | No |
| Patient portal | Yes (`/patient/[token]`) | No |
| Clinician workspace | No | Yes (provider account) |

---

## Related documents

| Document | Use |
|----------|-----|
| `clinician-onboarding-guide.md` | First-time clinician setup |
| `clinic-pilot-script.md` | Live 45–60 min demo script |
| `patient-guide-ar.md` | Arabic patient handout |
| `pilot-success-metrics.md` | What to measure |
| `pilot-activation-runbook.md` | 60-minute first activation session |
| `pilot-activation-metrics.md` | AI + CV activation metrics |
| `ai-clinician-summary-smoke-test.md` | AI v0 smoke test |
| `known-limitations.md` | Safety and product boundaries |
| `demo-scenarios.md` | Knee / lumbar / shoulder test cases |
