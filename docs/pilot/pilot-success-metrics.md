# RASQ — Pilot Success Metrics (Controlled Clinic Pilot)

**Purpose:** Define what to measure during a **controlled pilot** for **workflow validation**.  
**Method:** Manual counts and feedback forms — no in-app analytics required for the pilot pack.

**Aligns with:** Production through MQ-READY, MQ-SIGNAL-1A/1B, MQ-REP-1 SHADOW-0 (optional Sit-to-Stand CV; shadow rep flags internal only).

---

## CV optional assist metrics (Sit-to-Stand pilot)

Record per session when testing optional camera assist. Use `pilot-feedback-form.md`.

| Metric | Definition | Target (pilot) |
|--------|------------|----------------|
| **Camera opt-in rate** | Sessions with camera enabled ÷ Sit-to-Stand sessions attempted | Track; no fixed target |
| **Save success rate** | CV saves succeeded ÷ camera sessions ≥ min duration | ≥ 90% |
| **Rep count agreement (±1)** | Saved reps within ±1 of manual observer count | ≥ 80% of camera sessions |
| **Clinician trust rating** | Q5 on feedback form (1–5) | Mean ≥ 3.5 to proceed |
| **Patient confusion notes** | Any Y on confusion questions + free text | Zero unaddressed safety confusion |
| **Clinician review time** | Seconds from opening profile to locating Movement tracking row | Median < 30 s |

### CV data boundary (reminder for roll-up)

**Saved:** reps, duration, tracking signal, movement detected, frame counts.  
**Not saved:** video, landmarks, hipY, per-rep capture flags.

---

## How to record data

1. After each session, fill `pilot-evidence-log.md`.
2. Weekly roll-up in `pilot-metrics-manual-tracker.md`.
3. Detailed rubrics in `success-metrics.md` (companion reference).

**Pilot success means:** safe, understandable, **clinician-led** workflow — not proven clinical improvement.

---

## Core metrics (required)

### 1. Number of patients invited

| Definition | Count of patients for whom clinician sent assessment link and/or portal link in the pilot period |
|------------|--------------------------------------------------------------------------------------------------|
| Source | Clinician observation · Patients list |
| Record | `Patients invited` in tracker |

---

### 2. Assessment completion rate

```
Rate = assessments submitted ÷ assessment links sent
```

| Threshold (pilot) | Action if below |
|-------------------|-----------------|
| ≥ 70% demo | Investigate link delivery, consent, mobile UX |
| < 50% | Pause expansion; fix workflow before more invites |

---

### 3. Sessions completed

| Definition | Total patient-reported session completions in period |
|------------|-----------------------------------------------------|
| Source | Results · patient profile · Progress Snapshot |
| Per patient | At least **1** session in demo; track weekly in live pilot |

Also track: **sessions completed ÷ sessions available** on assigned plan (session completion rate).

---

### 4. Last session activity (operational)

| Definition | Whether clinician can see **Last session** date or “No completed session yet” on list/profile |
|------------|-----------------------------------------------------------------------------------------------|
| Sprint W | **Patients list** and **patient profile → Session activity** |
| Use | Operational follow-up only — not a clinical outcome measure |
| Note | **No recent session** badge is neutral operational signal (not “poor adherence”) |

---

### 5. Clinician feedback

Collect via `pilot-feedback-form.md` (clinician section) within 24–48 hours.

**CV pilot questions (required when camera tested):**

- Is this useful?
- Is it understandable?
- Does Limited camera visibility read as technical, not clinical?
- Would you use this with patients?

| Signal | Minimum |
|--------|---------|
| Usefulness (1–5) | Record every session |
| Trust in CV metrics (1–5) | Record every camera session |
| Limited visibility = technical read | Y / Partial / N |
| Would use with patients | Y / Some / N |
| Would use with another patient next week | Y / Maybe / N |
| NPS (0–10) | Optional weekly |
| Open: biggest friction | Required one line |

---

### 6. Patient feedback

Collect via `patient-feedback-message.md` or `pilot-feedback-questions.md` (patient section).

| Signal | Minimum |
|--------|---------|
| Link opened easily | Y / N |
| Understood exercises | Y / Partial / N |
| Knew when to stop (safety) | Y / Partial / N |
| One confusing thing | Free text (short) |

---

### 7. Usability issues

| Type | Examples to log |
|------|-----------------|
| Clinician UX | Confusing navigation, slow steps, unclear badges |
| Patient UX | Link failure, language/RTL, session flow drop-off |
| Process | SMS delivery, consent, training gap |

Log in `pilot-evidence-log.md` → **Biggest workflow issue** and weekly notes in tracker.

---

### 8. Safety events

| Definition | Any report of concerning symptoms, emergency routing, or clinician escalation tied to RASQ workflow |
|------------|------------------------------------------------------------------------------------------------------|
| Record | Date · summary (no PHI in shared docs) · action taken |
| RASQ role | Flags and patient-reported data are **prompts to review** — not automated decisions |

**Target for controlled pilot:** Zero unhandled safety events; all flags reviewed per clinic protocol.

---

## Supplementary metrics (recommended)

| Metric | See also |
|--------|----------|
| Plans assigned | `success-metrics.md` § portal / plan rates |
| Review queue usefulness (1–5) | `success-metrics.md` §6 |
| Pain/effort reporting completeness | `success-metrics.md` §5 |
| Pilot Attention Queue usefulness | Clinician open question in feedback form |

---

## Session summary template

```
Date:
Clinic:
Patients invited:
Assessment completion: __ / __
Sessions completed (total):
Last session visible on list/profile: Y / N
Clinician feedback collected: Y / N
Patient feedback collected: Y / N
Usability issues (top 1):
Safety events:
Verdict: Proceed / Iterate / Pause
```

---

## What success is *not*

- Proof of clinical improvement or recovery
- Diagnostic accuracy of RASQ
- **Movement quality validation** or form assessment
- **Clinical-grade** or regulated-device claims
- **AI-powered rehab** or MQE performance
- Optional experimental CV accuracy as sole success criterion (core workflow does not depend on camera)
- **Automatic treatment recommendations** or **automatic progression**
- **All-exercise CV support** (Sit-to-Stand only)
- Legal finalization (counsel review still required)

---

## What not to claim (pilot communications)

| Do not claim | Say instead |
|--------------|-------------|
| Movement quality validation | Rep counting assist for therapist review |
| Clinical grade / FDA cleared | Prototype; not clinically validated |
| AI-powered rehab | Rule-based on-device CV; no AI in production |
| Automatic progression | Therapist assigns and reviews plans |
| All exercises supported | Sit-to-Stand only for optional CV |

---

## Related documents

- `pilot-protocol.md` — Supervised clinic protocol
- `clinician-one-pager.md` — Clinician briefing
- `patient-camera-framing-card-ar.md` — Arabic camera framing card
- `pilot-feedback-form.md` — Session feedback form
- `success-metrics.md` — Extended rubrics and thresholds
- `pilot-metrics-manual-tracker.md` — Weekly table
- `pilot-feedback-questions.md` — Question bank
- `investor-proof-template.md` — One-page evidence export
