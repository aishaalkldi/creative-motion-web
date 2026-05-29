# Project log

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
