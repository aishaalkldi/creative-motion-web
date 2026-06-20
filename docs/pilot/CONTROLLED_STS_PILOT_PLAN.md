# RASQ — Controlled Sit-to-Stand CV Pilot Plan

**Document type:** First controlled clinic pilot plan (STS optional camera assist)  
**Status:** Operational plan — not a clinical trial protocol or legal document  
**Last updated:** 2026-06-05  
**Baseline:** `main` through PR103; PR104 STS QA; PR105 PDPL readiness foundation

**Production URL:** https://creative-motion-web.vercel.app

---

## Pilot objective

Validate the **end-to-end RASQ workflow** with **optional Sit-to-Stand camera assist** in a supervised clinic setting:

1. Confirm clinicians can assign plans, patients can complete STS sessions, and therapists can review derived movement observations.  
2. Measure usability of the **consent gate**, **camera setup**, **limited-capture retest**, and **clinician STS review** surfaces.  
3. Collect structured therapist and patient feedback to decide go / no-go for a wider pilot.  

**This pilot validates workflow and product behavior — not clinical efficacy, accuracy, or outcome claims.**

---

## Who can participate

### Clinic

- One licensed physiotherapy clinic (or supervised clinic unit) with a designated **pilot lead therapist**  
- Clinician has completed `docs/pilot/clinician-onboarding-guide.md`  
- Clinic accepts `docs/pilot/known-limitations.md` and briefs patients accordingly  
- Manual smoke and privacy checklists completed before first patient session  

### Patients (3–5 total for first pilot)

- Adults assigned a plan that includes **sit-to-stand** during an active portal session  
- Able to stand and perform sit-to-stand with clinic clearance  
- Can use a smartphone or tablet with camera and stable internet  
- Provided clinic-approved information sheet / verbal briefing on optional camera  
- Willing to complete at least **one guided session** (camera optional)  

### Therapist

- Licensed physiotherapist who assigns the plan and reviews RASQ outputs  
- Available for follow-up within 48 hours of each patient session  
- Does not rely on RASQ metrics as sole basis for clinical decisions  

---

## Who should not participate

| Exclusion | Reason |
|-----------|--------|
| Patients with acute injury, instability, or clinic contraindication to STS | Safety — in-person clinical judgment first |
| Patients unable to safely stand unassisted without hands-on supervision | CV does not replace supervision |
| Patients who cannot consent to optional camera or do not wish to use camera | Use manual completion path only, or defer |
| Pediatric patients without explicit clinic policy approval | Out of current pilot scope |
| Patients expecting automated treatment changes from camera | Product does not auto-progress plans |
| Clinics requiring EHR integration or multi-provider sharing for day one | Not in pilot build |
| Use as sole evidence for insurance, legal, or research claims | Pilot is workflow validation only |

**Camera is optional.** Patients may complete STS manually without participating in CV capture.

---

## Pilot size

| Parameter | First controlled pilot |
|-----------|----------------------|
| **Patients** | **3–5** |
| **Sessions per patient** | Minimum 1 STS session; target 2 if adherence allows |
| **Camera use** | Optional per patient; at least **2 of 3–5** should attempt camera if clinically appropriate |
| **Duration** | 1–2 weeks wall-clock, supervised |

---

## Therapist role

| Responsibility | Details |
|----------------|---------|
| **Clinical gatekeeper** | Confirms each patient is appropriate for home STS and optional camera |
| **Plan assignment** | Assigns plan with sit-to-stand exercise via RASQ |
| **Link delivery** | Sends portal magic link securely (WhatsApp/SMS/in-clinic — per clinic policy) |
| **Pre-session briefing** | Explains optional camera is for movement observations therapist will review; not a test score |
| **Review** | Opens `/clinician/assessments/sit-to-stand` and/or patient profile movement sessions within 48h |
| **Follow-up** | Contacts patient if pain increase, safety concern, or unclear capture quality |
| **Feedback** | Completes therapist feedback section within 48h of each patient week |
| **Does not** | Treat RASQ rep count or tracking signal as clinical grade or automatic progression trigger |

---

## Patient flow

```
Clinician assigns plan with sit-to-stand
        ↓
Patient receives portal link (/patient/[token])
        ↓
Patient opens session → preview → start exercise (active)
        ↓
[Optional] Consent gate → checkbox → Privacy/Terms → Enable camera
        ↓
[Optional] Setup readiness → start tracking → perform STS reps → stop
        ↓
[If limited capture] Amber message + retest guidance (optional try again)
        ↓
Complete sets → pain/effort → session done
        ↓
Therapist reviews STS evidence in Assessment Center / patient profile
        ↓
Therapist documents clinical judgment and patient follow-up as usual
```

**Alternate path:** Patient selects **Continue without camera** → manual completion → session still valid.

---

## Pre-pilot gates (complete before first patient)

### 1. Manual smoke checklist

Complete **Section: Manual smoke checklist** in `docs/pilot/sts-pilot-qa-validation.md` on a real device with a test or first patient token.

| # | Gate | Done |
|---|------|------|
| M1 | Consent before camera | ☐ |
| M2 | Checkbox required | ☐ |
| M3 | Privacy + Terms links | ☐ |
| M4 | Camera optional; skip works | ☐ |
| M5 | STS rep capture + save | ☐ |
| M6 | Clinician STS review shows session | ☐ |
| M7 | Optional: `captureConsent` in DB | ☐ |

### 2. Privacy checklist reference

Complete `docs/compliance/PILOT_PRIVACY_CHECKLIST.md` (items 1–16 minimum). Sign-off required from product/technical lead and clinic pilot lead.

### 3. Clinician briefing

- `docs/pilot/known-limitations.md`  
- `docs/compliance/PDPL_FOUNDATION.md` (summary)  
- `docs/pilot/pilot-workflow.md`  

---

## STS testing steps (per patient session)

Use for each of the 3–5 patients. Record outcomes in `docs/pilot/pilot-evidence-log.md` (no PHI in shared logs unless clinic policy allows).

### Clinician setup (before patient)

| Step | Action |
|------|--------|
| S1 | Confirm sit-to-stand in assigned plan session |
| S2 | Send portal link securely |
| S3 | Confirm patient briefed on optional camera and stop rules |

### Patient session (observed or async)

| Step | Action | Pass criteria |
|------|--------|---------------|
| S4 | Patient opens link and reaches active STS exercise | Portal loads; exercise starts |
| S5 | Consent gate visible if camera path attempted | Gate before preview |
| S6 | Patient checks box and enables camera OR skips | Both paths acceptable |
| S7 | If camera: body visible; framing guidance understandable | Patient can proceed or skip |
| S8 | Perform ≥1 sit-to-stand rep with tracking OR complete manually | Session completes |
| S9 | Submit pain/effort; finish session | Session marked done |
| S10 | If limited capture: patient sees amber + retest message | Message visible when applicable |

### Clinician review (within 48h)

| Step | Action | Pass criteria |
|------|--------|---------------|
| S11 | Open `/clinician/assessments/sit-to-stand` | STS row visible if camera saved |
| S12 | Review motion analysis / capture quality | Disclaimers present; limitations shown if medium/low |
| S13 | Document clinical follow-up decision | Outside RASQ — clinician judgment |

---

## Data collected

When patient uses optional camera and session meets save threshold:

| Data | Location | Purpose |
|------|----------|---------|
| Rep count, session duration | `cv_session_metrics` | Assistive movement observation |
| Tracking quality label | `cv_session_metrics` | Camera signal summary |
| Movement detected flag | `cv_session_metrics` | Session activity indicator |
| Frame counts (aggregate) | `cv_session_metrics` | Technical reliability context |
| `motion_quality.smtPilot` | JSONB | Phase ratios, timings, visibility %, flags |
| `motion_quality.captureQuality` | JSONB (in pilot record) | Quality level, warnings, retest hint |
| `motion_quality.captureConsent` | JSONB | Consent version, timestamp, surface |
| Pain, effort scores | `session_logs` | Patient-reported session feedback |
| Session completion status | `plan_sessions` | Workflow adherence |

See `docs/compliance/DATA_FLOW_MAP.md` for full map.

---

## Data not collected

| Data | Status |
|------|--------|
| Video recordings | **Not stored** |
| Raw camera footage / frame uploads | **Not stored** |
| Pose landmarks / body coordinates | **Not stored** |
| Platform-generated clinical labels | **Not produced** |
| Automatic treatment recommendations | **Not produced** |
| Patient-facing AI summaries | **Not produced** |

---

## Success criteria

Pilot is **successful** if **all** of the following are met:

| # | Criterion |
|---|-----------|
| 1 | **3–5 patients** complete at least one assigned STS session (camera or manual) |
| 2 | **≥2 patients** attempt optional camera path without blocking session completion |
| 3 | **≥2 camera sessions** produce saved `cv_session_metrics` rows reviewable by therapist |
| 4 | **Zero** incidents where patient could not complete session solely due to CV failure |
| 5 | Therapist confirms **consent gate, skip path, and review disclaimers** are understandable (≥4/5 on trust clarity) |
| 6 | **Privacy checklist** signed off; no unexpected video/landmark storage observed |
| 7 | Therapist feedback: **≥3/5** would use RASQ with another patient next week |
| 8 | No **critical** product defect blocking core workflow (assessment → plan → session → review) |

**Success does not require** high rep-count accuracy, clinical outcome improvement, or 100% camera success rate.

---

## Failure criteria

Pilot triggers **no-go or pause** if any of the following occur:

| # | Failure |
|---|---------|
| F1 | Patient safety incident **attributed to following RASQ UI alone** without clinician context |
| F2 | Inability to complete core workflow for **>1 patient** due to platform error |
| F3 | Evidence of **video or raw landmark persistence** in database or network |
| F4 | Consent gate bypassed or camera enabled without checkbox in production build |
| F5 | **>2 of 5** camera attempts fail to save with no manual fallback (skip path broken) |
| F6 | Therapist reports fundamental misunderstanding that RASQ **replaces** clinical judgment (training failure + product copy issue) |
| F7 | Clinic cannot complete privacy checklist sign-off |

**Partial failure** (e.g. limited capture rate high): document, refine STS UX copy/setup guidance, re-pilot with same clinic before expanding.

---

## Therapist feedback form questions

Complete within **48 hours** of each patient week. Log in `pilot-evidence-log.md`.

### Context

| Field | Answer |
|-------|--------|
| Date | |
| Therapist name / role | |
| Patients in STS pilot this week | |
| Camera attempts / manual only | |

### STS-specific questions

1. **STS review usefulness (1–5)**  
   How useful was Sit-to-Stand motion evidence in `/clinician/assessments/sit-to-stand` for your review?

2. **Capture quality clarity (1–5)**  
   When capture quality was medium/low, were limitations understandable?

3. **Consent gate (Y/N + note)**  
   Did patients report confusion about the camera consent checkbox or Privacy/Terms links?

4. **Skip path (Y/N)**  
   Did any patient use **Continue without camera** successfully?

5. **Limited capture / retest (Y/N/N/A)**  
   If limited capture occurred, was retest guidance clear? Did patient retest?

6. **Framing / setup (open)**  
   Any issues with tall-user, small-room, or lighting setup instructions?

7. **Time to review (minutes)**  
   Approximate time to review one STS session in Assessment Center.

8. **Trust (1–5)**  
   I understand RASQ STS metrics support therapist review only and are not a clinical assessment.

9. **Continue STS camera pilot (Definitely / Maybe / No)**  
   Would you include optional STS camera for the next cohort?

10. **Single improvement**  
    One change that would most improve STS pilot for your clinic.

### General (short)

11. **Core workflow friction** — What step took longest?  
12. **NPS (0–10)** — Recommend this controlled STS pilot to a colleague?

---

## Patient feedback questions

Ask within **48 hours** via clinic-approved channel. Use Arabic where appropriate (`patient-guide-ar.md`). **No clinical details in shared logs.**

1. **Link access (Yes / No)** — Could you open the program link easily?

2. **Exercise clarity (Yes / Partially / No)** — Were sit-to-stand instructions clear?

3. **Therapist connection (Yes / No)** — Did the program feel assigned by your therapist?

4. **Camera consent (Yes / Partially / No / N/A)** — If you used the camera, did you understand what it does before enabling?

5. **Skip option (Yes / No / N/A)** — Did you know you could continue without the camera?

6. **Safety (Yes / Partially / No)** — Did you know when to stop if symptoms worsened?

7. **Completion (Yes / Unsure / No)** — Would you complete another session?

8. **One confusion (short text)** — What was most confusing?

### Optional STS camera (if used)

9. **Setup (Easy / OK / Hard)** — Was camera setup easy enough?  
10. **Limited message (Yes / No / N/A)** — If you saw a “limited tracking” message, was it clear?

---

## Go / no-go decision after pilot

Hold a **30-minute review** with product lead, technical lead, and clinic pilot lead within **1 week** of last patient session.

### Inputs

- STS testing step results (S1–S13)  
- Success / failure criteria checklist  
- Therapist feedback (10 questions)  
- Patient feedback (8–10 questions)  
- `pilot-evidence-log.md` and `pilot-metrics-manual-tracker.md`  
- Privacy checklist sign-off  

### Decision matrix

| Outcome | Condition | Next step |
|---------|-----------|-----------|
| **GO — expand pilot** | All success criteria met; no failure criteria; therapist ≥3/5 continue | Add 5–10 patients; same STS scope; document learnings |
| **GO — hold scope** | Success met with minor UX friction | Continue 3–5 cohort; file STS refinement PRs if needed |
| **PAUSE — fix then re-pilot** | Partial failure (F5, high limited-capture rate, consent confusion) | Address issues; re-run manual smoke; same clinic |
| **NO-GO — workflow** | F1, F2, F4, or F6 | Stop camera pilot; core workflow triage; legal/clinical review |
| **NO-GO — privacy** | F3 or F7 | Stop pilot; incident review; counsel engagement |

### Required outputs

| Output | Owner |
|--------|-------|
| Written go / no-go memo (1 page) | Product lead |
| Updated `pilot-evidence-log.md` | Clinic pilot lead |
| Engineering backlog items (if any) | Technical lead |
| Decision communicated to clinic | Product lead |

---

## Related documents

| Document | Use |
|----------|-----|
| `docs/pilot/sts-pilot-qa-validation.md` | Technical QA + manual smoke |
| `docs/compliance/PILOT_PRIVACY_CHECKLIST.md` | Pre-pilot privacy gate |
| `docs/compliance/DATA_FLOW_MAP.md` | Stored vs not stored |
| `docs/pilot/known-limitations.md` | Clinician + patient briefing |
| `docs/pilot/pilot-checklist.md` | General pilot checklist |
| `docs/pilot/pilot-feedback-questions.md` | Extended feedback bank |
| `docs/pilot/pilot-evidence-log.md` | Record pilot evidence |
| `docs/pilot/clinician-onboarding-guide.md` | First-time clinician setup |

---

## Safety reminder

RASQ supports **therapist review only**. All movement observations require licensed clinician judgment. This pilot plan does not authorize outcome claims, clinical accuracy claims, or autonomous treatment use.
