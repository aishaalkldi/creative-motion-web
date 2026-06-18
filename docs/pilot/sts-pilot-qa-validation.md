# RASQ — Sit-to-Stand Pilot QA Validation (PR104)

**Purpose:** Record end-to-end QA validation of the Sit-to-Stand (STS) optional camera pilot workflow after PR100–PR103, without adding product features.

**Baseline validated:** `main` through **PR103** (merge `0614ec4`)

**Validation method:** Code-path review and targeted unit tests (69 cases across consent, readiness, framing, capture quality, reliability, and pilot record pipelines). No live camera browser automation in this pass.

**When to use:** Before a controlled clinic pilot that includes optional STS camera assist. Pair with the manual device smoke checklist below.

---

## Safety framing (read before pilot)

- Camera-assisted movement observations support **therapist review only**.
- RASQ does **not** diagnose, assign clinical scores, or make automatic treatment decisions.
- Patient consent (PR103) requires an explicit checkbox before camera access; acceptance is stored in `motion_quality.captureConsent` when metrics are saved.
- `captureConsent` is persisted for audit but is **not** displayed in clinician STS review UI in this release.
- No database migration, no AI, and no changes to Privacy/Terms legal pages in PR100–PR103 scope.

---

## QA checklist

### Patient flow (STS + PR100–PR103)

| # | Check | How verified |
|---|--------|----------------|
| 1 | Consent gate renders **before** camera preview | `PatientCvCapture` returns consent UI when `!consented` |
| 2 | **Checkbox required** before “Enable camera” | Button `disabled={!consentCheckboxChecked}`; `acceptCameraConsent` guard |
| 3 | Privacy (`/privacy`) and Terms (`/terms`) links present | Links in consent gate |
| 4 | Consent copy uses approved wording | `PATIENT_CV_CONSENT_GATE_EN/AR` — camera-assisted movement observation; therapist review; not diagnostic |
| 5 | “Continue without camera” still available | Skip path unchanged |
| 6 | STS adaptive framing: tall user / small room (`move_back`) | `sts-landmark-coverage` + `evaluateCaptureReadiness` unit tests |
| 7 | Limited capture shows amber confirmation + retest guidance | `sessionCaptureOutcome === "limited"` UI + `resolvePatientSessionCaptureOutcome` tests |
| 8 | Retest CTA (“Try again”) on limited capture | Button wired to `handleTryAgain()` |
| 9 | `captureConsent` merged into POST `motion_quality` | `useCvSessionCapture` → `mergeCaptureConsentIntoMotionQuality` |
| 10 | API accepts and persists `motion_quality` JSONB | `validateCvMotionQualityPayload` + `POST /api/patient/cv-session-metrics` insert |
| 11 | Combined `{ smtPilot, captureConsent }` payload valid | Payload validation (consent + STS pilot record) |

### Clinician flow

| # | Check | How verified |
|---|--------|----------------|
| 12 | STS review route loads patient portal metrics | `/clinician/assessments/sit-to-stand` → `CvReviewSummary` |
| 13 | “Therapist review required” banner | Page amber banner + motion analysis disclaimers |
| 14 | Capture quality section shown for STS pilot sessions | `CaptureQualitySection` when `smtPilot` present |
| 15 | Capture limitations / flags surfaced | Warnings, `capture_setup_limited`, reliability flags |
| 16 | No diagnosis or automatic treatment language in patient STS copy | Copy audit — negation bullets only |
| 17 | Clinician copy frames assistive / review-only | STS assessment page + `MotionAnalysisReportPanel` |

---

## Pass / fail table

| Area | Item | Result | Evidence |
|------|------|--------|----------|
| **Consent (PR103)** | Gate before camera | **PASS** | Consent UI blocks preview until accepted |
| | Checkbox gates enable button | **PASS** | Disabled state + accept handler guard |
| | Privacy/Terms links | **PASS** | `/privacy`, `/terms` |
| | Approved wording | **PASS** | Unified gate copy EN/AR |
| | Session tab re-consent | **PASS*** | *Same browser tab restores consent from `sessionStorage` and may skip gate on later CV exercises — intentional MVP UX* |
| **STS framing (PR101)** | `move_back` + good coverage → can start | **PASS** | Unit: readiness allows STS under advisory `move_back` |
| | Hip loss blocks readiness | **PASS** | Unit: blocks when coverage not ready |
| | Detector integration | **PASS** | `SitToStandDetector` coverage tests |
| **Capture quality (PR100)** | `capture_setup_limited` downgrades quality | **PASS** | `capture-quality` + `sts-motion-pilot-record` tests |
| | Limited session patient message | **PASS** | Limited confirmation + retest guidance copy |
| | Retest button on limited outcome | **PASS** | Post-stop limited UI |
| **Persistence** | `captureConsent` in `motion_quality` JSONB | **PASS** (code) | Merge helper + API validation + DB insert path |
| | Live DB row inspection | **NOT RUN** | Requires manual smoke with patient token |
| | Clinician UI shows `captureConsent` | **N/A** | Out of scope — stored but not displayed |
| **Clinician review** | STS assessment route | **PASS** (code) | `/clinician/assessments/sit-to-stand` |
| | Capture quality + limitations | **PASS** (code) | `CaptureQualitySection` + flags |
| | Review-only language | **PASS** | Therapist review; not diagnostic |
| **Language safety** | No prohibited patient claims | **PASS** | Copy audit |
| **Regression tests** | STS pilot test suite | **PASS** | 69/69 targeted unit tests |

---

## Bugs found

**None.** No code patch required from PR104 validation.

---

## Observations (pilot notes, not defects)

1. **Consent in same tab** — After first checkbox accept, `sessionStorage` may restore consent and bypass the gate for later CV exercises in the same browser tab. Fresh sessions/tabs still require the checkbox.
2. **`captureConsent` is write-only for clinicians** — Persisted at `motion_quality.captureConsent` but not shown on STS review UI. Audit trail exists in DB only.
3. **No automated E2E camera test** — Tall-user/small-room and limited-capture UX are covered by unit tests, not Playwright with a real camera.
4. **Short sessions** — If duration is below minimum save threshold, metrics (and consent) are not persisted. Expected behavior.

---

## Manual smoke checklist (required before clinic pilot)

Run once per clinic environment on a **real patient device** (phone/tablet) before the first supervised STS pilot session.

| # | Step | Pass | Notes |
|---|------|------|-------|
| 1 | Open patient portal magic link → start guided session with STS exercise | ☐ | Exercise step reaches **active** |
| 2 | Confirm consent gate appears **before** camera preview | ☐ | Title: camera-assisted movement observation |
| 3 | Confirm **Enable camera** is disabled until checkbox is checked | ☐ | |
| 4 | Open Privacy and Terms links | ☐ | `/privacy` and `/terms` load |
| 5 | Check box → enable camera → grant browser camera permission | ☐ | Preview starts |
| 6 | Tall user / small room: stand ~2 m away if frame is tight | ☐ | `move_back` advisory may show; tracking can still start when body visible |
| 7 | Complete at least one sit-to-stand rep; stop tracking | ☐ | Rep count and duration update |
| 8 | Optional: use **Continue anyway** / limited setup path | ☐ | Amber limited message + retest guidance + **Try again** |
| 9 | Complete exercise; confirm session finishes without camera blocking workflow | ☐ | Pain/effort flow unchanged |
| 10 | Clinician: open `/clinician/assessments/sit-to-stand` | ☐ | Latest STS row appears |
| 11 | Expand motion analysis report | ☐ | Capture quality + limitations visible for saved pilot session |
| 12 | Confirm copy is review-only (no diagnosis / no automatic treatment language) | ☐ | Patient + clinician surfaces |
| 13 | Optional DB/API check: `motion_quality.captureConsent` on saved row | ☐ | `version: cv-camera-1.0`, `acceptedAtMs`, `surface: patient_cv_capture` |

**Sign-off:** Clinic lead initials ______ Date ______

---

## Pilot readiness statement

**STS optional camera assist is ready for controlled clinic pilot** on `main` (PR100–PR103), **provided** the manual device smoke checklist above is completed successfully for that clinic environment.

Position **sit-to-stand** as the reference CV path. Other allowlisted exercises remain experimental and therapist-review only.

---

## Related documents

- `docs/RASQ_CURRENT_STATE.md` — Platform snapshot
- `docs/pilot/known-limitations.md` — Share with clinicians
- `docs/pilot/pilot-checklist.md` — General pilot checklist
- `docs/pilot/sts-motion-timeline-pilot.md` — STS timeline pilot notes
