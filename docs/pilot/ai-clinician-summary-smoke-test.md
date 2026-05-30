# RASQ — AI Clinician Summary Smoke Test

**Purpose:** Pre-activation checklist to verify **AI Clinician Summary Draft v0** on production before the first supervised clinic session.

**Production URL:** https://creative-motion-web.vercel.app

**When to run:** Once per clinician before PILOT-ACTIVATION-0, and again after any production deploy that touches AI summary.

**Duration:** ~30 minutes

**Prerequisite:** Clinician provider account; at least one patient with an active plan and session history (test or clinic-approved).

---

## Safety framing (read before testing)

- **No patient-facing AI.** Clinician-only AI draft summary is available for review only.
- AI v0 is **not clinical decision support** and does **not** replace clinician judgment.
- The draft does **not** diagnose, score clinically, recommend progression, change treatment plans, or judge movement quality.
- AI input is **structured data only** — no video, landmarks, hipY, or raw motion data.
- **Approve / Edit / Dismiss** are **local UI only** (browser state) — not sent to the patient.
- The **disclaimer** must always appear with the draft.

---

## Pre-flight (5 min)

| # | Step | Pass | Notes |
|---|------|------|-------|
| 1 | Sign in at `/login` | ☐ | Clinician workspace loads |
| 2 | Open **Patients** → select patient with active plan | ☐ | Profile at `/clinician/patients/[id]` |
| 3 | Confirm **Progress Snapshot** visible | ☐ | Rules-based card (not AI) |
| 4 | Record plan state before test | ☐ | Sessions completed, plan ID, last activity |

---

## AI Clinician Summary v0 (10 min)

| # | Step | Pass | Notes |
|---|------|------|-------|
| 5 | Locate card: **AI draft summary — clinician review required** | ☐ | After Progress Snapshot, before Movement tracking |
| 6 | Read on-card disclaimer | ☐ | States clinician review required; no diagnosis / scoring / treatment recommendation |
| 7 | Click **Generate summary** | ☐ | No error; loading completes |
| 8 | Confirm draft text appears | ☐ | Narrative only; understandable to clinician |
| 9 | Confirm closing safety line in draft | ☐ | Includes: *“No automatic plan changes are suggested. Therapist review required.”* |
| 10 | Click **Approve** | ☐ | Local “Approved locally” badge only |
| 11 | Click **Edit** | ☐ | Inline textarea works; clinician can change text |
| 12 | Click **Dismiss** | ☐ | Card hides; no server write |
| 13 | Click **Regenerate** | ☐ | New draft replaces prior (clinician-only) |

---

## Safety checks (10 min)

| # | Step | Pass | Notes |
|---|------|------|-------|
| 14 | Open patient portal link (`/patient/[token]`) | ☐ | **No AI summary** card, button, or draft text |
| 15 | Re-check clinician plan after Generate / Approve / Edit / Dismiss | ☐ | **No treatment plan mutation** |
| 16 | Scan draft for unsafe wording | ☐ | No diagnosis, progression advice, clinical score, movement quality judgment, or exercise dose change |
| 17 | Clinician can paraphrase draft in one sentence | ☐ | Summary is understandable |

---

## Sit-to-Stand CV (optional, 10 min)

| # | Step | Pass | Notes |
|---|------|------|-------|
| 18 | Patient completes Sit-to-Stand session (with or without camera) | ☐ | Session completes; pain/effort saved |
| 19 | Clinician **Movement tracking sessions** block | ☐ | CV rows display: reps, duration, visibility label, movement detected |
| 20 | Labels are technical, not clinical | ☐ | e.g. “Limited camera visibility” — not “bad form” |
| 21 | “Continue without camera” path | ☐ | Session still completes manually |
| 22 | Supine / manual exercises | ☐ | Manual completion only — no CV surface |

---

## Sign-off

| # | Item | Result |
|---|------|--------|
| 23 | Clinician would use Generate again next week | Y / N |
| 24 | Blockers (login, save, broken link, AI 503) | None / describe |
| 25 | Smoke test complete | Date: ______ Clinician: ______ Patient ID: ______ |

---

## Fail actions

| Failure | Action |
|---------|--------|
| Generate returns error or 503 | Check `OPENAI_API_KEY` on Vercel Production; redeploy; retest |
| Unsafe wording in draft | Dismiss; log in `pilot-evidence-log.md`; do not share with patient |
| AI visible on patient portal | **Stop activation** — report to product lead |
| Plan changed after Generate | **Stop activation** — report to product lead |
| Patient-facing medical advice in draft | Dismiss; log unsafe wording incident |

---

## Related documents

- `pilot-activation-runbook.md` — 60-minute supervised activation session
- `pilot-activation-metrics.md` — What to measure during activation
- `known-limitations.md` — Platform boundaries including AI v0
- `clinician-feedback-form.md` — Post-session clinician questions
