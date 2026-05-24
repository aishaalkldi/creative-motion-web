# RASQ Clinic Pilot — Success Metrics

Define how to evaluate a **controlled clinic pilot** without adding product analytics in Sprint E. Use clinician observation, demo notes, and simple counts during the session.

---

## How to score

For qualitative items, use **1–5** (1 = poor, 5 = excellent) or **Yes / Partial / No**.

For rates, record **numerator / denominator** during the pilot cohort (even a single demo day counts as n=1 for rehearsal).

---

## 1. Clinician understands workflow

**Definition:** Clinician can describe the end-to-end path without prompting after one guided demo.

| Signal | Measure |
|--------|---------|
| Can name steps in order | Y / Partial / N |
| Knows where to send assessment vs portal link | Y / N |
| Knows assessment report vs progress vs review queue | Y / N |
| Self-rated confidence (1–5) | ___ |

**Success threshold (pilot):** ≥ 4/5 confidence and can name ≥ 7 of 10 script steps.

---

## 2. Assessment link completion rate

**Definition:** Share of sent remote assessment links that result in a submitted assessment.

```
Rate = submitted assessments / assessment links sent
```

| Cohort | Links sent | Submitted | Rate |
|--------|------------|-----------|------|
| Demo day | | | |
| Week 1 pilot | | | |

**Success threshold (pilot):** ≥ 70% for motivated demo patients; investigate if < 50%.

**Failure modes to note:** link expired, consent drop-off, mobile UX, language confusion.

---

## 3. Patient portal completion rate

**Definition:** Share of patients with an assigned plan who open the portal at least once.

```
Rate = patients who opened portal / patients with assigned plan
```

| Cohort | Plans assigned | Portal opened | Rate |
|--------|----------------|---------------|------|
| Demo day | | | |
| Week 1 pilot | | | |

**Success threshold (pilot):** ≥ 80% in demo; ≥ 60% in real-world pilot week.

---

## 4. Session completion rate

**Definition:** Share of assigned sessions marked complete by the patient.

```
Rate = sessions completed / sessions available (or assigned in period)
```

| Cohort | Sessions available | Completed | Rate |
|--------|-------------------|-----------|------|
| Demo day | | | |
| Week 1 pilot | | | |

**Success threshold (pilot):** ≥ 1 session completed per demo patient; ≥ 50% of week-1 sessions in small cohort.

---

## 5. Pain / effort reporting completeness

**Definition:** Share of completed sessions that include both effort and pain scores (and optional note if prompted).

```
Completeness = sessions with effort + pain / sessions completed
```

| Cohort | Sessions completed | With effort + pain | Rate |
|--------|-------------------|--------------------|------|
| Demo day | | | |
| Week 1 pilot | | | |

**Success threshold (pilot):** ≥ 90% in demo; ≥ 75% in live pilot.

---

## 6. Review queue usefulness

**Definition:** Clinicians find the review queue helps prioritize follow-up (not noise).

| Question | Score (1–5) |
|----------|-------------|
| Flags were understandable | |
| Flags matched my clinical concern | |
| Acknowledge flow was clear | |
| Would use queue in daily practice | |

**Success threshold (pilot):** Average ≥ 3.5/5; no flag type universally dismissed as “always wrong.”

**Optional counts:**

| Flag type | Count | Clinician agreed flag was useful |
|-----------|-------|----------------------------------|
| Pain increase | | |
| Safety concern | | |
| Adherence / other | | |

---

## 7. Clinician satisfaction

**Definition:** Overall satisfaction with RASQ for supported workflow in pilot context.

| Question | Score (1–5) |
|----------|-------------|
| Easy to learn | |
| Fits clinic workflow | |
| Trust in clinical safety framing | |
| Would recommend pilot to colleague | |
| Overall satisfaction | |

**Success threshold (pilot):** Average ≥ 3.5/5; no score of 1 on “trust in clinical safety framing.”

**Open-ended (required):**

- Best part: ___
- Biggest friction: ___
- Missing for production (non-AI): ___

---

## 8. Patient clarity

**Definition:** Patient understands what to do, when to stop, and how to contact therapist.

| Question | Patient / proxy response |
|----------|--------------------------|
| Knew how to complete assessment | Y / Partial / N |
| Knew how to open portal and start session | Y / Partial / N |
| Saw safety notice / knew when to stop | Y / Partial / N |
| Language (AR/EN) was clear | Y / Partial / N |
| Would use again for home exercises | Y / N |

**Success threshold (pilot):** All “Partial or better” on task clarity; “Y” on safety notice awareness.

---

## Pilot summary template

Copy after each session:

```
Date:
Clinic:
Participants (roles):
Scenario(s):

Assessment completion rate: __ / __
Portal open rate: __ / __
Session completion rate: __ / __
Pain/effort completeness: __ / __

Clinician workflow confidence (1-5):
Review queue usefulness (1-5):
Clinician satisfaction (1-5):
Patient clarity (Y/Partial/N summary):

Go / iterate / pause:
Top 3 actions:
```

---

## What success is *not*

- Autonomous clinical outcomes (RASQ does not diagnose or prescribe)
- AI/CV/voice accuracy (not in scope)
- EMR integration or billing (not in Sprint E)
- Legal finalization (counsel review still required)

Pilot success = **safe, understandable, clinician-led workflow** with measurable completion and satisfaction signals.
