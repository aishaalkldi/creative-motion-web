# RASQ — Pilot Privacy Checklist

**Purpose:** Verify technical and operational privacy controls before any controlled clinic pilot that includes optional camera assist.

**Status:** PDPL Readiness Foundation — not legal certification  
**When to run:** Once per clinic environment before first patient session with camera; repeat after production deploys touching consent, CV, or patient APIs.

**Duration:** ~20–30 minutes (plus optional DB spot-check)

---

## Safety framing

- This checklist confirms **product behavior**, not legal compliance.  
- Complete `docs/pilot/known-limitations.md` briefing with clinicians separately.  
- Engage legal counsel before paid or regulated deployment.  

---

## Pre-pilot verification

| # | Check | Pass | How to verify |
|---|-------|------|---------------|
| 1 | **Consent visible** — gate appears before camera preview | ☐ | Patient portal → active STS exercise → consent screen before video |
| 2 | **Checkbox required** — Enable camera disabled until checked | ☐ | Confirm button disabled; enable only after checkbox |
| 3 | **Privacy link visible** | ☐ | Link to `/privacy` on consent gate; page loads |
| 4 | **Terms link visible** | ☐ | Link to `/terms` on consent gate; page loads |
| 5 | **Therapist review disclaimer present** — patient consent copy | ☐ | Copy mentions therapist review; not diagnostic; no automatic treatment decisions |
| 6 | **Patient token verified** — invalid token rejected | ☐ | Open `/patient/invalid` or bad token → no plan data exposed |
| 7 | **Continue without camera** works | ☐ | Skip path completes session without CV row |
| 8 | **Only derived metrics stored** | ☐ | API/code review: no video/landmark fields in POST schema; forbidden-key validation active |
| 9 | **No video stored** | ☐ | Confirm no upload endpoint; `cv_session_metrics` has no video column |
| 10 | **Capture consent stored** on camera save | ☐ | After STS capture with camera: optional DB/API check for `motion_quality.captureConsent` (`cv-camera-1.0`, `acceptedAtMs`, `surface`) |
| 11 | **Clinician review disclaimer present** | ☐ | `/clinician/assessments/sit-to-stand` amber banner + motion report disclaimers |
| 12 | **Trust pages reachable** | ☐ | `/privacy`, `/terms`, `/intended-use`, `/clinical-safety` |

---

## Clinician briefing (same session)

| # | Item | Done |
|---|------|------|
| 13 | Clinician read `docs/pilot/known-limitations.md` | ☐ |
| 14 | Clinician read `docs/compliance/PDPL_FOUNDATION.md` (summary) | ☐ |
| 15 | Clinic lead accepts token hygiene (links = credentials) | ☐ |
| 16 | Clinic lead accepts in-memory rate limits (pilot limitation) | ☐ |

---

## Optional technical spot-check

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 17 | `POST /api/patient/cv-session-metrics` rejects `landmarks` in body | ☐ | Expect 400 / unable response |
| 18 | Saved row `source` = `patient_session` | ☐ | Supabase or clinician API |
| 19 | `captureConsent` not shown in clinician UI (known gap) | ☐ | Documented — DB audit only for now |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product / technical lead | | | |
| Clinic pilot lead | | | |

**Pilot may proceed with optional STS camera assist when items 1–12 pass** and clinicians are briefed (13–16).

---

## Related documents

- `docs/compliance/PDPL_FOUNDATION.md`  
- `docs/compliance/DATA_FLOW_MAP.md`  
- `docs/pilot/sts-pilot-qa-validation.md` — STS functional smoke  
- `docs/pilot/pilot-checklist.md` — General pilot checklist  
