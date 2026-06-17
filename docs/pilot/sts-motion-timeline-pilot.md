# STS motion timeline — patient pilot notes

**Status:** Enabled for patient Sit-to-Stand via `PATIENT_STS_CONFIG.motionTimelineEnabled` (production patient config). Derived motion evidence feeds clinician review paths when saves succeed — **therapist review required**, not a clinical assessment.

## Optional developer gate (legacy)

For controlled internal debugging, query parameters may still be used on a patient Sit-to-Stand session URL:

```
?cvDebug=1&smtTimeline=1
```

This is **not required** for timeline collection in the current patient STS config.

## Manual verification (clinician / QA)

1. Open a patient Sit-to-Stand session (with or without debug query params).
2. Start camera, complete ≥3 reps, stop session.
3. Confirm session metrics save and clinician review shows motion evidence where wired (Results, Assessment Center STS review, motion report when present).
4. Confirm capture quality / limited-capture messaging behaves as expected after PR100–PR101.

## Rollback

Revert patient STS config or timeline wiring PRs. No database rollback required for pilot gate changes.

## Evidence

Record outcome in `pilot-evidence-log.md` (observation only).

## See also

- `docs/RASQ_CURRENT_STATE.md` — platform snapshot
- `docs/pilot/known-limitations.md` — pilot safety framing
