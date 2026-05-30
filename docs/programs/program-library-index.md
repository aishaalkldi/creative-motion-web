# RASQ Clinical Program Library — Index v0

**Track:** RASQ-CLINICAL-LIBRARY-0  
**Status:** Documentation / spec only — **not implemented in app**  
**Version:** v0.1  
**Date:** 2026-05-31  

**Purpose:** Canonical index for foundation clinical programs in RASQ. These specs define **what clinicians may assign in future implementations** — they do **not** activate programs in the product today.

---

## Global safety boundaries (all programs)

| Rule | Status |
|------|--------|
| No diagnosis | Required |
| No clinical scoring | Required |
| No automatic progression | Required |
| No treatment plan mutation by algorithm | Required |
| No return-to-sport clearance | Required |
| No injury prediction | Required |
| No patient-facing AI advice | Required |
| No movement quality score to patient | Required |
| Therapist approval for all progression | Required |
| Clinician dashboard English-only | Required |
| Patient portal may use EN + optional AR (exercise copy) | Per language policy |
| Supine exercises remain manual-only (no CV) | Required |
| Sit-to-stand CV optional assistive context only | Where listed |

**RASQ role:** Workflow, adherence, and assistive derived metrics — **not** autonomous clinical decision-making.

---

## Program catalog

| Program ID | Document | Body region | Duration | CV in v0 | Detail level |
|------------|----------|-------------|----------|----------|--------------|
| `sports-knee-foundation` | [sports-knee-foundation.md](./sports-knee-foundation.md) | Knee | 4 wk · 3/wk | Optional STS | **Full (reference)** |
| `sports-ankle-foundation` | [sports-ankle-foundation.md](./sports-ankle-foundation.md) | Ankle | 4 wk · 3/wk | None | Standard |
| `hip-pelvic-control-foundation` | [hip-pelvic-control-foundation.md](./hip-pelvic-control-foundation.md) | Hip / pelvis | 4 wk · 3/wk | Optional STS | Standard |
| `low-back-foundation` | [low-back-foundation.md](./low-back-foundation.md) | Lumbar | 4 wk · 3/wk | None | Standard |
| `neck-posture-foundation` | [neck-posture-foundation.md](./neck-posture-foundation.md) | Cervical | 4 wk · 3/wk | None | Standard |
| `shoulder-foundation` | [shoulder-foundation.md](./shoulder-foundation.md) | Shoulder | 4 wk · 3/wk | None | Standard |

---

## Relationship to app today

| App artifact | Relationship to library v0 |
|--------------|----------------------------|
| `app/lib/program-templates.ts` | Pilot templates (e.g. `knee-foundation-01`) — **partial overlap**; library v0 docs are canonical specs for future import |
| `app/lib/exercise-library-v1.ts` | Exercise IDs referenced by programs |
| `app/lib/cv/cv-patient-config.ts` | Sit-to-stand only CV allowlist |
| Patient portal | No new programs until explicit implementation approval |

**Implementation status:** **None** — docs/specs only.

---

## Shared session shell (all programs)

1. Patient opens assigned plan session in portal  
2. Optional CV consent (sit-to-stand sessions only)  
3. Manual exercise completion (check-off / flow per current portal)  
4. Pain (0–10) and effort (1–10) capture  
5. Session marked complete — clinician reviews asynchronously  

Camera is **never required** for completion.

---

## Shared pain and effort rules (defaults)

| Signal | Default rule | Action |
|--------|--------------|--------|
| Pain during exercise | ≤ 5/10 unless clinician overrides | Patient stops if sharp pain |
| Pain after session | Track in log | +2 points × 2 sessions → review prompt |
| Effort | 1–10 post-session | ≥ 8/10 × 3 sessions → review prompt |
| Red-flag symptoms | Patient stops | Contact clinic — not RASQ triage |

Clinician may override thresholds in plan notes.

---

## Shared maintain / regress / progress model

```
┌─────────────┐     clinician review     ┌─────────────┐
│  Maintain   │ ◄─────────────────────── │   Current   │
│  same dose  │                          │    phase    │
└─────────────┘                          └──────┬──────┘
       ▲                                        │
       │              clinician review            │
┌──────┴──────┐                          ┌──────▼──────┐
│   Regress   │ ◄── pain spike / exam ── │  Progress   │
│ lower dose  │                          │ next phase  │
└─────────────┘                          └─────────────┘
```

**RASQ never auto-transitions.** Review checkpoints at assign, mid-program (~session 6), end (~session 12).

---

## CV policy summary

| Program | CV exercise | Required? |
|---------|-------------|-----------|
| Sports Knee Foundation | `sit-to-stand` | No |
| Hip & Pelvic Control | `sit-to-stand` (when in session) | No |
| All others | — | No |

CV outputs: rep count, duration, tracking signal, movement detected — **not** form or quality scores.

---

## AI Clinician Summary (all programs)

| Allowed | Forbidden |
|---------|-----------|
| Adherence, pain/effort trends | Diagnosis, progression advice |
| Optional CV rep mention | RTS clearance language |
| English draft + disclaimer | Patient-facing output |

---

## MQE v0 (future, all programs with STS)

Read-time clinician-only completion observations — see `docs/mqe/`. Not integrated in v0 library implementation.

---

## Outcome measures strategy

| Layer | Examples |
|-------|----------|
| **In RASQ** | Session completion, pain/effort logs, optional CV aggregates |
| **External / clinic** | KOOS, FAAM, NDI, ODI, validated questionnaires |
| **Not in RASQ v0** | Clinical scores, RTS batteries, imaging |

---

## Pilot evaluation (cross-program)

| Metric | Use |
|--------|-----|
| Programs assigned vs started | Workflow |
| Sessions completed / prescribed | Adherence |
| Clinician template edit rate | Usability |
| CV opt-in rate (STS programs) | Feature uptake |
| Review checkpoint completion | Process |
| Clinician feedback form | Qualitative |
| Safety events via notes | Monitoring |

---

## What RASQ Clinical Program Library v0 does not claim

- Clinical efficacy of any program  
- Validation of exercise dose  
- Replacement for in-person examination  
- Regulatory clearance as SaMD  
- Automatic personalization  

---

## Document control

| Field | Value |
|-------|-------|
| Files in pack | 7 (this index + 6 programs) |
| RASQ code impact | **None** |
| API / schema impact | **None** |
| Commit | **Awaiting explicit approval** |

---

## Revision history

| Version | Date | Notes |
|---------|------|-------|
| v0.1 | 2026-05-31 | Initial library pack — RASQ-CLINICAL-LIBRARY-0 |
