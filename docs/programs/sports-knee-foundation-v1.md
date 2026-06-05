# RASQ Sports Knee Foundation Protocol — Template v1

**Program ID:** `sports-knee-foundation-v1`  
**Track:** RASQ-CLINICAL-LIBRARY-1  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v1.0  
**Date:** 2026-06-05  
**Body region:** Knee  
**Condition category:** Early sports knee rehabilitation / functional strengthening / balance foundation

**Related:** `sports-knee-foundation-clinical-v1.ts` · `program-templates.ts` · `cv-patient-config.ts` · `program-library-index.md`

**Exercise scope (v1 only):** Seven foundation exercises — no quad-set, heel-slide, band walks, or walking tolerance.

---

## 1. Program overview

Sports Knee Foundation v1 is a **clinician-assigned, therapist-supervised** home program for active individuals who need structured **functional strengthening and balance foundation** after subacute knee symptoms or training deconditioning.

| Parameter | Value |
|-----------|-------|
| **Focus** | Closed-chain strength, single-leg control, dynamic balance, step confidence |
| **Duration** | 2 weeks (default) |
| **Sessions per week** | 3 |
| **Total sessions** | 6 |
| **Estimated session time** | 20–35 minutes |
| **Phases** | 3 (2 sessions each) |
| **CV exercises** | Sit-to-Stand, Mini Squat, Single Leg Stance (optional assist) |
| **Manual exercises** | Heel Raise, Functional Reach, Lateral Step, Step-Up |

**RASQ role:** Workflow, adherence, and assistive derived metrics — **not** autonomous clinical decision-making.

**Pilot framing:** Workflow validation and adherence support — not clinical validation of outcomes.

---

## 2. Inclusion criteria

All require **clinician confirmation** before assignment:

| Criterion | Detail |
|-----------|--------|
| Clinical examination | Completed; no unresolved red flags |
| Weight-bearing | Partial or full weight-bearing tolerated per clinician exam |
| Pain tolerance | Pain during movement typically ≤ 6/10 at program start (clinician-adjustable) |
| Functional baseline | Able to sit-to-stand from a standard chair with supervision or independently |
| Comprehension | Understands stop rules and pain/effort reporting |
| Supervision model | Accepts therapist review requirement for any progression |

**Common clinical presentations (examples — not diagnoses):**

- Subacute knee symptoms in an active or recreational population  
- Knee deconditioning after a training pause  
- Foundation-phase strengthening when clinician judges closed-chain loading is appropriate  
- Post-injury or post-operative **foundation** work only when aligned with surgeon/protocol (clinician sets dose)

---

## 3. Exclusion / red flags

**Do not assign without medical review / clearance:**

| Category | Examples |
|----------|----------|
| **Structural emergency** | Locked knee, acute fracture suspicion, joint infection |
| **Neurovascular** | Numbness, foot drop, pulse deficit, severe swelling with compartment concern |
| **Weight-bearing** | Non–weight-bearing or touch-down weight-bearing unless protocol explicitly allows |
| **Acute post-op** | Within surgeon-restricted window without protocol alignment |
| **Instability** | Repeated giving way without bracing/supervision plan |
| **Systemic** | Unexplained fever, unrelenting night pain, unexplained weight loss |

**Stop session and contact clinician if patient reports:**

- Sharp pain > 7/10 during exercise  
- New giving way or locking  
- Rapid swelling within 2 hours of session  
- Pain that persists > 24 h significantly above baseline  
- Dizziness or near-fall during balance tasks  

---

## 4. Phases

### Phase 1 — Closed-Chain Introduction (Sessions 1–2)

| Field | Content |
|-------|---------|
| **Focus** | Safe sit-to-stand, calf endurance, intro squat depth and single-leg balance |
| **Load** | Low–moderate closed-chain; bilateral bias |
| **Clinical intent** | Establish pain-stable closed-chain pattern before unilateral loading |
| **Exit criteria (clinician review)** | Sit-to-stand × 8–10 with controlled form; pain stable ≤ 5/10 after sessions; single-leg stance ≥ 20 s with light or no touch support |

### Phase 2 — Strength & Dynamic Balance (Sessions 3–4)

| Field | Content |
|-------|---------|
| **Focus** | Mini squat volume, dynamic reach, frontal-plane stepping, balance hold progression |
| **Load** | Moderate closed-chain; mixed bilateral and unilateral |
| **Clinical intent** | Build strength and limits-of-stability without sport-specific demand |
| **Exit criteria (clinician review)** | Mini squat to ~30–45° without session-to-session pain increase; functional reach without stepping; lateral step tolerated on low step |

### Phase 3 — Functional Integration (Sessions 5–6)

| Field | Content |
|-------|---------|
| **Focus** | Step-up loading, combined session flow, review readiness |
| **Load** | Highest in v1 program — still foundation, not sport-specific |
| **Clinical intent** | Integrate step, squat, and balance tasks for clinician end-of-program review |
| **Exit criteria (clinician review)** | Step-up × 8–10 each leg with controlled descent; clinician decides maintain, regress, progress, or discharge from RASQ track |

**Progression rule:** Clinician reviews phase exit criteria — **RASQ never auto-advances phases.**

---

## 5. Six-session protocol

Each session follows the RASQ session shell:

1. Optional CV assist (where listed — patient may skip)  
2. Main exercise block (2–4 exercises)  
3. Session complete — pain (0–10), effort (1–10), optional notes  
4. Clinician review — async  

---

### Session 1 — Closed-Chain Start

**Phase:** 1  
**Session goal:** Establish a safe sit-to-stand pattern and build calf endurance for push-off.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Sit-to-Stand | `sit-to-stand` | 3 | 8–10 | 60 | **CV enabled** (optional) |
| 2 | Heel Raise | `heel-raise` | 3 | 12–15 | 45 | Manual |

**Safety cue (EN):** Stop if sharp knee pain, locking, giving way, or dizziness. Use chair arms for balance only — not to lift your body weight.  
**Safety cue (AR):** توقّف عند ألم حاد في الركبة أو تيبّس أو فقدان ثبات أو دوخة. استخدم ذراعي الكرسي للتوازن فقط وليس لرفع وزن الجسم.

---

### Session 2 — Squat & Balance Intro

**Phase:** 1  
**Session goal:** Introduce controlled partial squat depth and single-leg balance with support available.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Mini Squat (0–45°) | `mini-squat` | 3 | 10 | 60 | **CV enabled** (optional) |
| 2 | Single Leg Stance | `single-leg-stance` | 3 | 20 s each leg | 45 | **CV enabled** (optional) |

**Safety cue (EN):** Keep knees aligned over toes; stop if knees collapse inward, sharp pain increases, or you lose balance repeatedly. Support within reach for the full hold.  
**Safety cue (AR):** حافظ على محاذاة الركبتين مع أصابع القدم؛ توقّف عند انطواء الركبتين أو زيادة الألم الحاد أو فقدان التوازن المتكرر. أبقِ الدعم في متناول اليد طوال الثبات.

---

### Session 3 — Dynamic Balance

**Phase:** 2  
**Session goal:** Maintain closed-chain strength and add controlled forward reach for dynamic balance.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Sit-to-Stand | `sit-to-stand` | 3 | 10–12 | 60 | **CV enabled** (optional) |
| 2 | Heel Raise | `heel-raise` | 3 | 15 | 45 | Manual |
| 3 | Functional Reach | `functional-reach` | 3 | 3 reaches each arm | 30 | Manual |

**Safety cue (EN):** During reach, do not step or lift your heel to extend farther. Stop if dizziness or near-fall occurs.  
**Safety cue (AR):** أثناء الوصول لا تخطُ ولا ترفع الكعب لزيادة المدى. توقّف عند دوخة أو كاد سقوط.

---

### Session 4 — Lateral Control

**Phase:** 2  
**Session goal:** Build frontal-plane step control and extend single-leg balance hold time.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Mini Squat (0–45°) | `mini-squat` | 3 | 12–15 | 60 | **CV enabled** (optional) |
| 2 | Lateral Step | `lateral-step` | 3 | 8 steps each direction | 60 | Manual |
| 3 | Single Leg Stance | `single-leg-stance` | 3 | 25 s each leg | 45 | **CV enabled** (optional) |

**Safety cue (EN):** Use a stable low step (15–20 cm). Control each landing — do not snap the knee straight. Face a wall or counter if balance is limited.  
**Safety cue (AR):** استخدم درجة منخفضة ثابتة (15–20 سم). تحكم بكل هبوط دون قفل حاد للركبة. واجه حائطاً أو سطحاً إذا كان التوازن محدوداً.

---

### Session 5 — Step Loading

**Phase:** 3  
**Session goal:** Build unilateral step-up strength and reinforce dynamic reach under load.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Step-Up | `step-up` | 3 | 8 each leg | 60 | Manual |
| 2 | Sit-to-Stand | `sit-to-stand` | 3 | 12 | 60 | **CV enabled** (optional) |
| 3 | Functional Reach | `functional-reach` | 3 | 4 reaches each arm | 30 | Manual |

**Safety cue (EN):** Ensure the step will not slide. Step down slowly with control. Stop if sharp knee pain or giving way on the step.  
**Safety cue (AR):** تأكد أن الدرجة لن تنزلق. انزل ببطء وبتحكم. توقّف عند ألم حاد أو فقدان ثبات على الدرجة.

---

### Session 6 — Integration & Review

**Phase:** 3  
**Session goal:** Combine squat, step, lateral, and balance tasks to prepare for clinician end-of-program review.

| Order | Exercise | exerciseId | Sets | Reps / hold | Rest (s) | CV / Manual |
|-------|----------|------------|------|-------------|----------|-------------|
| 1 | Mini Squat (0–45°) | `mini-squat` | 3 | 12 | 60 | **CV enabled** (optional) |
| 2 | Step-Up | `step-up` | 3 | 10 each leg | 60 | Manual |
| 3 | Lateral Step | `lateral-step` | 3 | 10 steps each direction | 60 | Manual |
| 4 | Single Leg Stance | `single-leg-stance` | 3 | 30 s each leg | 45 | **CV enabled** (optional) |

**Safety cue (EN):** Quality over speed. Report pain and effort honestly after the session. This session does not clear you for sport — your therapist reviews next steps.  
**Safety cue (AR):** الجودة أهم من السرعة. أبلغ عن الألم والجهد بصدق بعد الجلسة. هذه الجلسة لا تُخوّلك للرياضة — معالجك يراجع الخطوات التالية.

---

## 6. Exercise library (v1 scope)

| exerciseId | Name (EN / AR) | Phase introduced | CV / Manual |
|------------|----------------|------------------|-------------|
| `sit-to-stand` | Sit-to-Stand / الجلوس والوقوف | 1 | **CV enabled** (optional) |
| `heel-raise` | Heel Raises / رفع الكعب | 1 | Manual |
| `mini-squat` | Mini Squat (0–45°) / قرفصاء صغيرة | 1 | **CV enabled** (optional) |
| `single-leg-stance` | Single Leg Stance / الوقوف على رجل واحدة | 1 | **CV enabled** (optional) |
| `functional-reach` | Functional Reach / الوصول الوظيفي | 2 | Manual |
| `lateral-step` | Lateral Step / الخطوة الجانبية | 2 | Manual |
| `step-up` | Low Step-Up / صعود درجة منخفضة | 3 | Manual |

**CV policy:** Camera is **never required** for session completion. CV outputs rep count, duration, and tracking signal — **not** movement quality or form scores. See `cv-patient-config.ts` allowlist.

**Per-exercise copy:** Bilingual instructions, safety warnings, and common mistakes live in `sports-knee-foundation-clinical-v1.ts` and merge into Exercise Library v1.

---

## 7. Pain and effort rules

| Signal | Patient-facing rule | Clinician interpretation |
|--------|---------------------|--------------------------|
| Pain during exercise | Stop if sharp pain; stay ≤ 5/10 unless clinician set higher | Rising pain trend → review |
| Pain after session | Mild soreness ≤ 24 h acceptable if familiar | Pain +2 points × 2 sessions → review |
| Effort | Report 1–10 after session | Effort ≥ 8/10 × 3 sessions → review load |
| Swelling | Report if knee feels “puffy” after session | May regress phase |

**No automated treatment changes from pain/effort alone** — flags are review prompts for clinician.

---

## 8. Maintain / regress / progress rules

| Decision | Criteria | Who decides |
|----------|----------|-------------|
| **Maintain** | Stable pain/effort, goals met for phase | Clinician |
| **Regress** | Pain spike, swelling, giving way report, failed exit criteria | Clinician — reduce dose or return to prior phase exercises |
| **Progress** | Phase exit criteria met; clinician examination | **Clinician only** — may advance phase, repeat sessions, or assign next program |
| **Discharge from track** | Goals met; patient independent with home program | Clinician |

**RASQ does not auto-maintain, regress, or progress.**

---

## 9. Clinician review checklist

### Before Session 1 (initial assign)

- [ ] Clinical examination completed; red flags ruled out  
- [ ] Weight-bearing status confirmed  
- [ ] Pain threshold documented (default ≤ 5/10 during exercise)  
- [ ] Dose edited if needed (sets/reps reduced 30–50% for irritable presentation)  
- [ ] Precautions documented in plan notes  
- [ ] Patient understands stop rules and CV is optional  

### After Session 3 (mid-program)

- [ ] Pain/effort trend reviewed (last 3 sessions)  
- [ ] Adherence checked (sessions completed vs prescribed)  
- [ ] Optional CV rows reviewed (rep count context only — not quality)  
- [ ] Phase 1 exit criteria assessed  
- [ ] Decision: maintain Phase 2 dose / regress / hold progression  

### After Session 6 (end foundation)

- [ ] Phase 3 exit criteria assessed on exam + session logs  
- [ ] Decision documented: maintain, regress, progress to next track, or discharge  
- [ ] Patient informed that sport return requires separate clinician judgment  

### Ad hoc review triggers

- [ ] Pain increased ≥ 2 points over 2 consecutive sessions  
- [ ] Effort ≥ 8/10 for 3 consecutive sessions  
- [ ] New locking, giving way, or swelling report  
- [ ] Zero sessions completed in 7 days  
- [ ] Patient message or clinic flag  

---

## 10. Patient-friendly explanation

**English**

This is a 6-session home program to help your knee feel stronger and more stable for everyday movements like standing, squatting, stepping, and balancing. You will do 3 sessions per week for about 2 weeks.

Some exercises can use your phone camera to count reps or hold time — **this is optional** and does not judge whether your movement is correct. Other exercises you complete manually.

After each session, report your pain (0–10) and effort (1–10). Stop if you feel sharp pain, your knee gives way, or you feel unsafe. Contact your clinic if stop rules apply.

**Your therapist reviews your progress and decides whether to continue, adjust, or move to the next stage. This program does not clear you to return to sport.**

**Arabic (عربي)**

هذا برنامج منزلي من 6 جلسات لمساعدة ركبتك على الشعور بقوة وثبات أكبر في الحركات اليومية مثل الوقوف والقرفصاء والصعود والتوازن. ستقوم بـ 3 جلسات أسبوعياً لمدة أسبوعين تقريباً.

بعض التمارين يمكن استخدام كاميرا الهاتف لعد التكرارات أو وقت الثبات — **هذا اختياري** ولا يحكم على صحة الحركة. تمارين أخرى تُنجز يدوياً.

بعد كل جلسة، أبلغ عن الألم (0–10) والجهد (1–10). توقّف عند ألم حاد أو فقدان ثبات أو شعور بعدم الأمان. تواصل مع العيادة عند تطبيق قواعد التوقف.

**معالجك يراجع تقدمك ويقرر الاستمرار أو التعديل أو الانتقال للمرحلة التالية. هذا البرنامج لا يُخوّلك للعودة للرياضة.**

---

## 11. What not to claim

| Forbidden claim | Why |
|-----------------|-----|
| Return-to-sport clearance or “ready to play” | Clinician-only judgment; not in RASQ scope |
| Diagnosis or injury labeling from session data | No diagnosis policy |
| Automatic progression between phases or sessions | Clinician decides all progression |
| Movement quality or form scoring from CV | CV is assistive rep/hold context only |
| Clinical validation of CV accuracy | Pilot assistive metrics only |
| Superior outcomes vs standard care | Not evidenced in RASQ v1 |
| Injury prediction or risk scoring | Forbidden platform-wide |
| Replacement for surgeon/physio post-op protocol | Foundation template only |
| Patient-facing AI exercise advice | Clinician dashboard English-only; no auto advice |

**Required platform disclaimer (inherit):**

> Derived movement metrics and session observations are assistive only. Not clinically validated. Therapist review required. No automatic treatment decisions.

---

## 12. How this maps to RASQ template (`program-templates.ts`)

### Template metadata fields

| `PilotProgramTemplate` field | v1 value |
|------------------------------|----------|
| `id` | `sports-knee-foundation-v1` |
| `title` | Sports Knee Foundation v1 |
| `conditionArea` | Knee |
| `level` | Foundation |
| `bodyRegion` | `knee` |
| `conditionCategory` | Early sports knee rehabilitation / functional strengthening / balance foundation |
| `durationWeeks` | 2 |
| `sessionsPerWeek` | 3 |
| `programGoal` | Section 1 overview (clinician-facing) |
| `patientFriendlyGoal` | Section 10 (English) |
| `suitableFor` | Section 2 inclusion criteria |
| `notSuitableFor` | Section 3 exclusion / red flags |
| `redFlags` | Section 3 stop-session list |
| `safetyNotes` | Per-session safety cues + pain rules |
| `phaseGoal` | Phase 3 integration goal (highest-load phase summary) |
| `expectedResponse` | Stable pain/effort; improving control on STS, squat, step, balance |
| `reviewCriteria` | Section 9 checkpoints |
| `clinicianUseNote` | Therapist-guided; edit dose before assign; no auto-progression |

### Session builder

Replace `buildSportsKneeFoundationSessions()` (12-session v0) with `buildSportsKneeFoundationV1Sessions()`:

```typescript
// Pseudocode — implement when approved
function buildSportsKneeFoundationV1Sessions(): PilotProgramSession[] {
  const sts = () => templateExercise("sit-to-stand", "Sit-to-Stand", { sets: 3, reps: "8–12", restSec: 60 });
  const heel = () => templateExercise("heel-raise", "Heel Raises", { sets: 3, reps: "12–15", restSec: 45 });
  const squat = () => templateExercise("mini-squat", "Mini Squat (0–45°)", { sets: 3, reps: "10–15", restSec: 60 });
  const sls = () => templateExercise("single-leg-stance", "Single Leg Stance", { sets: 3, durationSec: 30, restSec: 45 });
  const reach = () => templateExercise("functional-reach", "Functional Reach", { sets: 3, reps: "3–4 each arm", restSec: 30 });
  const lateral = () => templateExercise("lateral-step", "Lateral Step", { sets: 3, reps: "8–10 each direction", restSec: 60 });
  const step = () => templateExercise("step-up", "Low Step-Up", { sets: 3, reps: "8–10 each leg", restSec: 60 });
  // Return 6 sessions per Section 5 tables
}
```

### Exercise library prerequisites

| exerciseId | In `exercise-library-v1.ts`? | In `sports-knee-foundation-clinical-v1.ts`? | CV in `cv-patient-config.ts`? |
|------------|------------------------------|---------------------------------------------|-------------------------------|
| `sit-to-stand` | Yes | Yes | Yes |
| `mini-squat` | Yes | Yes | Yes |
| `single-leg-stance` | Yes | Yes | Yes |
| `heel-raise` | Yes | Yes | No (manual) |
| `functional-reach` | **Add before import** | Yes | No (manual) |
| `lateral-step` | **Add before import** | Yes | No (manual) |
| `step-up` | Yes | Yes | No (manual) |

### CV session flags

When building prescriptions, CV-enabled exercises should reference library entries that resolve to IDs in `CV_Y1_ENABLED_EXERCISE_IDS`. Patient portal shows optional camera flow; manual check-off remains valid.

### Data fields tracked

| Field | Source |
|-------|--------|
| `plan_sessions.status` | Session completion |
| `session_logs.pain_score` | Patient portal |
| `session_logs.effort_score` | Patient portal |
| `session_logs.exercises_completed` | Manual + CV |
| `cv_session_metrics.*` | Optional — STS, mini-squat, SLS only |

### Relationship to v0 doc

| Artifact | Relationship |
|----------|--------------|
| `sports-knee-foundation.md` (v0) | 12-session, 12-exercise library spec — **superseded for pilot v1 scope** |
| `sports-knee-foundation` in `program-templates.ts` | Current app template — still v0 sessions until v1 import approved |
| `sports-knee-foundation-clinical-v1.ts` | Canonical bilingual exercise copy for all 7 v1 exercises |

---

## Document control

| Field | Value |
|-------|-------|
| RASQ code impact | **None** until explicit import approval |
| App implementation | **Not started** |
| Files to touch on import | `program-templates.ts`, `exercise-library-v1.ts` (functional-reach, lateral-step), `program-library-index.md` |
| Commit | **Awaiting approval** |
