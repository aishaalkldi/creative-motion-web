# RASQ Pilot Evidence Log

**Purpose:** Single session record for controlled clinic demo evidence — before in-app analytics or dashboards exist.

**When to use:** After each pilot session (demo day or real clinic week).

**Related docs:** `clinician-feedback-form.md` · `patient-feedback-message.md` · `pilot-metrics-manual-tracker.md` · `investor-proof-template.md`

---

## Session record

| Field | Entry |
|-------|-------|
| **Date** | |
| **Clinic / clinician** | |
| **Recorded by** | |
| **Pilot type** | Demo / Live clinic / Mixed |

---

## Activity counts

Fill from clinician workspace observation or manual counts. Leave blank if not applicable.

| Metric | Count |
|--------|-------|
| **Number of patients tested** | |
| **Assessments sent** | |
| **Assessments completed** | |
| **Plans assigned** | |
| **Sessions completed** | |
| **Review flags raised** | |
| **Review flags reviewed** | |

---

## Qualitative evidence

### Main clinician quote

> _Verbatim or near-verbatim. Attribute by role only if needed (e.g. "Lead PT")._

---

### Main patient quote

> _From feedback message or observed comment. No PHI beyond first name if policy allows._

---

### Biggest workflow issue

_Describe the single highest-friction step — setup, link delivery, review, portal, language, etc._

---

### Proof moment screenshot description

_Describe one screenshot that best shows RASQ working in clinic context. Do not embed PHI._

| Field | Description |
|-------|-------------|
| **What is on screen** | e.g. Review Queue flag → clinician acknowledgment on patient profile |
| **Why it matters** | e.g. Clinician said they would have missed the pain increase without the flag |
| **File name / location** | e.g. `pilot-screenshots/2026-05-25-review-queue.png` (store outside repo if PHI) |

---

## Session notes (optional)

| Topic | Notes |
|-------|-------|
| What worked well | |
| What confused clinicians | |
| What confused patients | |
| Safety or privacy concerns | |
| Follow-up actions | |

---

## Sign-off

| Check | Done |
|-------|------|
| Counts copied to `pilot-metrics-manual-tracker.md` | ☐ |
| Clinician feedback form completed | ☐ |
| Patient feedback sent (if applicable) | ☐ |
| Investor proof draft started (`investor-proof-template.md`) | ☐ |

---

## Log history (copy block for each new session)

## 2026-05-30 — AI Clinician Summary v0 Smoke Test

Environment:
Production — https://creative-motion-web.vercel.app

Result:
PASS

Confirmed:
- Clinician patient profile loaded.
- AI draft summary card appeared.
- Generate Summary worked.
- Draft summary appeared.
- Safety disclaimer appeared.
- Required safety line appeared:
  “No automatic plan changes are suggested. Therapist review required.”
- No unsafe wording observed.
- Dismiss worked and hid the card locally.
- Regenerate worked and showed a new draft.
- Movement tracking sessions remained visible.
- Patient portal secure link opened successfully.
- Patient portal displayed the rehabilitation plan page.
- No AI draft summary appeared in the patient portal.
- No Generate Summary button appeared in the patient portal.
- No Approve / Edit / Dismiss controls appeared in the patient portal.
- General `/patient` demo page also did not expose AI; the secure `/patient/[token]` link is the valid patient portal check.
- Treatment plan remained unchanged after clinician AI actions and refresh.

Notes:
This was a product smoke test only, not a clinical note. The AI summary remained clinician-only and did not appear in the patient portal. AI summary did not show diagnosis, clinical scoring, progression recommendation, movement quality judgment, or treatment plan changes.

Rate-limit observation:
During repeated Generate/Regenerate testing, the clinician card displayed:
“AI service rate limit reached. Try again shortly.”

Interpretation:
- Generate Summary had already worked successfully.
- A safe clinician-only draft was returned.
- The required safety line was present:
  “No automatic plan changes are suggested. Therapist review required.”
- The rate-limit message appeared only after repeated rapid Generate/Regenerate attempts.
- No AI appeared in the patient portal.
- No treatment plan mutation occurred.

Pilot recommendation:
During pilot activation, use Generate once per patient review.
Avoid repeated rapid Regenerate clicks.
If rate limit appears, wait briefly and retry later.

---

## 2026-07-13 — STS Shadow Pilot Validation (Input Acquisition Layer)

Environment:
Local development — branch `task/sts-shadow-pilot-validation` @ `8e00c85`

Harness:
`runStsShadowSessionComparison()` via `app/lib/cv/sts-shadow-pilot-validation.test.ts` (development-only; not wired to live capture)

Result:
**PASS** — pilot-representative synthetic scenarios agreed; expected divergences only in deliberate edge cases.

Scenarios (165 frames total):

| Scenario | Frames | Divergent | Rate | Notes |
|----------|--------|-----------|------|-------|
| Nominal pilot STS (seated→stand→seated) | 60 | 0 | 0% | Good/fair/poor tiers matched legacy path throughout motion cycle |
| Poor hip visibility session | 30 | 0 | 0% | Both paths agreed `poor` |
| Fair-tier visibility hold | 20 | 0 | 0% | Both paths agreed `fair` |
| Intermittent off-screen left hip | 40 | 10 | 25% | Expected: `new_frame_missing_hip_joint`, `tracking_quality_mismatch` (frames 25–34) |
| Raw visibility > 1.0 (clamp delta) | 15 | 15 | 100% | Expected: `hip_visibility_sum_delta_exceeds_tolerance` only; tiers still matched (`good`) |

Confirmed:
- Legacy and Input Acquisition Layer paths agree on hip tracking quality for nominal pilot framing (in-frame hips, visibility 0.82).
- Legacy and new paths agree on `poor` and `fair` tiers for low-visibility synthetic sessions.
- Deliberate off-screen hip framing surfaces the documented acquisition-layer behavior (hip omitted when coordinates outside `[0,1]`).
- Visibility clamping divergence is isolated to sum-delta reporting; tracking tier remains aligned when both hips in frame.
- No live capture components, `sit-to-stand-detector.ts`, APIs, database code, or patient identity logic were modified.
- Unit tests: 25/25 pass (`sts-shadow-comparison.test.ts`, `sts-shadow-log.test.ts`, `sts-shadow-pilot-validation.test.ts`).
- `npm run build` completed successfully.

Not validated (deferred):
- Real recorded clinic landmark sequences (camera + patient variability).
- Live per-frame shadow hook inside `SitToStandDetector` capture loop.
- Rep-count or session-metrics impact (harness compares tracking quality only).

Pilot recommendation:
Proceed with pilot STS using the existing live detector. Keep shadow harness offline until a recorded clinic session can be replayed through `runStsShadowSessionComparison()` and reviewed before any live wiring PR.

Re-run command:
`npx tsx --test app/lib/cv/sts-shadow-pilot-validation.test.ts`

---

<!--

Duplicate the section below for each pilot session.

---

### Session — [DATE]

| Field | Entry |
|-------|-------|
| Clinic / clinician | |
| Patients tested | |
| Assessments sent / completed | / |
| Plans assigned | |
| Sessions completed | |
| Review flags raised / reviewed | / |
| Main clinician quote | |
| Main patient quote | |
| Biggest workflow issue | |
| Proof moment | |

-->
