# STS motion timeline — internal pilot (SMT-1)

**Status:** Developer-only. Not shown to patients or clinicians. Not persisted.

## Enable (controlled session)

Add both query parameters to a **patient Sit-to-Stand** session URL:

```
?cvDebug=1&smtTimeline=1
```

`PATIENT_STS_CONFIG.motionTimelineEnabled` stays **unset** in production. Timeline collection runs only when the pilot gate above is active (or if config is explicitly set `true` in a future controlled rollout).

## Manual verification

1. Open STS session with `?cvDebug=1&smtTimeline=1`.
2. Start camera, complete ≥3 reps, stop session.
3. DevTools → Console → look for `[smt-1] session motion summary`.
4. Confirm fields: `snapshotCount` ≥ 1, `legacyRepCount` matches on-screen reps, `forbiddenKeyCount` = 0.
5. Repeat **without** query params: no `[smt-1]` summary log; save/metrics unchanged.

## Rollback

Remove query params or revert the pilot-gate PR. No database or API rollback required.

## Evidence

Record outcome in `pilot-evidence-log.md` (observation only).
