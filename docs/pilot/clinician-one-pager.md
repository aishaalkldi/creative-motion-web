# RASQ — Clinician One-Pager (Supervised Pilot)

**For:** Physical therapists / rehabilitation clinicians  
**Product status:** Prototype · clinic-led · therapist review only  
**CV status:** Optional · Sit-to-Stand only · not clinically validated

---

## What RASQ is

RASQ is a **clinic-led remote rehabilitation platform**. You assign plans; patients complete home sessions via a secure link; you review progress and optional movement session data on the patient chart.

---

## What optional camera assist does

For **Sit-to-Stand only**, patients may enable on-device camera assist to **count repetitions** during the exercise.

- Counts happen **on the phone** — nothing is uploaded as video.
- Saved data is **derived metrics only** for your review.
- Patients can **skip camera entirely** and still complete the session.

---

## What you will see (Movement tracking sessions)

| Field | Meaning |
|-------|---------|
| **Reps** | Count of detected stand-phase crossings |
| **Duration** | Length of tracking session |
| **Tracking signal** | Camera/landmark visibility during session — **not movement quality** |
| **Movement detected** | Whether body pose was detected |

**Limited camera visibility** means the camera had trouble seeing hips/body clearly — it is a **technical signal**, not a clinical judgment about the patient.

---

## What is NOT in RASQ

- No diagnosis
- No clinical scoring
- No “correct vs wrong movement” feedback to patients
- No automatic treatment recommendation
- No automatic progression to the next phase
- No video replay
- No stored body landmarks or coordinates
- No AI-generated rehab advice (production)
- No per-rep quality flags in current production UI

---

## Your role in the pilot

1. Assign plan including Sit-to-Stand (if testing CV).
2. Share patient portal link.
3. Tell patients camera is **optional**.
4. Review saved session rows on patient profile.
5. Use counts as **conversation starters**, not sole decision inputs.
6. Complete the pilot feedback form after each test session.

---

## Questions we need your answer to

1. **Is this useful** for reviewing home Sit-to-Stand between visits?
2. **Is it understandable** — reps, duration, tracking signal?
3. Does **Limited camera visibility** read as **technical** (camera/setup), not clinical (patient failed)?
4. **Would you use this with patients** — all, some, or none? Why?

---

## What we will NOT claim

- Movement quality validation
- Clinical-grade or regulated-device status
- AI-powered rehabilitation
- Automatic progression
- Support for all exercises (Sit-to-Stand only for CV)

---

## Safety reminder

RASQ supports your plan; it does not replace your assessment. Patient-reported pain/effort and operational badges are **prompts to review** — you decide follow-up.

**Prototype disclaimer (in product):** Derived movement metrics only. Not clinically validated. No video or body coordinates stored. Not a clinical assessment.

---

## Contact

Document save issues, broken links, or pilot questions with your RASQ pilot lead.

**Related:** `pilot-protocol.md` · `pilot-feedback-form.md`
