# RASQ Clinic Pilot — Clinician Demo Script

**Purpose:** Step-by-step script for a controlled clinic pilot demo.  
**Production URL:** https://creative-motion-web.vercel.app  
**Audience:** Licensed physiotherapists and clinic coordinators.  
**Duration:** 45–60 minutes (live demo + Q&A).

---

## Before you start

- Confirm clinician account login works.
- Use a **demo patient** (not a real identifiable patient unless clinic policy allows).
- Have a second device or browser tab ready for the **patient view** (phone is ideal).
- Mention: RASQ is **clinician-led** — it supports workflow; it does not diagnose or prescribe autonomously.
- Legal pages (`/privacy`, `/terms`, `/intended-use`, `/clinical-safety`) are pilot-ready, not final legal counsel reviewed.

---

## Step 1 — Login

1. Open **https://creative-motion-web.vercel.app/login**
2. Sign in with clinician (provider) credentials.
3. Confirm redirect to **Clinician workspace** (`/clinician` or dashboard).

**Say:** “RASQ is a secure provider workspace. Patient links do not require clinician login.”

---

## Step 2 — Create patient

1. Go to **Patients** → **New patient** (`/clinician/patients/new`).
2. Enter:
   - Full name (demo name, e.g. “Pilot Patient — Knee”)
   - Phone (required)
   - Optional: age, gender, sport, primary complaint (stored for clinician record — not shown as diagnosis to patient in portal)
3. Save → redirect to patient profile.

**Say:** “Patient records are owned by the logged-in clinician. RASQ does not share patients across providers.”

---

## Step 3 — Send remote assessment

1. On the **patient profile** (`/clinician/patients/[id]`), open **Send remote assessment** (modal).
2. Choose assessment type (e.g. **General MSK** or **Pain & Function** for a short demo).
3. Confirm included sections (pain, ROM, strength, etc.).
4. **Generate link** → copy `/assessment/{token}` URL.
5. Send link to patient device (SMS, WhatsApp, or open in second browser).

**Say:** “The patient completes this on their own phone. No app install. Link expires if unused.”

---

## Step 4 — Patient submits assessment

**On patient device (no login):**

1. Open assessment link → accept consent.
2. Toggle **Arabic / English** if needed (assessment supports both).
3. Complete sections → **Review** → **Submit**.
4. Confirm success / “Assessment Submitted” screen.

**Clinician waits:** Refresh patient profile or open **Results** after submission.

**Say:** “Submission is patient-reported only. It supports your review — it is not a diagnosis.”

---

## Step 5 — Clinician reviews assessment summary / report

1. Go to **Results** (`/clinician/results`) or patient profile → **Assessments**.
2. Open **Assessment report** (`/clinician/assessment/report?patientId=…&assessmentId=…`).
3. Walk through:
   - Patient-submitted answers (Arabic answers visible; English translation if enabled)
   - Clinician-owned fields (impression, plan notes) — therapist completes these
4. Do **not** present system output as final diagnosis.

**Say:** “I review patient-reported data and document my clinical judgment here.”

---

## Step 6 — Assign rehabilitation plan

1. From patient profile or **Assign plan** → `/clinician/plans/new?patientId=…`
2. Select a **pilot program template** (e.g. Knee Rehab — Beginner, Low Back Pain — Beginner, Shoulder Mobility — Beginner).
3. Review sessions and exercises; adjust dose or notes if needed.
4. Add **therapist notes** (visible to patient in portal).
5. **Assign to patient** → plan saved; patient portal token generated.

**Say:** “Templates are starting points. I choose the program and dose — RASQ does not auto-prescribe.”

---

## Step 7 — Patient opens portal

1. On patient profile, copy **Patient portal link** (`/patient/{token}`).
2. Open on patient device (no login).
3. Show:
   - Plan overview, sessions, progress summary
   - **Arabic / English** language toggle (header)
   - **Safety notice** and trust footer links

**Say:** “The portal supports my plan. It does not replace an in-person assessment.”

---

## Step 8 — Patient completes a session

1. In portal, tap **today’s session** (or next available session).
2. Walk through prescribed exercises (guidance text respects selected language).
3. Complete session flow.

**Say:** “Patients follow the plan I assigned. They can stop if symptoms are concerning.”

---

## Step 9 — Patient submits effort / pain

1. After session, patient enters:
   - **Effort** (1–10)
   - **Pain** (0–10)
   - Optional note to therapist
2. Submit session completion.

**Say:** “These are patient-reported outcomes for my review — not automated clinical decisions.”

---

## Step 10 — Clinician reviews progress and review queue

1. Return to **Results** (`/clinician/results`).
2. Show **Review queue** (if flags present): pain increase, safety concern, adherence, etc.
3. Open patient **progress** (from results card or `/clinician/progress/[id]`).
4. **Acknowledge review** when appropriate (persistent acknowledgment after migration 007).
5. Optionally open **Patient profile** for full history.

**Say:** “The review queue prioritizes what may need my attention. I decide all clinical actions.”

---

## Step 11 — AI draft summary (PILOT-ACTIVATION-0, clinician-only)

**On clinician device only — patient device stays on portal or closed.**

1. On **patient profile** (`/clinician/patients/[id]`), scroll to **AI draft summary — clinician review required**.
2. Read the **disclaimer** aloud with the audience.
3. Click **Generate summary** → wait for draft.
4. Walk through the draft — confirm it is understandable and does not diagnose or recommend progression.
5. Demonstrate **Edit** (optional correction) or **Approve** (local badge only).
6. Click **Dismiss** — confirm card hides.
7. Open **patient portal** on second device — confirm **no AI summary surface**.
8. Confirm **treatment plan unchanged** after Generate.

**Say:** “No patient-facing AI. This clinician-only draft helps me review session context faster. It is not clinical decision support and does not replace my judgment. Approve, Edit, and Dismiss are local to my browser in v0 — nothing is sent to the patient automatically.”

**Do not:** Share draft text with the patient during the demo unless the clinician chooses to communicate it in their own words outside RASQ.

---

## Closing (2 minutes)

- Recap: intake → remote assessment → plan → portal → session → review → (optional) AI draft summary.
- Point to **Intended Use** and **Clinical Safety** pages.
- Collect feedback using pilot checklist and activation metrics (see `pilot-checklist.md`, `pilot-activation-metrics.md`, `clinician-feedback-form.md`).
- Note known limitations (`known-limitations.md`).

---

## Quick reference — routes

| Step | Route |
|------|--------|
| Login | `/login` |
| New patient | `/clinician/patients/new` |
| Patient profile | `/clinician/patients/[id]` |
| Remote assessment (patient) | `/assessment/[token]` |
| Assessment report | `/clinician/assessment/report` |
| Assign plan | `/clinician/plans/new` |
| Results / review queue | `/clinician/results` |
| Patient portal | `/patient/[token]` |
| Trust pages | `/privacy`, `/terms`, `/intended-use`, `/clinical-safety` |
