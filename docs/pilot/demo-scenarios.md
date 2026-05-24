# RASQ Clinic Pilot — Demo Scenarios

Three realistic test scenarios for controlled clinic pilots. Each maps to an existing **pilot program template** in RASQ. Use demo patient names and synthetic data only unless clinic policy permits otherwise.

---

## Scenario A — Knee rehabilitation

### Patient background

| Field | Demo value |
|-------|------------|
| Name | Pilot Patient — Knee (e.g. “Sara K.”) |
| Age | 34 |
| Presentation | 8 weeks post ACL reconstruction, cleared for Phase 1 rehab |
| Goal | Return to walking and daily activities without giving way |
| Red flags | None for demo (confirm real patients screened in clinic) |

### Assessment responses (patient-reported)

Suggest **General MSK** remote assessment with pain, ROM, strength, functional sections:

- **Pain:** 3/10 at rest, 5/10 with stairs; no night pain
- **ROM:** Knee flexion limited ~100°; extension lacks 5°
- **Strength:** Quads activation slow; single-leg stance 8 seconds
- **Functional:** Hesitant on sit-to-stand; avoids running
- **Safety screen:** No sharp pain, dizziness, chest pain, or neurological symptoms

### Suggested program

**Template:** `Knee Rehab — Beginner` (`knee-rehab-beginner`)

- 3 sessions: activation & ROM → strength & control → control & walking
- Exercises include quad sets, heel slides, sit-to-stand, step control, balance, walking tolerance
- Phase goal: voluntary quad control, comfortable flexion, sit-to-stand confidence

### Expected session behavior (patient portal)

- Session 1 marked as **today**; patient completes exercises at home
- Effort ~5–6/10; pain after session ~4/10 (stable)
- Arabic toggle: patient sees Arabic guidance if assessment language was Arabic or toggle set to Arabic

### What clinician should observe

- Assessment appears in **Results** after submission
- Plan shows 3 sessions with library-linked exercises
- After session 1: progress % updates; session log shows effort/pain
- Review queue **may not flag** if pain stable and no safety concern

### Success criteria

- [ ] Remote assessment link opened and submitted
- [ ] Clinician reviewed report without treating it as diagnosis
- [ ] Plan assigned from knee template
- [ ] Patient completed Session 1 with effort/pain logged
- [ ] Clinician sees updated progress on Results / patient profile
- [ ] Patient understood safety notice (stop if sharp pain, contact therapist)

---

## Scenario B — Lumbar pain rehabilitation

### Patient background

| Field | Demo value |
|-------|------------|
| Name | Pilot Patient — Lumbar (e.g. “Omar H.”) |
| Age | 42 |
| Presentation | 6-week mechanical low back pain; desk worker; no red flags |
| Goal | Move through daily tasks with less fear and better tolerance |
| Red flags | None for demo |

### Assessment responses (patient-reported)

Suggest **Pain & Function** or **General MSK** (pain, ROM, functional):

- **Pain:** 4/10 average; worse with prolonged sitting
- **ROM:** Stiffness in morning; flexion cautious
- **Functional:** Difficulty with floor-level tasks; walking OK < 20 min
- **Psychosocial (if asked):** Fear of bending; otherwise motivated
- **Safety screen:** Negative for cauda equina / progressive leg weakness (clinician confirms in person)

### Suggested program

**Template:** `Low Back Pain — Beginner` (`low-back-beginner`)

- Session 1: mobility & breathing (diaphragmatic breathing, pelvic tilts)
- Session 2: spinal mobility & hinge education
- Session 3: core & walking (glute bridge, bird-dog prep, walking plan)

### Expected session behavior

- Patient reports effort 4–5/10; pain stable or slightly lower after Session 1
- May leave note: “Stiff in morning, felt easier after breathing exercises”

### What clinician should observe

- Patient portal shows **program name** (not EMR diagnosis label) in subtitle
- Progress page lists session history after completion
- If patient reports pain **increase** after a session, review queue may show **pain increase** flag → therapist review recommended

### Success criteria

- [ ] Assessment completed on mobile link
- [ ] Clinician selected lumbar template and edited notes if needed
- [ ] Patient portal loads in Arabic and English
- [ ] Session 1 completed with patient-reported scores
- [ ] Clinician acknowledges or documents review if queue flag appears
- [ ] Patient cites safety notice (“contact therapist if symptoms worsen”)

---

## Scenario C — Shoulder rehabilitation

### Patient background

| Field | Demo value |
|-------|------------|
| Name | Pilot Patient — Shoulder (e.g. “Layla M.”) |
| Age | 28 |
| Presentation | Subacromial irritation / stiff shoulder; no acute trauma |
| Goal | Overhead reach for work and sport without pinching |
| Red flags | None for demo |

### Assessment responses (patient-reported)

Suggest **General MSK** with pain, ROM, strength:

- **Pain:** 5/10 with overhead reach; 2/10 at rest
- **ROM:** Flexion ~140°; external rotation limited
- **Strength:** Rotator cuff endurance reduced; posture forward head
- **Functional:** Difficulty reaching high shelf, dressing overhead
- **Safety screen:** No acute dislocation history; no neurological symptoms

### Suggested program

**Template:** `Shoulder Mobility — Beginner` (`shoulder-mobility-beginner`)

- Session 1: pendulum, scapular setting, table slides
- Session 2: wall slides, external rotation isometric, posture reset
- Session 3: assisted flexion, scapular retraction, functional reach

### Expected session behavior

- Patient stays within comfortable range; effort 5–7/10
- If patient pushes through pinching pain, clinician uses this as teaching moment (stop, modify range)

### What clinician should observe

- Assessment report shows ROM/strength sections
- Session exercises display localized names (Arabic if toggled)
- Optional: simulate **safety concern** in session notes to demo review queue (advanced demo only)

### Success criteria

- [ ] Remote link → submit → visible in clinician Results
- [ ] Shoulder template assigned with therapist note
- [ ] Patient completes at least one session with scores
- [ ] Clinician reviews progress without autonomous “recovery” messaging
- [ ] Demo audience understands shoulder template is a **starting point**, not auto-treatment

---

## Cross-scenario tips

- **Language:** Run one scenario in Arabic end-to-end to show toggle + RTL layout.
- **Timing:** Pain & Function assessment is fastest for time-boxed demos (~10 min patient side).
- **Review queue:** To demo flags, use a test session with pain after > pain before, or document safety concern in session flow (if available in UI).
- **Do not use** real patient identifiers in screenshots or shared links during pilot.
