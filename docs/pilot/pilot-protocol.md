# RASQ — Supervised Clinic Pilot Protocol

**Version:** Post MQ-READY · MQ-SIGNAL-1A/1B · MQ-REP-1 SHADOW-0  
**Purpose:** Controlled, clinician-led validation of RASQ workflow including **optional** Sit-to-Stand camera assist.  
**Scope:** Workflow, usability, trust, and safety — **not** clinical efficacy or movement-quality validation.

**Production URL:** https://creative-motion-web.vercel.app

---

## 1. Pilot objectives

1. Confirm clinicians can assign plans, share portal links, and review session activity.
2. Confirm patients can complete sessions **with or without** optional camera assist.
3. Measure whether saved CV-derived metrics (when used) are **understandable and useful** for therapist review.
4. Identify friction, confusion, and trust gaps before any new CV features (e.g. per-rep flags) are exposed.

**This pilot does not prove:** clinical improvement, diagnostic accuracy, movement quality, or algorithm validation.

---

## 2. Scope and boundaries

### In scope

| Area | Detail |
|------|--------|
| Workflow | Assess → plan → patient portal → session completion → clinician review |
| Exercise with optional CV | **Sit-to-Stand only** |
| Camera | Optional; patient may **continue without camera** |
| Saved CV metrics | Reps, duration, tracking signal, movement detected, frame counts |
| Languages | Patient portal EN/AR |

### Out of scope

| Area | Detail |
|------|--------|
| Per-rep capture flags | Shadow FSM — internal only, not shown or saved |
| Video / landmarks / hipY | Never stored |
| AI / MQE | Not in production |
| Clinical scoring | Not in product |
| Automatic treatment recommendation | Not in product |
| Automatic progression | Not in product |
| Patient-facing movement judgment | Not in product |
| Multi-exercise CV | Not supported |

---

## 3. Roles

| Role | Responsibility |
|------|----------------|
| **Lead clinician** | Patient selection, plan assignment, portal link delivery, clinical interpretation |
| **Observer / pilot lead** | Timing, manual rep counts, feedback forms, issue log |
| **Patient** | Completes assigned session; opts in or out of camera |
| **Technical contact** | Save failures, link issues, deployment smoke checks |

All clinical decisions remain with the **licensed clinician**.

---

## 4. Recommended pilot shape

| Parameter | Suggestion |
|-----------|------------|
| Clinics | 1 |
| Clinicians | 1–2 |
| Patients | 5–10 |
| Duration | 2 weeks supervised |
| Supervision | First patient use: clinician or staff present or on call |
| Device | Patient’s own smartphone (HTTPS required for camera) |

---

## 5. Pre-pilot checklist

- [ ] Clinician account active; test login on production
- [ ] Test patient + plan with Sit-to-Stand exercise prepared
- [ ] Patient portal link tested (open, language toggle, session flow)
- [ ] **Continue without camera** path tested once
- [ ] Optional camera path tested once (consent → readiness → 2–3 reps → save)
- [ ] Clinician profile shows Movement tracking session row after save
- [ ] `clinician-one-pager.md` reviewed with clinic staff
- [ ] `patient-camera-framing-card-ar.md` shared if Arabic-speaking patients
- [ ] `pilot-feedback-form.md` ready (print or digital)
- [ ] Clinic internal approval / ethics note if required

---

## 6. Session procedure (patient)

### Path A — Without camera (required to demonstrate at least once)

1. Patient opens portal link.
2. Starts assigned session containing Sit-to-Stand.
3. When prompted for camera, chooses **Continue without camera**.
4. Completes exercises manually; finishes session (effort/pain if applicable).
5. Observer records: camera opt-in = **No**, save outcome.

### Path B — With optional camera (Sit-to-Stand)

1. Patient reads camera consent (no video upload, no landmark storage, no movement judgment).
2. Accepts consent → **Start movement tracking**.
3. Waits for readiness check (~2 s); positions phone per framing card.
4. Starts **seated**; performs 3–5 slow sit-to-stand cycles.
5. Session saves automatically on navigation/completion (no Stop required for save).
6. Observer records manual rep count, saved rep count, tracking signal, save outcome.

### Safety stop criteria (patient)

Stop and follow clinic protocol if: sharp pain, dizziness, chest pain, shortness of breath, or unusual symptoms. RASQ does not emergency-triage.

---

## 7. Session procedure (clinician review)

Within 24 hours of patient session:

1. Open patient profile → **Movement tracking sessions**.
2. Locate new row: reps, duration, tracking signal, movement detected.
3. Read disclaimer: derived metrics only; prototype; therapist review only.
4. Complete `pilot-feedback-form.md` (clinician section).
5. Note review time (seconds from opening profile to finding row).

**Interpretation rule:** Tracking signal reflects **camera visibility**, not movement quality or clinical performance.

---

## 8. Data saved vs not saved

### Saved (when camera used, session ≥ minimum duration)

| Field | Meaning |
|-------|---------|
| Rep count | Hip-Y stand-threshold crossings (legacy counter) |
| Session duration | Seconds of tracking session |
| Tracking signal | Session-level visibility summary (good / fair / limited camera visibility) |
| Movement detected | Whether pose was detected during session |
| Frames with pose / frames total | Internal quality context (clinician view may summarize) |

### Not saved

| Item | Status |
|------|--------|
| Video | Never uploaded or stored |
| Pose landmarks / body coordinates | Never stored |
| hipY values | Never persisted |
| Per-rep capture flags | Shadow-only; not in production UI or database |
| Clinical scores | Not in product |
| AI outputs | Not in product |

---

## 9. Issue escalation

| Issue | Action |
|-------|--------|
| Save failed | Note in feedback form; patient may retry; log for technical contact |
| Rep count clearly wrong | Record manual vs saved; do not adjust clinical plan based on count alone |
| Patient confused by reps or signal | Document verbatim; pause camera opt-in for next patients if needed |
| Safety concern | Clinic protocol first; RASQ flags are review prompts only |

---

## 10. Pilot close-out

1. Roll up metrics in `pilot-success-metrics.md`.
2. Summarize: proceed / iterate / pause.
3. Do **not** publish accuracy claims without structured analysis.
4. Next engineering (rep flags, MQE, etc.) only after clinician validation plan outcomes.

---

## Related documents

- `clinician-one-pager.md`
- `patient-camera-framing-card-ar.md`
- `pilot-feedback-form.md`
- `pilot-success-metrics.md`
- `pilot-workflow.md`
- `known-limitations.md`
