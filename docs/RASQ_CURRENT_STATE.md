# RASQ Current State

**Last updated:** 2026-06-17  
**Baseline:** `main` through **PR101** (merge `0070a7b`)

This document is the single source of truth for RASQ platform state during controlled clinic pilots. It is **not** a clinical or legal document. All movement observations require **therapist review**. RASQ does **not** diagnose, score clinically, or make automatic treatment decisions.

---

## Production snapshot

| Area | Status |
|------|--------|
| Core workflow (assessment → plan → patient portal → clinician review) | Live |
| Clinician-only AI draft summary v0 | Live — review only, not persisted to patient |
| Assessment Center | Live — `/clinician/assessments` |
| Sit-to-Stand assessment review | Live — `/clinician/assessments/sit-to-stand` |
| Gait Assessment v1 | Shell live — `/clinician/assessments/gait` (no live capture yet) |
| Patient CV (optional camera assist) | Live — multi-exercise allowlist; **STS most mature** |
| STS capture quality & reliability | Live — PR100 |
| STS adaptive framing readiness | Live — PR101 |
| Balance / Functional Movement / PR forms (Assessment Center) | Coming next |

**Production URL:** https://creative-motion-web.vercel.app

---

## Architecture (high level)

```
Clinician portal                         Patient portal
────────────────                         ──────────────
Assessment Center                        Active exercise session
  ├─ STS motion evidence review            └─ PatientCvCapture (on-device)
  └─ Gait shell (planned metrics)              ├─ MediaPipe pose
Results queue / CV Lab                         ├─ Exercise detectors
Patient profile + AI draft (clinician)         ├─ Setup readiness + framing
                                               └─ Derived metrics POST
         │                                           │
         └──────────── Supabase / API ────────────────┘
                              │
                    Motion analysis report
                    Capture quality + reliability flags
                    STS motion pilot record (when present)
```

**Safety framing (all surfaces):** Camera-assisted observations and derived metrics support **therapist review only**. They are **not clinically validated** as standalone assessments, do **not** diagnose, and do **not** replace licensed clinical judgment.

---

## Completed PRs (recent — PR99–PR101)

### PR99 — Gait Assessment v1 shell
- Assessment Center hub links for **Gait** and **Sit-to-Stand**
- `/clinician/assessments/gait` — clinician review shell, planned walking metrics, therapist-review disclaimer
- **No** live gait capture, detector, or persistence

### PR100 — STS capture reliability & quality review
- Capture quality scoring aligned with `capture_setup_limited` and interruption flags
- Clinician capture limitations summary (visibility %, rep clarity, flags) for medium/low sessions
- Patient limited-quality messaging and retest guidance
- Compatible with older records; no database changes

### PR101 — STS adaptive framing readiness
- `sts-landmark-coverage` module — shoulders, hips, knees core; ankles bonus only
- STS readiness can pass under advisory `move_back` when coverage + tracking are good
- Hip/knee safety gates unchanged; non-STS framing unchanged
- STS setup copy updated for tall users and small rooms

### PR98 — Superseded (open PR #97)
- **STS assessment card + review route** landed on `main` via **PR99**
- Open PR #97 can be **closed without merge** — see [Open PR cleanup](#open-pr-cleanup)

---

## Patient computer vision (current)

### Allowlist (`PatientCvCapture`)

Optional camera assist may appear during active portal sessions for:

| Exercise | Maturity | Notes |
|----------|----------|-------|
| **sit-to-stand** | **Primary / most mature** | Biomech capture v2, motion timeline, capture quality, PR101 coverage readiness |
| mini-squat | Wired | Baseline rep counting |
| single-leg-stance | Wired | Hold detection shell |
| heel-raise | Motion pilot | Feature-flagged copy path |
| step-up | Motion pilot | Feature-flagged copy path |
| lateral-step | Motion pilot | Feature-flagged copy path |
| functional-reach | Motion pilot | Feature-flagged copy path |

**Pilot messaging:** Position **sit-to-stand** as the reference CV path for demos. Other exercises may show optional camera assist when present in assigned plans — still **experimental**, **therapist-review only**, and **not pilot-critical**.

**Patient choice:** Continue without camera always available. Poor tracking or save errors do not block session completion.

**CV Lab** (`/clinician/cv-lab`): Internal clinician tooling — not required for patient pilot path.

---

## Assessment Center

| Card | Route | State |
|------|-------|-------|
| Gait Assessment | `/clinician/assessments/gait` | Shell v1 — planned metrics only |
| Sit-to-Stand Assessment | `/clinician/assessments/sit-to-stand` | Live — filters STS session metrics via `CvReviewSummary` |
| Balance Assessment | — | Coming next |
| Functional Movement | — | Coming next |
| Patient-Reported Forms | — | Coming next |

---

## Pilot readiness

| Dimension | Assessment |
|-----------|------------|
| Core RASQ workflow | **Ready** for controlled pilots |
| STS optional camera assist | **Ready** — PR100/101 hardening complete |
| Assessment Center | **Partial** — STS review useful; Gait/Balance are shells |
| Pilot documentation | **Updated** via PR102 — review `docs/pilot/known-limitations.md` before demo |
| Legal / counsel | Pages pilot-ready; counsel review required before commercial contracts |

**Pre-demo:** Use `docs/pilot/pilot-checklist.md` and `docs/pilot/clinician-onboarding-guide.md`.

---

## Deferred items

- Gait **live capture** and structured metrics
- Balance Assessment shell (Assessment Center)
- Functional Movement and Patient-Reported Forms modules
- Overlay UX polish when STS coverage-ready but framing advisory is amber
- CV pilot doc alignment for motion-pilot exercises beyond STS
- Close superseded PR #97 (PR98)
- Experimental branch PR #1 (`cv-readiness-experimental`) — not pilot scope

**Explicitly out of scope:** Database schema changes for CV pilots, patient-facing AI, diagnosis wording, autonomous treatment decisions, clinical scoring engines.

---

## Recommended next PR

**PR103 — Balance Assessment v1 shell** (product)

Follow PR99 pattern: clinician shell page, Assessment Center card, planned metrics, therapist-review copy — no capture, no DB, no AI.

**Alternative:** Gait capture foundation v1 if walking assessment is the next demo priority.

---

## Open PR cleanup

| PR | Branch | Recommendation |
|----|--------|----------------|
| **#97 (PR98)** | `pr98/make-sts-assessment-card-actionable` | **Close without merge** — superseded by PR99 on `main`. `sit-to-stand/page.tsx` is identical; `page.tsx` on `main` additionally includes Gait Assessment v1 links. |

Suggested close comment:

> Superseded by PR99 (merged to main). STS assessment card, `/clinician/assessments/sit-to-stand`, and `CvReviewSummary` integration are already on main. No unique changes remain.

---

## Related documents

- `docs/pilot/known-limitations.md` — Share with clinicians before pilot
- `docs/pilot/pilot-checklist.md` — Before / during / after demo
- `docs/pilot/clinician-onboarding-guide.md` — First-time clinician steps
- `docs/pilot/pilot-workflow.md` — End-to-end flow
- `docs/project-log.md` — Historical merge log
