# RASQ Clinic Pilot — Known Limitations

This document states platform limitations for **controlled clinic pilots**. Share with clinicians before demo and reference in consent / clinic communications as appropriate.

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

### No AI in pilot

The current pilot build does **not** include AI-generated clinical recommendations, AI triage, or AI interpretation of patient data for treatment decisions.

### No computer vision (CV) in pilot

The current pilot build does **not** include camera-based movement analysis, pose estimation, or automated form checking.

### No voice input in pilot

The current pilot build does **not** rely on voice dictation or speech recognition for patient or clinician workflows in the pilot scope.

*(If experimental voice-related code exists in the repository, it is **not** part of the supported pilot feature set unless explicitly enabled and approved.)*

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

## Product boundaries (unchanged in Sprint E)

Sprint E adds **documentation only**. The following are explicitly **out of scope** for this pilot pack:

- New product features  
- AI, CV, or voice capabilities  
- Changes to clinical logic or scoring engines  
- Database schema changes  
- Security, middleware, or API route changes (unless critically required elsewhere)  
- Platform redesign  

---

## What to tell patients (short script)

> “This program supports exercises your physiotherapist assigned. It does not diagnose you or change your treatment on its own. Stop if you feel sharp pain or unwell, and contact your therapist or emergency services as your clinic advises.”

Arabic safety messaging is also shown in the patient portal (`PatientSafetyNotice`).

---

## What to tell clinicians (short script)

> “RASQ organizes remote intake, plans, and home sessions under your license. You review all assessments and flags. The pilot has no AI, computer vision, or voice. Legal pages are for pilot use — get counsel sign-off before commercial rollout.”

---

## Related documents

- `clinic-pilot-script.md` — Live demo steps  
- `demo-scenarios.md` — Knee, lumbar, shoulder scenarios  
- `pilot-checklist.md` — Before / during / after checklist  
- `success-metrics.md` — How to measure pilot success  

Trust pages in app: https://creative-motion-web.vercel.app/intended-use
