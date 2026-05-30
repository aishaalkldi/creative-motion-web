# PILOT-ACTIVATION-1 — 60-Minute Supervised Clinic Script

**Track:** PILOT-ACTIVATION-1 (planning only — docs)  
**Status:** Supervised activation script for production  
**Date:** 2026-05-31  
**Production URL:** https://creative-motion-web.vercel.app  
**Production baseline:** `main` @ `8c3342f` (PR #15 — pilot evidence + MQE-0 planning docs)

**Purpose:** Run the **first supervised 60-minute clinic activation** on production with one licensed clinician and 2–3 test patients. Process and observation only — not clinical outcome claims.

**RASQ impact:** None — this document only. No app, API, schema, AI, CV, patient portal, or treatment plan code changes.

---

## Session parameters

| Item | Spec |
|------|------|
| **Clinician** | 1 licensed physiotherapist (supervised) |
| **Patients** | 2–3 test patients (synthetic or clinic-approved per policy) |
| **Duration** | 60 minutes supervised + 15 minutes debrief (separate) |
| **Environment** | **Production only** — no preview URLs for activation |
| **Devices** | Clinician laptop + 1–2 patient phones (portal) |
| **Language** | Clinician-facing: **English only** · Patient: Arabic / English toggle OK |

---

## Hard rules (read aloud at start)

| Rule | Detail |
|------|--------|
| No patient-facing AI | AI draft summary is **clinician-only** |
| No AI output to patient | Never share draft via portal, SMS, or print |
| No treatment plan mutation from AI | Generate / Approve / Edit / Dismiss must not change plan |
| No diagnosis / clinical scoring / automatic progression | RASQ + AI v0 do not decide treatment |
| Sit-to-Stand CV | **Optional only** — not required for session completion |
| Supine / manual exercises | **Manual completion only** — no CV |
| Generate once per patient review | Avoid rapid Regenerate (rate limit observed in smoke test) |
| Therapist review required | All flags, CV rows, and AI drafts require clinician judgment |

**MQE-0 note (observer only):** Movement Completion Analysis is **documented only** — not shown in product UI during this session. Observers may note completion patterns manually for future MQE work.

---

## 1. Pre-session setup checklist

Complete **before** the 60-minute clock starts.

### Environment (15 min prior)

- [ ] Production URL loads: https://creative-motion-web.vercel.app/login
- [ ] Clinician provider account login tested today
- [ ] Clinic Wi‑Fi stable; backup hotspot available
- [ ] Clinician laptop + patient phone(s) charged
- [ ] No PHI on shared screens unless clinic policy allows

### Documentation open (observer)

- [ ] This script (`PILOT-ACTIVATION-1-60-minute-script.md`)
- [ ] `pilot-evidence-log.md` (one row per patient)
- [ ] `clinician-feedback-form.md`
- [ ] `pilot-activation-metrics.md` (reference)
- [ ] `known-limitations.md` (share with clinician)

### Pre-requisites (completed before activation day)

- [ ] `ai-clinician-summary-smoke-test.md` **PASS** on production (2026-05-30 evidence logged)
- [ ] Clinician read `known-limitations.md` and English-only dashboard policy
- [ ] **2–3 test patients** created in production with:
  - [ ] Active treatment plan assigned
  - [ ] Patient portal link copied (`/patient/[token]`) — from **Patient access** on profile
  - [ ] At least one session includes **Sit-to-Stand** (for optional CV) and at least one **supine/manual** exercise
- [ ] Record baseline for each patient before session:
  - [ ] Plan ID / session count / last activity
  - [ ] Screenshot or note: no AI on portal before start

### Roles

| Role | Who | Does |
|------|-----|------|
| **Clinician** | Licensed PT | All clinical decisions; Generate / Edit / Dismiss; patient communication |
| **Observer (facilitator)** | Product / founder | Timing, checklist, data capture — **no clinical advice** |
| **Patient** | Test user | Complete portal honestly; optional camera for Sit-to-Stand only |

---

## 2. What to say to the clinician (English — facilitator script)

Read or paraphrase at **0:00–0:05**.

> “Thank you for supervising this activation on production RASQ. This is a **workflow validation session**, not a clinical outcomes study.
>
> RASQ organizes remote intake, plans, and home sessions under your license. **You** make all clinical decisions.
>
> **What is in scope today:**
> - Patient portal sessions — pain, effort, exercises
> - Optional Sit-to-Stand camera assist — experimental, therapist review only; patients can skip camera
> - Supine and manual exercises — manual completion only
> - **AI draft summary** on the patient profile — English only, clinician review required, local Approve/Edit/Dismiss only
>
> **What is not in scope:**
> - No diagnosis, clinical scoring, or automatic progression from the system or AI
> - No patient-facing AI — patients never see the draft
> - AI does not change treatment plans
>
> **During AI:** use **Generate once** per patient review. If you see a rate-limit message after repeated Regenerate, wait and retry later — that is expected from smoke testing.
>
> **If anything unsafe appears** — AI on the patient portal, plan changes after Generate, or wording you would not trust — tell me immediately and we **stop** the activation block.
>
> I am here to observe and capture feedback, not to advise clinically. Questions before we start?”

**Hand clinician:** `clinician-onboarding-guide.md` reference if needed (optional).

---

## 3. What to say to the patient (optional script lines)

Use clinic-approved consent first. RASQ is assistive only.

### English

> “Your physiotherapist assigned exercises in this app. It supports your rehab program — it does **not** diagnose you or change your treatment on its own.
>
> If you see an **optional camera** for sit-to-stand, it only helps count movement for your therapist to review. You can tap **Continue without camera** and finish manually.
>
> Stop if you feel sharp pain or unwell, and contact your therapist as your clinic advises.”

### Arabic (optional)

> «برنامج التمارين الذي حدده معالجك. لا يشخّصك ولا يغيّر العلاج من تلقاء نفسه.
>
> إذا ظهرت **كاميرا اختيارية** لتمرين الجلوس والوقوف، فهي لعدّ الحركة لمراجعة المعالج فقط. يمكنك اختيار **المتابعة دون كاميرا** وإكمال التمرين يدوياً.
>
> توقف إذا شعرت بألم حاد أو عدم راحة غير معتاد، وتواصل مع المعالج حسب تعليمات العيادة.»

**Do not mention AI summary to the patient** — it is clinician-only.

---

## 4. Exact 60-minute timeline

**Assumption:** 2–3 patients have **plans already assigned** and portal links ready. Full assessment intake is **not** required in this hour unless pre-staged.

| Time | Activity | Owner | Patients |
|------|----------|-------|----------|
| **0:00–0:05** | Safety framing; confirm hard rules; confirm test patient IDs | Facilitator | All |
| **0:05–0:08** | Clinician login → **Dashboard** `/clinician` | Clinician | — |
| **0:08–0:22** | **Patient 1** — portal session (optional Sit-to-Stand CV + manual exercise) | Patient | P1 |
| **0:22–0:32** | **Patient 1** — clinician review + AI block + portal safety check | Clinician + Facilitator | P1 |
| **0:32–0:42** | **Patient 2** — portal session (same rules) | Patient | P2 |
| **0:42–0:50** | **Patient 2** — clinician review + AI block + portal safety check | Clinician + Facilitator | P2 |
| **0:50–0:57** | **Patient 3** (if used) — abbreviated: portal session OR review-only if session pre-done | Patient / Clinician | P3 |
| **0:57–0:60** | Session-wide PASS/FAIL checklist; schedule 15-min debrief | Facilitator | All |

**If only 2 patients:** extend P1/P2 AI and review blocks by 3–4 minutes each.

**If Patient 3 time-constrained:** skip portal; run **Generate → Dismiss** only on pre-existing session data and log as “abbreviated.”

---

## 5. What screens to open in RASQ

### Facilitator + clinician — every patient cycle

| Step | Route / screen | What to verify |
|------|----------------|----------------|
| Login | `/login` → `/clinician` | Dashboard loads; **Pilot Attention Queue** visible if items exist |
| Patient list | `/clinician/patients` | Test patients listed |
| Patient profile | `/clinician/patients/[id]` | **Progress Snapshot** · **Session activity** · **Patient access** (portal link) |
| Movement tracking | Profile → `#movement-tracking-sessions` | CV rows if Sit-to-Stand used; disclaimer visible |
| AI summary | Profile → **AI draft summary — clinician review required** | Disclaimer before Generate |
| Results (optional) | `/clinician/results` | Review queue if pain/safety flags |
| Patient portal | `/patient/[token]` (phone) | Plan · session · language toggle · **no AI** |

### Patient phone — per session

| Step | Route | Notes |
|------|-------|-------|
| Portal home | `/patient/[token]` | Arabic/English toggle if needed |
| Session flow | `/patient/[token]/session/[sessionId]` | Complete exercises; submit effort/pain |
| Sit-to-Stand only | In-session CV card | Optional camera OR **Continue without camera** |
| Supine / manual | Same session | No camera surface |

### Do not use during activation

- `/clinician/cv-lab` — internal lab; not required path
- Rapid **Regenerate** loop on AI card
- Any non-production URL

---

## 6. What data to record

### Per patient — `pilot-evidence-log.md`

| Field | Record |
|-------|--------|
| Date / clinician / patient ID | Required |
| Portal session completed | Y / N |
| Sit-to-Stand CV used | Y / N / skipped |
| Manual exercises only path | Y / N |
| AI Generate success | Y / N / rate-limited |
| AI disclaimer seen | Y / N |
| Approve / Edit / Dismiss tested | Y / N |
| Patient portal: no AI surface | PASS / FAIL |
| Plan unchanged after AI | PASS / FAIL |
| Unsafe AI wording | None / describe |
| Clinician usefulness (1–5) | Score |
| Highest friction step | Free text |

### Session-level — observer notes

| Metric | Source |
|--------|--------|
| Start / end time | Wall clock |
| Generate latency (qualitative) | fast / acceptable / slow / error |
| Rate limit encountered | Y / N |
| CV save success | Y / N / not used |
| Confusion points (clinician / patient) | Free text |
| Device / network issues | Free text |

### After session — `clinician-feedback-form.md` + `pilot-activation-metrics.md`

Roll up: AI usefulness average, trust (Y/Maybe/N), time saved estimate, zero unsafe wording target.

---

## 7. PASS / FAIL criteria

### Session PASS (all required)

| # | Criterion |
|---|-----------|
| 1 | Clinician completed supervised flow for **≥ 2 patients** |
| 2 | Each patient: portal session completed **or** valid manual completion path documented |
| 3 | Each patient: **Generate** succeeded at least once **or** rate-limit logged with prior successful draft (smoke-test pattern) |
| 4 | **AI disclaimer** visible with every draft |
| 5 | **Patient portal:** no AI summary, Generate button, or draft text — **all patients PASS** |
| 6 | **Treatment plan unchanged** after AI actions — **all patients PASS** |
| 7 | **Zero unsafe wording** reaching clinician without Dismiss (no diagnosis, progression, clinical score, movement quality judgment in draft) |
| 8 | Clinician confirms they understand AI is **review-only** and English-only |
| 9 | Optional CV: if used, session completed with or without camera; supine remained manual-only |

### Session FAIL (any one fails session)

| # | Criterion |
|---|-----------|
| F1 | AI surface visible on patient portal |
| F2 | Treatment plan mutated after AI Generate / Approve / Edit / Dismiss |
| F3 | Unsafe draft wording not dismissed; clinician would have acted on it as clinical fact |
| F4 | Generate unusable for majority of patients (persistent 503 / outage) |
| F5 | Clinician states they would **not** use Generate again (majority N on trust) |
| F6 | Observer unable to confirm safety boundaries were followed |

### Partial PASS

Document as **PARTIAL** if rate-limit blocked Regenerate but **first Generate passed**, portal/plan checks passed, and clinician usefulness ≥ 3/5 for patients attempted.

---

## 8. Stop rules

**Stop the activation immediately** (pause clock; do not continue AI or portal demo):

| Trigger | Action |
|---------|--------|
| AI draft or Generate controls on **patient portal** | Stop · log FAIL · do not merge or patch in session |
| **Plan mutation** after AI action | Stop · capture before/after · log FAIL |
| Draft contains **diagnosis**, **progression recommendation**, or **patient-facing medical advice** | Clinician **Dismiss** · log incident · stop AI block for session |
| Persistent **Generate failure** (not single rate-limit after success) | Stop AI block · complete non-AI workflow only if clinician agrees |
| Clinician distress or refusal to continue | Stop · debrief |
| Patient medical emergency | Follow clinic emergency protocol — RASQ observation secondary |

**After stop:** complete debrief; do **not** add `docs/project-log.md` until leadership review.

---

## 9. Post-session debrief questions (15 min — separate)

Ask clinician in English. Capture in `clinician-feedback-form.md`.

### Workflow

1. Which step took the longest — setup, portal, review, AI, or link delivery?
2. Was **Progress Snapshot** and session activity helpful for prioritization?
3. Any confusion between **operational badges** and clinical judgment?

### AI summary v0

4. Usefulness 1–5 per patient — average?
5. Would you use **Generate** again next week? Y / Maybe / N
6. Was the **disclaimer** clear and sufficient?
7. Did **Edit / Approve / Dismiss** match your expectation (local only)?
8. Any rate-limit message — did it affect trust?
9. Anything you would **not** want shown to a patient from the draft?

### CV (if used)

10. Was optional Sit-to-Stand camera clear? Skip path obvious?
11. Were **Movement tracking sessions** rows understandable as assistive metrics?

### Patient portal

12. Language toggle (AR/EN) — any issues?
13. Did patients understand optional camera is not required?

### Overall

14. Single biggest improvement for the next activation session?
15. Ready for another supervised session with real clinic patients under policy? Y / N / with changes

---

## 10. Go / No-Go decision after session

Facilitator proposes; clinician input required. **Documentation only** — no product changes in this track.

### GO — schedule PILOT-ACTIVATION-2 (more patients or second clinician)

All true:

- [ ] Session PASS or acceptable PARTIAL (see §7)
- [ ] ≥ 2 patients with complete evidence log rows
- [ ] AI usefulness average **≥ 3/5**
- [ ] Trust: **Y or Maybe** from clinician
- [ ] Zero portal AI leakage incidents
- [ ] Zero plan mutation incidents
- [ ] Zero un dismissed unsafe wording incidents
- [ ] Clinician agrees to continue under same boundaries

### NO-GO — pause activation; fix process or product separately

Any true:

- [ ] Session FAIL (§7)
- [ ] Stop rule triggered (§8)
- [ ] Clinician trust **N** with no mitigation path agreed
- [ ] Repeated Generate failure beyond documented rate-limit pattern
- [ ] Observer or clinician recommends halt until engineering/docs review

### NO-GO does not mean

- Rewriting treatment content in session
- Enabling MQE UI, Arabic clinician UI, or AI v1 in production without approval
- Changing CV detector logic during activation day

### Next artifacts (if GO)

- [ ] Update `pilot-evidence-log.md` for all patients
- [ ] Roll metrics in `pilot-metrics-manual-tracker.md`
- [ ] Optional: `project-log.md` entry **only after** leadership approves (not automatic)
- [ ] Consider MQE-0 **Option B** (clinician-only read-time flag) as separate approved track

---

## Per-patient micro-script (repeat ×2–3)

**Clinician path (~10 min each after portal done):**

1. Open `/clinician/patients/[id]` — note session activity.
2. Scroll **Movement tracking sessions** if CV used — read reps / tracking signal (not quality).
3. **AI block:** Read disclaimer → **Generate once** → review draft → **Edit** or **Approve** → **Dismiss**.
4. Facilitator opens `/patient/[token]` on phone — confirm **no AI**.
5. Refresh profile — confirm plan unchanged.
6. Log row in `pilot-evidence-log.md`.

**Patient path (~12 min each):**

1. Open portal link.
2. Start today’s session.
3. Complete supine/manual without camera.
4. Sit-to-Stand: camera **or** Continue without camera.
5. Submit effort / pain.
6. Confirm “session saved” or equivalent UX.

---

## Related documents

| Document | Use |
|----------|-----|
| `pilot-activation-runbook.md` | PILOT-ACTIVATION-0 runbook (reference) |
| `pilot-activation-metrics.md` | Measurement rubric |
| `ai-clinician-summary-smoke-test.md` | Pre-requisite smoke test |
| `pilot-evidence-log.md` | Evidence including rate-limit note (PR #15) |
| `docs/mqe/MQE-0-movement-completion-analysis.md` | Future completion layer (not in UI) |
| `known-limitations.md` | Platform boundaries |
| `clinician-feedback-form.md` | Post-session form |
| `clinic-pilot-script.md` | Extended demo (45–60 min alternate) |

---

## Document control

| Field | Value |
|-------|-------|
| Track ID | PILOT-ACTIVATION-1 |
| Production baseline | `8c3342f` |
| RASQ code impact | **None** |
| Commit | **Not committed** until explicitly approved |
