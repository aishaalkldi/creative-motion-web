# MINI-SQUAT-PILOT-SCRIPT-0 — Patient Pilot Workflow

**Track:** MINI-SQUAT-PILOT-SCRIPT-0  
**Status:** Documentation only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-30  
**Product:** RASQ by Creative Motion Lab  

**Related docs:** `MINI-SQUAT-CV-0-design-spec.md` · `RASQ-motion-trackable-rehab-framework.md` · `docs/programs/sports-knee-foundation.md` · `docs/mqe/MQE-0-safety-language.md` · `docs/pilot/known-limitations.md` · `docs/pilot/pilot-evidence-log.md` · `docs/pilot/clinician-feedback-form.md`

**RASQ code impact:** None. No app, API, schema, or production CV logic changes in this track.

**Prerequisites before running this script:**

1. **STS-CV-1 PASS** — Sports Knee Session 4 Sit-to-Stand optional CV validated on mobile (PASS or PARTIAL with framing fix + documented retest). See `docs/pilot/pilot-evidence-log.md`.
2. **MINI-SQUAT-CV-PR-2 merged and deployed** — Mini Squat patient enablement shipped (allowlist, detector, API). This script assumes product behavior described in `MINI-SQUAT-CV-0-design-spec.md` §2–9.
3. **Supervised pilot only** — Clinician or pilot lead present (in clinic or remote observation). Not a self-serve unsupervised study without clinic protocol.

**Primary pilot session:** Sports Knee Foundation **Session 5 — Closed-chain prep** (first exercise: Mini Squat 0–45°, then Sit-to-Stand, then Heel Raises).

**Prescription reference (template):** 3 sets × 10–15 reps · 60 s rest between sets.

---

## Safety boundaries (locked)

| Rule | Pilot requirement |
|------|-------------------|
| No diagnosis | Never describe movement as pathological or injured |
| No clinical scoring | No numeric grades, severity, or performance rank |
| No movement quality | No “good squat”, “bad form”, “poor quality”, or depth feedback to patient |
| No automatic progression | CV does not unlock sessions or change dose |
| No return-to-sport clearance | Never imply readiness to return to play |
| No patient-facing AI | No coaching, interpretation, or chat |
| Clinician review only | Saved metrics are assistive context for licensed review |
| Optional camera | Manual completion always valid; skip path must work |
| No video / landmark storage | Derived counts and duration only |
| Not clinically validated | Disclaimers on consent, live UI, and clinician review |

**Approved framing:** camera-assisted · assistive movement metrics · session observation · tracking signal · therapist review · assistive estimate only.

**Forbidden terms (patient and pilot notes):** bad form · poor quality · unsafe movement · go deeper · good squat · movement score · ready to progress · clearance · diagnosis · validated outcome.

---

## Purpose

Define the **exact patient pilot workflow** for optional Mini Squat computer vision (CV) assist during home or clinic-supervised portal sessions. This script is for:

- Field validation before production enablement  
- Internal QA (3+ sessions minimum per design spec)  
- Clinician observation with manual rep count comparison  
- Evidence logging in `docs/pilot/pilot-evidence-log.md`

**What this script is not:** clinical protocol, exercise prescription, or implementation guide for engineers.

---

## Roles and materials

| Role | Responsibility |
|------|----------------|
| **Patient** | Follows portal exercise flow; may skip camera |
| **Pilot observer** | Sets up camera zone, notes manual rep count, records failures |
| **Clinician (optional)** | Reviews saved metrics afterward; does not coach form from CV output |

**Materials:**

- Patient portal link (`/patient/{token}`) on **mobile phone** (primary)  
- Second device or paper for **manual rep tally**  
- `pilot-evidence-log.md` row template (bottom of this doc)  
- Stable phone stand or shelf (~waist height)  
- Clear floor space ~2–3 m from camera  
- Normal indoor lighting  

---

## 1. Camera setup

| Step | Action |
|------|--------|
| 1 | Use the **same phone** the patient will use for the portal (do not switch devices mid-session). |
| 2 | Confirm **HTTPS** — camera requires secure connection. |
| 3 | Place phone in **portrait** orientation on a **stable** surface (stand, shelf, stack of books). Do not hand-hold during tracking. |
| 4 | Phone lens height: approximately **90–110 cm** from floor (waist to chest height when propped). |
| 5 | Angle: **level or slightly upward** — avoid pointing down at floor only. |
| 6 | Frame check (before opening portal): patient should fit **head to mid-shin** in view when standing at exercise distance. |
| 7 | Background: **uncluttered** wall or open area; avoid strong backlight (window behind patient). |
| 8 | Close other apps using the camera; grant browser camera permission when prompted. |

**View:** **Front** — patient faces the camera. Side profile is **not** required for v0 pilot.

---

## 2. Patient positioning

| Step | Action |
|------|--------|
| 1 | Patient stands **facing the camera**, feet **shoulder-width** apart. |
| 2 | Toes point forward or slightly out — natural stance; no forced turnout. |
| 3 | Arms may hang at sides, hands on hips, or light touch on chair/wall **only if prescribed** — note heavy support in pilot log (may affect hip signal). |
| 4 | Head and chest visible; patient stays in **one spot** — no walking toward/away from camera during a set. |
| 5 | If patient uses chair/wall for balance, place support ** beside** them, not between patient and camera. |

---

## 3. Distance from camera

| Parameter | Specification |
|-----------|---------------|
| **Target distance** | **2.0–3.5 m** from phone to patient (toes / center of mass) |
| **Too close** | Hips or head clipped; tracking signal weak |
| **Too far** | Landmarks small; fair/poor tracking signal |
| **Check** | Observer confirms full lower body and torso visible before starting tracking |

**Pilot note:** Record approximate distance (m) in evidence log.

---

## 4. Body visibility requirements

Before rep counting begins, the product readiness gate expects (design spec — may appear as “Checking camera position…” in portal):

| Landmark | Minimum visibility (engineering target) | Purpose |
|----------|----------------------------------------|---------|
| **Both hips** | ≥ 0.35 each | Primary rep signal |
| **Shoulders** | Combined ≥ 0.6 when scaling enabled | Torso span normalization |
| **Knees** | ≥ 0.30 on at least one knee (recommended) | Optional depth assist later — **not shown to patient in v0** |
| **Ankles / feet** | Optional | Helpful but **not required** to start counting |

**Patient instruction:** Wait until on-screen guidance indicates **ready** (or equivalent) before starting squats. Do not squat during calibration.

**If hips not visible:** Adjust phone height, distance, or lighting — do not ask patient to “squat deeper” for the camera.

---

## 5. Lighting requirements

| Condition | Guidance |
|-----------|----------|
| **Ideal** | Even indoor ambient light; face and hips clearly visible on preview |
| **Avoid** | Strong backlight (window behind patient), single harsh spotlight, deep shadows on hips |
| **Dark room** | May yield **Fair** or **Weak** tracking signal — acceptable for pilot; log visibility label |
| **Never say** | “Lighting is bad so your form is bad” — tracking signal only, not movement judgment |

---

## 6. Clothing considerations

| Prefer | Avoid |
|--------|-------|
| Fitted or regular athletic wear | Very baggy pants or long coats covering hips/knees |
| Contrasting color vs background | All-black on black background |
| Stable hemline at knee | Flowing skirts that hide knee position |

**Pilot note:** Record clothing description if rep count diverges from manual count (landmark jitter).

---

## 7. Standing readiness phase

**Duration (product target):** ~**2 seconds** readiness check after camera starts.

| Step | Patient action | Observer notes |
|------|----------------|----------------|
| 1 | Tap **I understand — enable camera** on consent card | Confirm consent bullets visible (EN or AR) |
| 2 | Tap **Start movement tracking** when ready | Camera preview active |
| 3 | **Stand still**, facing camera, feet shoulder-width | “Checking camera position…” may appear |
| 4 | Wait for **ready** state before squatting | Do not move during readiness |
| 5 | If **partial / not ready** messaging appears | Adjust setup per §1–4; tap retry if offered |

**Key difference from Sit-to-Stand:** Mini Squat starts **standing**, not seated.

---

## 8. Calibration phase

**Duration (product target):** ~**3 seconds** standing baseline after readiness passes.

| Step | Patient action | System behavior (expected) |
|------|----------------|----------------------------|
| 1 | Remain **standing still** | Baseline window collects hip position |
| 2 | Do not squat yet | Rep counter stays at 0 |
| 3 | After baseline | Live **Reps counted** may update during movement |
| 4 | Optional UI | Brief “stand still” or calibration hint — no depth or form feedback |

**Observer:** Count baseline duration with stopwatch once; log if noticeably shorter/longer than ~3 s.

**If patient squats early:** Note in log; rep count may be unreliable for that set — retry set or use manual completion.

---

## 9. Exercise instructions

Follow portal prescription (Sports Knee Session 5 example: **Mini Squat (0–45°)**, 3 × 10–15).

| Step | Instruction |
|------|-------------|
| 1 | Complete portal **preview** step → **Start exercise** when ready |
| 2 | On active step, choose **Enable camera** or **Continue without camera** |
| 3 | If using camera: complete §7–8, then perform squats per §10 |
| 4 | Squat to **comfortable depth** within program range (0–45°) — **therapist-prescribed**, not camera-prescribed |
| 5 | Complete prescribed **sets and reps** using portal controls (**Complete set** / **Complete exercise**) |
| 6 | Report pain/effort per normal session flow after exercise block |

**Clinical scope:** Patient follows **assigned plan**, not camera feedback. Camera counts movement cycles only.

---

## 10. Rep instructions

One **rep** = stand → squat down slowly → return to stand (full cycle).

| Do | Do not |
|----|--------|
| Move at a **comfortable, controlled** tempo | Rush reps to “beat” the counter |
| Return to **full standing** between reps | Partial stands to inflate count |
| Pause briefly at standing if needed | Bounce rapidly at bottom |
| Stop if pain or dizziness | Continue because counter is active |

**Depth:** Comfortable range per therapist plan. **No** “go deeper” from app or observer for CV purposes.

**Manual count rule (observer):** Count each full stand-to-stand cycle the patient **intended** as one rep; note partial reps separately in log.

---

## 11. Rest instructions

Between sets (template: **60 s rest**):

| Option | Action |
|--------|--------|
| **Camera still running** | Patient may stand still or step slightly — observer notes if they leave frame |
| **Stop tracking** | Tap **Stop tracking** if shown; rest off-camera; restart for next set if desired |
| **Portal flow** | Tap **Complete set** → rest → **Start** next set per portal UI |

**Pilot note:** Record whether patient stopped tracking between sets or ran one continuous capture. Compare rep count to manual count **per set** and **session total**.

---

## 12. Continue without camera flow

Must remain **fully valid** — same as Sit-to-Stand pilot rules.

| Step | Expected behavior |
|------|-------------------|
| 1 | On consent card, tap **Continue without camera** |
| 2 | No camera permission requested | 
| 3 | Patient completes exercise with **Complete set** / **Complete exercise** only |
| 4 | No CV row saved for that exercise | 
| 5 | Session completion, pain/effort, and clinician review **unchanged** |
| 6 | Clinician sees **Manual completion · camera not saved** (or equivalent) when session completed without CV |

**Pilot requirement:** Run **at least one** Session 5 mini squat exercise **without camera** per pilot cohort to confirm regression.

**Say to patient (EN):** “Using the camera is optional. You can complete the exercise manually — your therapist still sees your session.”

**Say to patient (AR):** «استخدام الكاميرا اختياري. يمكنك إكمال التمرين يدوياً — معالجك سيراجع جلستك.»

---

## 13. Common failure modes

| Failure mode | Likely cause | Patient-safe response (EN) | Observer action |
|--------------|--------------|----------------------------|-----------------|
| Camera permission denied | Browser / OS block | “You can continue without camera.” | Log skip; manual completion |
| Not HTTPS | Wrong URL | “Camera needs a secure link — use the portal link you were sent.” | Fix URL; do not blame patient |
| Phone too close / far | Setup | “Adjust the phone so your hips and upper body are visible.” | Remeasure distance |
| Patient squats during calibration | Timing | “Stand still for a moment while the camera adjusts.” | Retry set |
| Baggy clothes / dark room | Visibility | “Tracking signal may be weak — try brighter light or clearer clothing.” | Log tracking signal |
| Heavy wall pull | Biomechanics | “Move at your comfortable pace.” (**no form lecture**) | Note over-count risk |
| Hip hinge without knee bend | Biomechanics | Same | Note assistive-count limitation |
| Rapid partial bounces | Tempo | “Take your time between reps.” | Compare manual vs CV |
| Wrong exercise CV UI | Product bug | Stop; continue manually | **Blocker** — log P0 |
| STS copy on mini squat screen | Product bug | N/A | **Blocker** — log P0 |

---

## 14. Tracking loss scenarios

| Scenario | Expected product behavior | Patient messaging (safe) |
|----------|---------------------------|---------------------------|
| Brief pose drop (< ~0.5 s) | Counter may pause; no rep increment | “Detecting movement…” or neutral status |
| Patient steps out of frame | Pose lost; movement may show not detected | “Movement not detected — adjust camera angle.” |
| Extended pose loss | Reps may not increment; partial session | Stop tracking; save if duration ≥ 3 s and movement occurred |
| Weak tracking signal | **Fair** or **Weak** label — not form grade | “Tracking signal: Fair — results may vary.” |
| Session end before 3 s | Save may not occur | Normal — log as too_short if applicable |
| App backgrounded | Tracking may stop | Re-open portal; note in log |

**Observer:** Record **tracking signal** label at end (Good / Fair / Weak) and whether **movement detected** matched expectation.

**Never say:** “The app lost you because your squat was wrong.”

---

## 15. Safe patient wording

Use **assistive**, **neutral**, **therapist-review** language only.

### Approved concepts

- Movement **counting** (not scoring)  
- **Tracking signal** (Good / Fair / Weak — visibility, not quality)  
- **Movement detected** / not detected  
- **Session duration**  
- **Saved for therapist review**  
- **Optional** camera · **experimental** · **not clinically validated**  
- **Take your time** · **move comfortably**  

### Prohibited concepts

- Form feedback, depth targets, quality grades  
- Progression, unlock, clearance  
- Diagnosis or injury language  
- Comparison to “normal” or other patients  
- AI coaching  

---

## 16. Arabic and English wording

Copy below is **pilot-approved intent** for field use. Final strings may match `app/lib/cv/bio-0-contracts.ts` after PR-2; observers should verify on-device text matches **meaning**, not necessarily exact punctuation.

### Consent — what this does

| EN | AR |
|----|-----|
| Uses your camera on this device to detect body position | يستخدم كاميرا جهازك لاكتشاف وضع الجسم |
| Counts **mini squat** movements during your exercise | يعدّ حركات **القرفصاء الصغيرة** أثناء التمرين |
| Shows whether movement is being detected | يوضح ما إذا كانت الحركة تُكتشف |
| Saves derived counts and duration for your therapist to review | يحفظ العدد والمدة المشتقة لمراجعة المعالج |

### Consent — what this does not do

| EN | AR |
|----|-----|
| Record or upload video | لا يسجّل أو يرفع فيديو |
| Store body coordinates or pose landmarks | لا يخزّن إحداثيات الجسم أو معالم الوضعية |
| Judge whether your movement is correct or wrong | لا يحكم على صحة أو خطأ حركتك |
| Give a diagnosis, score, or treatment recommendation | لا يقدّم تشخيصاً أو نقاطاً أو توصية علاجية |
| Make an automatic progression or treatment decision | لا يتخذ قراراً تلقائياً بالتقدم أو العلاج |

### Setup and movement hints

| Context | EN | AR |
|---------|----|----|
| Optional camera note | Optional camera assist · therapist review only · not clinically validated | مساعدة كاميرا اختيارية · للمعالج فقط · غير مُتحقّق سريرياً |
| Framing | Stand facing the camera; hips and upper body visible | قف مواجهاً للكاميرا؛ الوركان والجزء العلوي من الجسم ظاهران |
| Readiness | Stand still while the camera adjusts | قف ثابتاً ريثما تضبط الكاميرا |
| Movement | Squat down slowly, then stand again at a comfortable depth | انزل ببطء في القرفصاء ثم قف مجدداً بعمق مريح |
| Reps live | Reps counted: {n} | العدات المحسوبة: {n} |
| Tracking good | Tracking signal: Good | إشارة التتبع: جيدة |
| Tracking fair | Tracking signal: Fair — results may vary | إشارة التتبع: متوسطة — قد تختلف النتائج |
| Tracking weak | Tracking signal: Weak — adjust phone or lighting | إشارة التتبع: ضعيفة — عدّل الهاتف أو الإضاءة |
| Saved | Saved — your therapist can review this session | تم الحفظ — يمكن لمعالجك مراجعة هذه الجلسة |
| Skip | Continue without camera | المتابعة بدون كاميرا |
| Prototype | Movement counting is assistive only. It is not clinically validated and does not replace your therapist's guidance. | عدّ الحركة للمساعدة فقط. غير مُتحقّق سريرياً ولا يغني عن إرشاد المعالج. |
| Comfort | Take your time and move comfortably. | خذ وقتك وتحرك براحة. |

### Observer script — introducing CV to patient (say aloud)

**EN:** “This is optional. The phone can count squat movements to help your therapist see how the session went. It does not record video and does not tell you if your form is good or bad. You can skip the camera and still complete the exercise.”

**AR:** «هذا اختياري. يمكن للهاتف عدّ حركات القرفصاء لمساعدة معالجك على متابعة الجلسة. لا يسجّل فيديو ولا يخبرك إن كانت حركتك صحيحة أم خاطئة. يمكنك تخطي الكاميرا وإكمال التمرين.»

---

## 17. Clinician observation checklist

Complete **after** patient finishes Session 5 (or dedicated mini squat pilot visit). Clinician reviews saved metrics — **does not** real-time coach from rep count during pilot unless standard clinical care.

### A. Setup and workflow

- [ ] Patient opened correct portal session (Session 5 or later with `mini-squat`)  
- [ ] Mini Squat was **first** CV exercise in session (if testing Session 5 order)  
- [ ] Consent card showed mini squat wording (not STS-only bullets)  
- [ ] **Continue without camera** path tested on at least one visit  
- [ ] Pain/effort/session completion flow unaffected  

### B. Capture quality (operational — not clinical scoring)

- [ ] Tracking signal recorded: Good / Fair / Weak / Unknown  
- [ ] Movement detected flag matches observer impression  
- [ ] Session duration plausible for prescribed sets  
- [ ] CV row saved when tracking ≥ 3 s with movement (if camera used)  
- [ ] `exercise_id` = `mini-squat` and prototype label present on clinician review  
- [ ] No video or landmark data exposed in UI  

### C. Rep count comparison (assistive accuracy)

| Set | Manual count | CV rep count | Delta | Notes |
|-----|--------------|--------------|-------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| **Total** | | | | |

- [ ] Session within **±2 reps** of manual total (pilot target per design spec)  
- [ ] False positives noted (trunk lean, partial squat, support pull)  
- [ ] False negatives noted (pose loss, out of frame)  

### D. Safety language audit

- [ ] No patient-facing form, depth, quality, or progression language observed  
- [ ] No diagnosis or clearance language from observer or app  
- [ ] Disclaimers visible on consent and/or save confirmation  

### E. Clinician review surface (after session)

- [ ] `CvReviewSummary` (or equivalent) shows exercise name **Mini Squat**  
- [ ] Rep count footer disclaimer present (“assistive movement metric…”)  
- [ ] If Session 5 included STS + mini squat: **both** CV rows visible (or schedule limitation documented)  
- [ ] Clinician does **not** treat rep count as compliance score or progression gate  

### F. Feedback

- [ ] `clinician-feedback-form.md` completed within 24 h  
- [ ] Usability rating (target ≥ 3.5/5 for “CV assist usefulness for review”)  

---

## 18. Pilot success criteria

Descriptive targets for **controlled pilot** — not product analytics. Log in `pilot-evidence-log.md`.

| Criterion | Target | How measured |
|-----------|--------|--------------|
| **Sessions run** | ≥ **3** internal mini squat CV sessions (design spec); aspire **5+** | Evidence log count |
| **Rep agreement** | ≥ **80%** of camera sessions within **±2 reps** of manual count | Manual tally table |
| **Tracking stability** | ≥ **50%** sessions Good or Fair tracking signal | Clinician review row |
| **Save reliability** | CV row present when camera used ≥ 3 s with movement | DB / clinician UI |
| **Skip path** | 100% manual completion success when camera skipped | Observer checklist |
| **STS regression** | Session 4 STS spot-check unchanged (same session or separate visit) | Evidence log |
| **Safety copy** | Zero prohibited terms on patient UI in pilot notes | Checklist §D |
| **Clinician usability** | ≥ **3.5/5** on feedback form CV questions | `clinician-feedback-form.md` |
| **Arabic pass** | ≥ 1 session full flow in Arabic with readable consent/hints | Evidence log |
| **Blockers** | Zero unresolved P0 (wrong exercise detector, STS copy on mini squat, forced camera) | Pilot lead sign-off |

**Not success criteria:** clinical outcome improvement, form quality proof, automatic progression accuracy, investor-grade efficacy claims.

---

## 19. Go / No-Go criteria for production enablement

**Production enablement** = allowlist live for real patient cohorts beyond supervised pilot (e.g. Sports Knee Foundation home users).

### Go (all required)

| # | Gate | Evidence |
|---|------|----------|
| G1 | **STS Session 4 mobile validation PASS** (prerequisite) | `pilot-evidence-log.md` row |
| G2 | **MINI-SQUAT-CV-PR-2** deployed to production | Deploy SHA / release note |
| G3 | ≥ **3** supervised mini squat CV sessions logged; ≥ **80%** within ±2 reps | §18 table |
| G4 | **Continue without camera** verified | Checklist §A |
| G5 | **STS regression** spot-check PASS on same build | Shadow tests + Session 4 mobile |
| G6 | **Safety language audit** PASS (§17D) | Pilot lead sign-off |
| G7 | **Clinician feedback** ≥ 3.5/5 usability; no “rep count feels like scoring” theme | Feedback form |
| G8 | **Arabic smoke** PASS (≥ 1 session) | Evidence log |
| G9 | **Known limitations** doc updated for clinicians (mini squat optional CV) | Docs PR (separate track) |
| G10 | **No open P0/P1** on rep wrong-exercise, API reject, or data leak | Issue tracker |

### No-Go (any triggers hold)

| # | Condition | Action |
|---|-----------|--------|
| N1 | STS Session 4 not PASS | Finish STS pilot first |
| N2 | < 80% sessions within ±2 reps after **5** attempts | Tune detector in engineering track; **do not** widen patient copy |
| N3 | Patient-facing depth, form, quality, or progression language | **Stop** — fix copy before any enablement |
| N4 | Camera required for session completion | **Stop** — ship skip path fix |
| N5 | CV saves forbidden fields or video | **Stop** — security review |
| N6 | Clinician feedback: rep count routinely misinterpreted as compliance score | Add clinician training; delay enablement |
| N7 | Multi-exercise session loses STS or mini squat row without clinician workaround | Fix indexer/UI before wide rollout |
| N8 | Pilot observer reports frequent unsafe movement ** attributed to app** | Messaging review — app must not imply safety judgment |

### Partial go (pilot cohort only)

If G1–G6 pass but G7 or rep agreement is borderline (70–79%):

- Enable for **named supervised pilot patients** only  
- Document limitations in clinician onboarding  
- Do **not** announce general availability until G3 and G7 pass  

---

## Recommended pilot sequence (Session 5)

| Order | Exercise | Camera test | Purpose |
|-------|----------|-------------|---------|
| 1 | Mini Squat | **Camera ON** | Primary validation |
| 2 | Sit-to-Stand | Camera OFF (manual) | Mixed session + STS unchanged |
| 3 | Heel Raises | Manual | Non-CV regression |
| *Alt visit* | Mini Squat | **Camera OFF** | Skip path (§12) |
| *Prior visit* | Session 4 STS | Per STS script | Prerequisite G1 |

**Duration:** ~25–40 minutes patient time including setup and clinician debrief.

---

## Evidence log snippet (copy to `pilot-evidence-log.md`)

```markdown
### Mini Squat CV pilot — Session record

| Field | Entry |
|-------|-------|
| Date | |
| Patient ID (de-identified) | |
| Session # | 5 (or ) |
| Device | iOS / Android, model |
| Language | EN / AR |
| Distance (m) | |
| Camera used on mini squat | Y / N |
| Manual rep total | |
| CV rep total | |
| Delta | |
| Tracking signal | Good / Fair / Weak |
| Movement detected | Y / N |
| Skip path tested | Y / N |
| Setup issues | |
| Blockers (P0) | None / describe |
| Clinician quote | |
| Patient quote | |
| Go/No-Go recommendation | Go / Partial / No-Go |
```

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| v0.1 | 2026-05-30 | Initial MINI-SQUAT-PILOT-SCRIPT-0 — docs only |

**Next review:** After first supervised Session 5 pilot on production build with MINI-SQUAT-CV-PR-2 deployed.
