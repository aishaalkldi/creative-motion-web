# RASQ — PDPL Readiness Foundation

**Document type:** Technical and operational privacy foundation  
**Status:** Pilot deployment readiness — **not** legal compliance certification  
**Last updated:** 2026-06-05  
**Baseline:** `main` through PR103 (consent); PR104 STS QA documented

---

## Purpose

This document establishes a **privacy-by-design** and **PDPL readiness foundation** for RASQ controlled clinic pilots. It inventories data, states processing boundaries, and records technical controls already implemented in the product.

**This document does not:**

- Certify PDPL or any other legal compliance  
- Replace review by qualified legal counsel  
- Constitute a Data Protection Impact Assessment (DPIA)  
- Make clinical or regulatory claims  

**This document does:**

- Give engineering, product, and clinic operators a shared technical privacy baseline  
- Support pilot deployment planning in jurisdictions where PDPL applies  
- Align with RASQ’s therapist-review-only and data-minimization architecture  

---

## Scope

| In scope | Out of scope (this PR) |
|----------|------------------------|
| Data inventory and classification | Formal legal opinion |
| Purpose limitation and minimization principles | DPA / subprocessors contract pack |
| Consent workflow (PR103) | Consent management dashboard |
| Access control principles (RLS, tokens) | Automated retention enforcement |
| Retention considerations (operational) | Cross-border transfer legal analysis |
| No-video / no-landmark policy | EHR integration privacy review |

---

## Data inventory

High-level stores used in the pilot build:

| Store | Primary contents | Access model |
|-------|------------------|--------------|
| `providers` | Clinician account (auth-linked) | Clinician auth (Supabase) |
| `patients` | Name, contact, clinician-entered context | Provider-scoped RLS |
| `assessments` | Remote assessment responses | Provider-scoped RLS |
| `remote_assessment_requests` | Assessment tokens, status | Provider-scoped RLS |
| `treatment_plans` | Plan metadata, structured plan JSON | Provider-scoped RLS |
| `plan_sessions` | Session exercises, status, completion | Provider-scoped RLS |
| `session_logs` | Pain, effort, exercises completed, notes | Token-scoped patient POST + provider RLS |
| `patient_access_tokens` | Portal magic-link tokens | Server validation; treat as credentials |
| `cv_session_metrics` | Derived CV metrics + `motion_quality` JSONB | Patient token POST; provider RLS on read |
| `clinical_review_acknowledgments` | Clinician review acknowledgments | Provider-scoped RLS |

**Hosting:** Application on Vercel; database and auth on Supabase. Confirm subprocessors and data locations against clinic policy before scale.

---

## Data classification

| Class | Examples in RASQ | Handling principle |
|-------|------------------|-------------------|
| **Identity / contact** | Patient name, clinician account | Collect only what workflow requires; provider-scoped access |
| **Authentication** | Provider credentials via Supabase Auth | Standard identity-provider controls |
| **Access credentials** | Patient portal and assessment tokens | Unguessable tokens; treat URLs as secrets |
| **Health-related (patient-reported)** | Pain score, effort score, assessment answers | Purpose-limited to rehabilitation workflow; clinician review |
| **Health-related (derived movement)** | Rep count, duration, tracking signal, capture quality, motion pilot summaries | Derived only; therapist review; not a clinical assessment |
| **Consent metadata** | `motion_quality.captureConsent` (version, timestamp, surface) | Stored with CV save; audit support |
| **Operational** | Session status, adherence counts, review flags | Workflow prompts only; not autonomous clinical decisions |
| **Forbidden (CV boundary)** | Video, images, raw landmarks, body coordinates, clinical scores | Blocked at API validation; not persisted |

---

## Personal data handled

RASQ processes personal data necessary for clinician-led rehabilitation workflows:

- **Patient identifiers** entered or linked by the treating clinician  
- **Session and plan activity** (completion, timestamps, prescribed exercises)  
- **Patient-reported outcomes** (pain, effort, assessment responses)  
- **Optional derived movement metrics** when the patient enables camera assist  
- **Consent record** when camera metrics are saved (PR103)  

RASQ does **not** require camera use for session completion. Patients may complete exercises manually.

---

## Health-related data handled

Health-related data in the pilot build falls into two categories:

### 1. Patient-reported health information

- Assessment questionnaire responses  
- Session pain and effort scores  
- Free-text notes where enabled  

**Use:** Support clinician review and rehabilitation workflow documentation. Not used for autonomous diagnosis or treatment decisions.

### 2. Derived movement observations (optional CV)

- Rep or cycle counts, session duration, tracking quality label  
- Movement detected flag, capture quality level, reliability flags  
- Structured motion pilot records (e.g. `smtPilot`) — phase ratios, timings, visibility percentages, clinician flags  

**Use:** Assistive movement observations for **therapist review only**. Not clinically validated as standalone assessments.

**Not health imaging:** No medical imaging, video, or raw pose landmark archives are stored.

---

## Purpose limitation

Data is processed for defined purposes only:

| Purpose | Data used |
|---------|-----------|
| Deliver assigned rehabilitation sessions | Plan, session, exercise prescription |
| Record patient-reported session feedback | Pain, effort, completion logs |
| Support remote assessment intake | Assessment responses, tokens |
| Optional camera-assisted movement observation | Derived CV metrics, consent metadata |
| Clinician review and operational follow-up | Metrics, flags, adherence signals |
| Clinician-only AI draft narrative (v0, optional) | Structured session/plan data — no video or landmarks |

**Prohibited purposes in product design:**

- Autonomous diagnosis or differential diagnosis  
- Autonomous treatment or progression decisions  
- Patient-facing medical advice via AI  
- Sale of patient data or repurposing for unrelated advertising  

---

## Data minimization

Technical minimization measures in the current build:

| Layer | Measure |
|-------|---------|
| **CV capture** | On-device processing; only derived aggregates POSTed |
| **API validation** | `cv-forbidden-keys` and `validateCvMotionQualityPayload` reject video, landmarks, scores, diagnosis fields |
| **Motion pilot records** | Allowlisted top-level keys; forbidden-key scans on nested payloads |
| **AI clinician summary v0** | Structured data only; de-identified payload builder; no landmarks or video |
| **Patient path** | Minimum save duration gate; skip camera without save |
| **Consent** | Version + timestamp only; no free-text PHI in consent record |

---

## Consent workflow (PR103)

Before camera access in `PatientCvCapture`:

1. Consent gate displays **before** camera preview.  
2. Patient must check an explicit acknowledgment checkbox.  
3. **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) links are shown.  
4. Copy states: camera-assisted movement observation; therapist review; not diagnostic; no automatic treatment decisions.  
5. On accept, `createPatientCvCameraConsentRecord()` runs (`cv-camera-1.0`, `acceptedAtMs`, `surface: patient_cv_capture`).  
6. On successful CV metrics save, consent is merged into `motion_quality.captureConsent`.  
7. Same browser tab may restore consent from `sessionStorage` (MVP behavior — see pilot checklist).

**Gap:** Consent is stored but **not displayed** in clinician STS review UI. Audit trail is database-level only.

---

## Access control principles

| Actor | Mechanism |
|-------|-----------|
| **Clinician** | Supabase authentication; Row Level Security (`provider_id = auth.uid()`) on clinical tables |
| **Patient (portal)** | Unguessable token in URL; `resolvePatientPortalAccess` validates token → plan → session scope |
| **Patient (CV POST)** | Token-scoped `POST /api/patient/cv-session-metrics`; exercise allowlist; payload validation |
| **Rate limiting** | In-memory limits on sensitive routes (pilot limitation — not durable across instances) |

**Ownership model:** Single-clinician / single-provider scoping in pilot build. Multi-clinic sharing is not implemented.

**Token hygiene:** Portal and assessment links are credentials. Do not share in public channels. Re-issue if compromised.

---

## Data retention considerations

| Topic | Current pilot state |
|-------|---------------------|
| **Retention policy** | Documented at high level on `/privacy`; clinic-specific retention not automated in app |
| **Deletion** | Patients/plans deletable by owning provider subject to RLS; cascade rules per migration |
| **CV metrics** | Persisted until provider/clinic deletes or database policy applies |
| **Consent records** | Stored inside `motion_quality` JSONB on CV rows; no separate retention job |
| **Logs / analytics** | Standard hosting logs may exist — confirm with Vercel/Supabase operator policy |

**Operational recommendation:** Define clinic retention schedule (e.g. post-discharge archive) before commercial deployment. Implement automated retention in a future compliance PR if required by counsel.

---

## Therapist-review-only principle

All movement observations and derived metrics are framed for **licensed clinician review**:

- Patient copy: optional camera; therapist reviews results; not a diagnosis  
- Clinician copy: derived metrics only; review required; not clinically validated alone  
- Assessment Center: observations support therapist review  
- No automatic progression or plan mutation from CV or flags  

---

## No diagnosis policy

RASQ **does not produce** a medical diagnosis, diagnostic label, or differential diagnosis for clinical decision-making without a licensed clinician.

- Product copy uses negation bullets where needed (“does not give a diagnosis…”)  
- API forbidden keys block `diagnosis` in CV payloads  
- Clinician-entered plan fields (e.g. clinician notes) are **user-entered context**, not platform-generated diagnoses  

---

## No autonomous treatment decisions

RASQ **does not** automatically select, dose, modify, or progress treatment without clinician action:

- Plans are assigned by clinicians  
- Exercise completion is patient-driven with clinician review  
- Operational badges (sessions completed, last activity) are **workflow signals**, not clinical scores  
- CV metrics do not trigger plan changes  

---

## No video storage

| Location | Video stored? |
|----------|---------------|
| Patient device during session | Processed in memory only |
| Network POST body | Validated — video keys rejected |
| Supabase `cv_session_metrics` | **No** |
| Supabase any pilot table | **No** |

Camera stream is used for real-time pose inference only. No upload pipeline exists for patient session video.

---

## No raw landmark storage

| Location | Landmarks stored? |
|----------|-------------------|
| MediaPipe output (client) | In-memory per frame |
| Motion timeline (client) | Phase labels and timings — **not** raw coordinates in persisted pilot record |
| `motion_quality` JSONB | Aggregates, ratios, flags — **not** landmark arrays |
| API boundary | `landmarks`, `poseLandmarks`, `bodyCoordinates` forbidden |

---

## Related documents

- `docs/compliance/DATA_FLOW_MAP.md` — Patient → camera → storage flow  
- `docs/compliance/PILOT_PRIVACY_CHECKLIST.md` — Pre-pilot verification  
- `docs/pilot/known-limitations.md` — Clinical and technology boundaries  
- `docs/RASQ_CURRENT_STATE.md` — Platform snapshot  

---

## Counsel review reminder

Before paid contracts, regulated processing at scale, or public compliance claims:

- Engage qualified legal counsel for PDPL and clinic jurisdiction  
- Review Privacy Policy, Terms, DPA, and clinical disclaimers  
- Confirm subprocessors, data residency, and breach notification procedures  

This foundation supports **technical readiness** for pilot planning; it is **not** a substitute for legal sign-off.
