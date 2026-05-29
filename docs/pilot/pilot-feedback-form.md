# RASQ — Pilot Feedback Form

**Use after each supervised test session or within 48 hours.**  
**No PHI in shared copies** — use patient codes (P1, P2, …).

---

## Session metadata

| Field | Value |
|-------|-------|
| Date | |
| Clinic / site | |
| Patient code | |
| Clinician ID / initials | |
| Observer | |
| Device | iOS / Android · browser |
| Camera used | Yes / No (continue without camera) |
| Exercise | Sit-to-Stand |
| Save outcome | Saved / Failed / Skipped / N/A (no camera) |

---

## CV session data (if camera used)

| Field | Value |
|-------|-------|
| Manual rep count (observer/clinician) | |
| Saved rep count (from clinician profile) | |
| Agreement within ±1 | Yes / No |
| Session duration (saved) | |
| Tracking signal | Good / Fair / Limited camera visibility |
| Movement detected | Yes / No |
| Clinician review time (sec to find row on profile) | |

---

## Clinician questions (required)

Rate 1 (low) – 5 (high) unless noted.

| # | Question | Response |
|---|----------|----------|
| 1 | **Is this useful** for reviewing home Sit-to-Stand? | 1–5 |
| 2 | **Is it understandable** (reps, duration, tracking signal)? | 1–5 |
| 3 | Does **Limited camera visibility** read as **technical** (camera/setup), not clinical (patient did poorly)? | Yes / Partially / No · comment |
| 4 | **Would you use this with patients?** | Yes / Some patients / No |
| 5 | Overall **trust** in saved CV metrics for this session | 1–5 |
| 6 | Would you recommend optional camera to this patient again? | Yes / Maybe / No |

**Open text (required):**

- Biggest friction for you:
- Biggest friction for patient:
- Anything confusing or concerning:

---

## Patient questions (optional — ask verbally or via clinic)

| # | Question | Response |
|---|----------|----------|
| 1 | Did you understand you could **skip the camera**? | Yes / No |
| 2 | Was consent clear (no video, no judgment)? | Yes / Partially / No |
| 3 | Any confusion about reps or messages shown? | Yes / No · note |
| 4 | Patient confusion summary (free text) | |

---

## Usability & safety

| Item | Y / N / N/A | Notes |
|------|-------------|-------|
| Portal link opened successfully | | |
| Readiness wait acceptable (~2 s) | | |
| Framing instructions sufficient | | |
| Session completed without camera path tested | | |
| Safety stop needed | | |
| Escalation to clinic protocol | | |

---

## Verdict (observer)

| | |
|---|---|
| **Proceed with next patient** | Yes / Yes with changes / Pause |
| **Top issue to fix before scaling** | |

---

## Related

- `pilot-success-metrics.md` — roll-up definitions
- `pilot-evidence-log.md` — session log template
- `clinician-one-pager.md` — clinician reference
