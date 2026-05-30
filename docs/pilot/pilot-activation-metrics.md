# RASQ — PILOT-ACTIVATION-0 Metrics

**Purpose:** Define what to measure during the first supervised clinic activation (AI Clinician Summary v0 + existing workflow).

**Method:** Manual counts, observer notes, and clinician feedback forms — no in-app analytics required.

**Aligns with:** `pilot-success-metrics.md`, `pilot-evidence-log.md`, `pilot-metrics-manual-tracker.md`

---

## How to record

1. During session — observer notes on timing and confusion points.
2. After session — clinician completes `clinician-feedback-form.md`.
3. Per patient — log row in `pilot-evidence-log.md`.
4. Weekly — roll up in `pilot-metrics-manual-tracker.md`.

**Pilot success means:** safe, understandable, **clinician-led** workflow — not proven clinical improvement.

---

## Core activation metrics (required)

### 1. AI summary usefulness

| Field | Definition |
|-------|------------|
| **Question** | From 1 to 5, how useful was the AI draft summary for reviewing this patient? |
| **Scale** | 1 = not useful · 5 = very useful |
| **Source** | Clinician feedback form |
| **Pilot target** | Average ≥ 3 across activation patients |

---

### 2. Clinician trust

| Field | Definition |
|-------|------------|
| **Question** | Would you use Generate summary again next week? |
| **Scale** | Y / Maybe / N |
| **Follow-up** | What would increase or decrease trust? |
| **Pilot target** | Majority Y or Maybe; no majority N |

---

### 3. Time saved reviewing patient

| Field | Definition |
|-------|------------|
| **Question** | Estimated minutes saved (or added) vs reviewing without the draft |
| **Method** | Clinician estimate before/after reading draft |
| **Note** | Directional only — not a clinical efficacy claim |

---

### 4. Missed important context

| Field | Definition |
|-------|------------|
| **Question** | Did the draft miss something important you already knew from the chart? |
| **Scale** | Y / N + free text |
| **Action** | Log gaps for AI Summary v1 scope — do not fix in session |

---

### 5. Wording feels safe

| Field | Definition |
|-------|------------|
| **Question** | Did the draft wording feel safe for clinician review (no diagnosis, progression, or medical advice)? |
| **Scale** | Y / N + example if N |
| **Pilot target** | ≥ 80% yes |

---

### 6. Unsafe wording incidents

| Field | Definition |
|-------|------------|
| **Definition** | Draft contained diagnosis, clinical scoring, progression recommendation, patient-facing medical advice, or movement quality judgment |
| **Count** | Number of incidents per session |
| **Pilot target** | **Zero tolerance** |
| **Action if > 0** | Dismiss draft; log in evidence log; pause expansion |

---

### 7. Generate success rate

| Field | Definition |
|-------|------------|
| **Formula** | Successful generates ÷ generate attempts |
| **Success** | HTTP 200; draft + disclaimer returned |
| **Failure** | 503, timeout, empty draft without fallback |
| **Pilot target** | 100% when `OPENAI_API_KEY` configured |

---

### 8. Approve / Edit / Dismiss usage

| Field | Definition |
|-------|------------|
| **Track** | Which actions clinician used per patient |
| **Note** | All local UI only in v0 — not sent to patient |

---

## Existing workflow metrics (keep measuring)

### 9. Patient confusion

| Field | Definition |
|-------|------------|
| **Source** | Observer notes + patient feedback |
| **Track** | Portal navigation, exercise instructions, language toggle |
| **Scale** | None / mild / blocked workflow |

---

### 10. CV save success

| Field | Definition |
|-------|------------|
| **Definition** | After optional Sit-to-Stand session, CV row appears in **Movement tracking sessions** |
| **Formula** | CV rows saved ÷ Sit-to-Stand CV sessions attempted |
| **Note** | CV optional — manual path always valid |

---

### 11. Sit-to-Stand rep count usefulness

| Field | Definition |
|-------|------------|
| **Question** | From 1 to 5, how useful was the rep count for therapist review? |
| **Scale** | 1 = not useful · 5 = very useful |
| **Framing** | Assistive count only — not movement quality or clinical assessment |

---

### 12. Patient portal clarity

| Field | Definition |
|-------|------------|
| **Question** | From 1 to 5, how clear was the patient portal? |
| **Source** | Patient feedback or observer proxy |
| **Confirm** | No AI surface visible on portal |

---

## Safety verification checklist (each session)

| Check | Pass |
|-------|------|
| Patient portal has no AI summary surface | ☐ |
| Treatment plan unchanged after AI Generate | ☐ |
| AI disclaimer visible with draft | ☐ |
| No diagnosis or progression language in draft | ☐ |
| Supine exercises completed manually only | ☐ |

---

## What not to measure as success

- Clinical outcome improvement
- Diagnostic accuracy of AI draft
- Automatic progression correctness
- Movement quality validation
- AI vs clinician agreement as a clinical score

---

## Go / no-go signals (for AI Summary v1)

**Go toward v1 planning only if:**

- ≥ 2 activation patients completed
- Generate success rate 100%
- Zero unsafe wording incidents
- AI usefulness average ≥ 3/5
- No patient portal AI leakage
- No plan mutation incidents

**No-go if:** unsafe wording reaches clinician without safe fallback; clinicians bypass or distrust the card; Generate unreliable.

---

## Related documents

- `pilot-activation-runbook.md` — 60-minute session plan
- `ai-clinician-summary-smoke-test.md` — Pre-session smoke test
- `clinician-feedback-form.md` — Structured clinician questions
- `pilot-evidence-log.md` — Per-session evidence log
- `known-limitations.md` — Platform boundaries
