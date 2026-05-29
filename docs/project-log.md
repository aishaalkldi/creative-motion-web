# Project log

## 2026-05-29 — MQ-SIGNAL-1A tracking visibility copy merged to production

### Summary

PR #4 was merged into main and deployed to production. This release clarifies tracking visibility wording for clinicians and patients without changing CV counting, thresholds, or stored metrics.

### Production status

- Production URL: https://creative-motion-web.vercel.app
- Merge commit: `ec7615a`
- PR: #4 — CV: clarify tracking visibility labels
- Deployment status: Ready
- Production QA: Passed

### What shipped

- Clinician label: **Poor signal** → **Limited camera visibility**
- Plan session row: **signal: poor** → **visibility: limited**
- Clinician helper: camera signal reflects landmark visibility only; it does not assess movement quality
- Patient EN/AR setup guidance (hips, upper body, chair visible; start after camera shows ready)

### Validated QA

- Production clinician Movement tracking shows **Limited camera visibility**
- Plan rows show **visibility: limited**
- Helper copy visible under Movement tracking sessions
- Patient setup strings deployed (EN/AR)
- Copy/UI only — no detector, API, or schema changes

### Safety boundaries

- No diagnosis
- No clinical scoring
- No automatic treatment recommendation
- No automatic progression
- No patient-facing movement judgment
- No video storage
- No schema changes
- No new API routes
- No AI
- No MQE
- CV remains optional and experimental
- Therapist review only

### Next recommended step

MQ-SIGNAL-1B: session-level visibility summary (not biomechanics yet).

---

## 2026-05-29 — MQ-READY-0 CV readiness merged to production

### Summary

PR #2 was merged into main and deployed to production. This release adds the production-clean mobile Sit-to-Stand CV readiness and parent-owned patient save flow.

### Production status

- Production URL: https://creative-motion-web.vercel.app
- Merge commit: `3bb484f`
- PR: #2 — CV readiness clean merge candidate
- Deployment status: Ready
- Production QA: Passed

### What shipped

- Mobile optional Sit-to-Stand CV readiness gate
- Parent-owned CV capture/save flow
- Save metrics before exercise completion
- Patient-safe EN/AR save status messages
- Clinician camera status labels
- Therapist-review-only CV disclaimers

### Validated QA

- 3/3 Sit-to-Stand sessions completed on preview before merge
- 3 CV rows saved
- 25 total reps recorded
- Save without pressing Stop tracking confirmed
- Production clinician routes loaded
- Patient portal loaded
- Session page loaded
- Sit-to-Stand CV remains optional
- Clinician camera status labels appear

### Safety boundaries

- No diagnosis
- No clinical scoring
- No automatic treatment recommendation
- No automatic progression
- No patient-facing movement judgment
- No video storage
- No schema changes
- No new API routes
- No AI
- No MQE
- CV remains optional and experimental
- Therapist review only

### Known follow-up

Tracking signal may still show Poor signal in some sessions. This is a tracking-quality improvement, not a save-path failure.

### Next recommended step

Run one fresh production QA patient if needed, then plan the next sprint:

- Tracking signal quality tuning
- Motion Quality Engine v0 design
- Clinician feedback loop
