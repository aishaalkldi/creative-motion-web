# RASQ — Clinician Onboarding Guide (Controlled Pilot)

**Audience:** Licensed physiotherapists and clinic coordinators.  
**Production URL:** https://creative-motion-web.vercel.app  
**Purpose:** Workflow validation under clinician review — not clinical outcome claims.

---

## Before your first login

- Confirm your **provider account** is active (clinic admin or RASQ team).
- Use a **demo or consented patient** per clinic policy.
- Read `known-limitations.md` — **no patient-facing AI**; clinician-only AI draft summary is available for review only (not clinical decision support); no autonomous diagnosis; optional experimental sit-to-stand camera assist only (not pilot-critical, therapist review only, not clinically validated); supine/manual exercises are manual-only.
- Complete `ai-clinician-summary-smoke-test.md` on production before first activation session.
- Review `pilot-activation-runbook.md` for the 60-minute supervised session (1 clinician, 2–3 test patients).
- Legal pages (`/privacy`, `/terms`, `/intended-use`, `/clinical-safety`) are pilot-ready; counsel review is required before commercial contracts.

---

## 1. First login

1. Open **https://creative-motion-web.vercel.app/login**
2. Sign in with your clinician credentials.
3. You land in the **Clinician workspace** (`/clinician`).

**What you see:**

- Dashboard with operational stats
- **Pilot Attention Queue** — neutral follow-up items (assessment pending, plan not assigned, no recent session activity, etc.)
- **Pilot workflow checklist** — optional self-check for pilot steps

**Remember:** RASQ organizes workflow; **you** make all clinical decisions.

---

## 2. Create a patient

1. Go to **Patients** → **New patient** (`/clinician/patients/new`).
2. Enter **full name** and **phone** (required).
3. Optional: age, gender, sport, primary complaint (clinician record only — not shown as a diagnosis in the patient portal).
4. Save → you are redirected to the **patient profile**.

**Operational note:** Patient records belong to the logged-in clinician in this pilot (single-provider scope).

---

## 3. Send a remote assessment

1. On the **patient profile** (`/clinician/patients/[id]`), open **Send remote assessment**.
2. Choose assessment type (e.g. **General MSK** or **Pain & Function**).
3. Confirm sections (pain, ROM, strength, functional, safety screen as applicable).
4. **Generate link** → copy `/assessment/{token}`.
5. Send via SMS, WhatsApp, or email per clinic policy.

**Patient side:** No app install. Patient opens link, accepts consent, completes sections, submits.

**Say to patient:** “This form supports your therapist’s review. It is not a diagnosis.”

---

## 4. Review the patient response

After submission:

1. Refresh **patient profile** or open **Results** (`/clinician/results`).
2. Open **Assessment report** (`/clinician/assessment/report`).
3. Review **patient-reported** answers (Arabic/English as submitted).
4. Complete **clinician-owned** fields (impression, plan notes) as your license requires.

**Do not** present system output as a final diagnosis. Assessment data is **intake for clinician review**.

**Pilot Attention Queue** may show “Assessment submitted — review recommended” until you have reviewed.

---

## 5. Assign a treatment plan

1. From patient profile → **Assign plan** (`/clinician/plans/new?patientId=…`).
2. Select a **program template** (e.g. Knee Rehab — Beginner, Low Back Pain — Beginner).
3. Review sessions and exercises; adjust dose or notes.
4. Add **therapist notes** (visible in patient portal).
5. **Assign to patient** → plan saved; **patient portal link** is generated.

**Remember:** Templates are starting points. **You** choose and assign the program — RASQ does not auto-prescribe.

---

## 6. Review sessions and adherence (operational readiness)

After the patient uses the portal:

### Patient list (`/clinician/patients`)

For each patient you may see:

- **Sessions: N of M** — completed vs planned sessions on the primary plan
- **Last session:** date or “No completed session yet”
- **No recent session** — neutral badge when there has been no logged completion recently (operational follow-up only)
- **Operational status only** — not a clinical adherence score

### Patient profile (`/clinician/patients/[id]`)

- **Session activity** — same operational fields (sessions completed, last session)
- **Progress Snapshot** / **Rehabilitation Journey** — session history and effort/pain logs
- Operational badges (e.g. In rehab, Needs review) — prompts for **your** follow-up

### Results & review queue (`/clinician/results`)

- **Review queue** — pain increase, safety concern, and other flags as **suggested clinician follow-up**
- Acknowledge or document review per clinic protocol

**Important:** These views support **workflow validation** and operational visibility. They do **not** mean the patient “improved clinically” or is “ready to progress” automatically.

---

## 8. AI draft summary (clinician-only, PILOT-ACTIVATION-0)

On the patient profile, you may see **AI draft summary — clinician review required**.

| Rule | Detail |
|------|--------|
| **Who sees it** | Clinicians only — **not** on patient portal |
| **Purpose** | Narrative draft to speed up chart review |
| **Not** | Clinical decision support; does not replace your judgment |
| **Input** | Structured data only — no video, landmarks, or raw motion |
| **Actions** | Approve / Edit / Dismiss — **local UI only** in v0 |
| **Does not** | Diagnose, score clinically, change treatment plan, or recommend progression |

**Workflow:**

1. Read the disclaimer on the card.
2. Click **Generate summary**.
3. Review draft — edit if needed, approve locally, or dismiss.
4. Never assume the draft is sent to the patient — **you** decide all patient communication.

See `ai-clinician-summary-smoke-test.md` for the full smoke test checklist.

---

## 9. If the patient reports pain or a safety concern

### During remote assessment or portal session

Patient-reported flags may appear in the **review queue** (e.g. pain increase, safety concern documented in session flow).

**Your actions:**

1. Open **Results** or the **patient profile** and review the flag context.
2. Contact the patient per **clinic protocol** (phone, in-person, or urgent care as indicated).
3. **Acknowledge** the review item in RASQ when follow-up is documented.
4. Adjust the plan, session dose, or visit schedule **using your clinical judgment** — RASQ does not change treatment automatically.

### Emergency symptoms

If the patient reports **sharp pain**, **chest pain**, **dizziness**, **neurological symptoms**, or other red flags:

- Direct them to **stop** the session.
- Follow clinic **emergency protocol** (local emergency services / urgent visit).
- Do not manage emergencies through RASQ chat or feedback messages alone.

### Patient portal safety copy

Patients see a **safety notice** in the portal (Arabic/English). Reinforce: stop if symptoms feel unusual; contact the therapist.

---

## Quick route reference

| Task | Route |
|------|--------|
| Login | `/login` |
| Dashboard | `/clinician` |
| Patients | `/clinician/patients` |
| New patient | `/clinician/patients/new` |
| Patient profile | `/clinician/patients/[id]` |
| Results / review queue | `/clinician/results` |
| Assign plan | `/clinician/plans/new` |
| Assessment report | `/clinician/assessment/report` |
| Patient portal (patient) | `/patient/[token]` |
| Remote assessment (patient) | `/assessment/[token]` |

---

## Related pilot documents

- `pilot-workflow.md` — End-to-end flow diagram
- `pilot-activation-runbook.md` — 60-minute first activation session
- `ai-clinician-summary-smoke-test.md` — AI v0 smoke test
- `clinic-pilot-script.md` — Live demo script
- `known-limitations.md` — Platform boundaries
- `clinician-feedback-form.md` — After-session feedback
- `patient-guide-ar.md` — Share with Arabic-speaking patients
