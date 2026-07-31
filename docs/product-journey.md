# RASQ Product Journey

End-to-end product map with **integration status** labels. Evidence: [RASQ Current State](./RASQ_CURRENT_STATE.md) and verified routes under `app/`. Do not assume full integration where documentation marks a gap.

**Status key:**

- **Implemented** — available in the verified user-facing or service workflow described
- **Partial** — some required components, libraries, or wiring exist, but the full stage is not complete
- **Deferred** — not yet implemented or connected for the current workflow

Library-only code (for example Motor Screen engines) is **Partial** in the user journey until UI, API, and live capture are wired.

---

## Clinician journey

| Step | Description | Status |
|------|-------------|--------|
| 1 | **Select patient** — open patient list or profile | **Implemented** — `/clinician/patients` |
| 2 | **Review intake and safety information** — post-stroke or MSK intake context | **Partial** — post-stroke intake and remote assessment flows exist; not all intake types unified |
| 3 | **Review or approve Subjective information** — patient-reported assessment answers | **Partial** — remote assessment review live; clinician-owned fields required |
| 4 | **Assign assessment** — remote link, Assessment Center, or future Motor Screen assignment | **Partial** — remote assessment and Assessment Center (STS, Gait shell) live; **Motor Screen assignment UI deferred** |
| 5 | **Review factual Objective outputs** — CV metrics, motion timeline, Motor Screen attempt results | **Partial** — STS review live via Assessment Center; Gait shell only; **Motor Screen results review deferred** |
| 6 | **Review unified report** — assessment report resolver output | **Partial** — assessment report flow live; not all assessment types produce the same depth of objective data |
| 7 | **Define goals or rehabilitation program** — assign plan from template | **Implemented** — `/clinician/plans/new` |
| 8 | **Monitor progress** — session activity, outcomes hub, review queue | **Partial** — Progress & Outcomes Hub v1 read-only; operational badges; not all data sources unified |

Optional: **AI draft summary** (clinician-only, review not persisted to patient) — **Live capability; partial end-to-end workflow integration**, per [Current State](./RASQ_CURRENT_STATE.md).

---

## Patient journey

| Step | Description | Status |
|------|-------------|--------|
| 1 | **Access patient portal** — tokenized link | **Implemented** — `/patient/[token]` |
| 2 | **Review assigned work** — see plan sessions and exercises | **Implemented** |
| 3 | **Confirm readiness** — setup and framing before camera assist | **Partial** — STS adaptive framing readiness live; varies by exercise |
| 4 | **Complete supervised assessment or rehabilitation session** — with or without optional CV | **Partial** — rehabilitation sessions live; optional CV (STS most mature); **Motor Screen patient execution UI deferred** |
| 5 | **Experience protective pause where applicable** — tracking or environment pause | **Partial** — Motor Screen protective-pause evaluator implemented in library; **not wired to patient UI**; CV sessions have quality/interruption handling |
| 6 | **Resume only through explicit human action** — no automatic resume after pause | **Partial** — Motor Screen engine requires explicit human resume; **UI wiring deferred** |
| 7 | **Complete session** — submit effort, pain, session log | **Implemented** |
| 8 | **View appropriate progress information** — patient-visible progress | **Partial** — session completion confirmed; full progress surfacing varies by plan and data availability |

Remote assessment path (`/assessment/[token]`) is **Implemented** for patient-reported intake separate from portal rehabilitation sessions.

---

## Assessment versus rehabilitation

| Domain | Purpose | Examples in codebase |
|--------|---------|----------------------|
| **Upper-Limb Motor Screen** | **Assessment** — clinician-assigned, CV-supported, clinician-reviewed structured tasks | `app/lib/upper-limb-motor-screen/` — `forwardReach`, `lateralReach`, `elbowExtension` |
| **Interactive Upper-Limb Rehabilitation** | **Training** — patient rehabilitation sessions | `app/lib/interactive-shoulder/`, Reach the Light, clinical motion pattern engine |

**Do not mix:**

| Item | Domain |
|------|--------|
| Motor Screen **Forward Reach** (`taskId: forwardReach`) | Assessment |
| Patient CV **`functional-reach`** exercise | Rehabilitation (optional camera assist) |
| **Reach the Light** | Interactive rehabilitation training |

See [Upper-Limb Motor Screen](./upper-limb-motor-screen.md).

---

## Current integration gaps

Verified gaps only:

| Gap | Notes |
|-----|-------|
| Motor Screen **clinician assignment UI** | Engines complete on `dev_branch`; no assignment surface |
| Motor Screen **patient execution UI** | No live capture surface for Motor Screen tasks |
| **API and persistence integration** | Attempt results not persisted through production API |
| **Session Orchestrator wiring** | Motor Screen not connected to session orchestrator |
| **Live-camera validation** | Synthetic tests pass; recorded-sequence and live-camera validation still required |
| **Clinician result-review integration** | No Assessment Center card or review surface for Motor Screen outputs |

Additional platform gaps (not Motor Screen specific): Gait live capture, Balance Assessment shell, Functional Movement and Patient-Reported Forms — see [RASQ Current State](./RASQ_CURRENT_STATE.md).

---

## Related documents

- [Project Overview](./project-overview.md)
- [RASQ Current State](./RASQ_CURRENT_STATE.md)
- [Pilot Workflow](./pilot/pilot-workflow.md)
- [Upper-Limb Motor Screen](./upper-limb-motor-screen.md)
