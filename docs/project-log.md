# Project log

## 2026-05-30 — MQ-SIGNAL-1B session-level visibility summary merged to production

### Summary

PR #6 was merged into main and deployed to production. This release summarizes saved CV tracking visibility across the whole session instead of using only the last pose frame at save time.

Previously, `trackingQuality` could show **Limited camera visibility** if the final frame was weak, even when most of the session had fair or good hip landmark visibility and reps were counted correctly.

### Production status

- Production URL: https://creative-motion-web.vercel.app
- Merge commit: `5b9db24`
- PR: #6 — CV: summarize tracking visibility by session
- Deployment status: Ready
- Production QA: Passed

### What shipped

- Session-level visibility summary helper (`session-visibility-summary.ts`)
- Unit tests for median hip visibility and conservative downgrade gates
- Sit-to-Stand detector accumulators for in-memory session visibility (not persisted)
- Saved `trackingQuality` in `getDerivedMetrics()` uses session summary; live patient UI still uses last-frame value

### Validated QA

- Unit tests: `npx tsx --test app/lib/cv/session-visibility-summary.test.ts` — 10/10 pass
- Build: `npm run build` — pass
- Production `/clinician` loads
- Movement tracking sessions display correctly on patient profile
- MQ-SIGNAL-1A clinician copy unchanged (`poor` → **Limited camera visibility**)

### Known note

Existing CV rows saved before this deploy keep prior last-frame visibility semantics. **New saves** after production deploy use the session-level summary.

### Safety boundaries

- No rep counting changes
- No readiness changes
- No threshold changes (uses existing `visibilityGood` / `visibilityFair`)
- No API changes
- No schema changes
- No diagnosis
- No clinical scoring
- No automatic treatment recommendation
- No automatic progression
- No patient-facing movement judgment
- No video storage
- No landmark persistence
- No AI
- No MQE
- CV remains optional and experimental
- Therapist review only

### Next recommended step

1. Post-deploy fresh Sit-to-Stand CV session on production to confirm saved visibility reflects session quality (not last frame).
2. MQ-REP-1 audit only (per-rep capture FSM — no implementation yet).

---

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
