# RASQ Project Overview

RASQ is an AI-assisted rehabilitation intelligence platform. The current hackathon scope focuses on **post-stroke upper-limb rehabilitation** within a broader musculoskeletal and neurological care workflow.

---

## Problem

Rehabilitation teams need structured ways to assign work, collect patient-reported and movement observations, and review progress under clinician supervision. Manual coordination across intake, assessment, plan assignment, session completion, and follow-up is time-consuming. RASQ organizes these workflows and surfaces **factual movement observations** for **clinician review** — it does not replace licensed clinical judgment.

---

## Current users

| User | Role in RASQ |
|------|----------------|
| **Clinician** | Assigns assessments and plans, supervises sessions, reviews patient-reported and CV-supported observations, documents clinical decisions |
| **Patient** | Completes assigned remote assessments and rehabilitation sessions through the patient portal |

---

## Current hackathon focus

Post-stroke upper-limb rehabilitation, including the **Upper-Limb Motor Screen** assessment domain (library engines on `dev_branch`) and related clinician/patient workflow foundations.

---

## Product journey

RASQ connects intake, assessment, plan assignment, supervised sessions, and progress review. Status labels for each stage (Implemented / Partial / Deferred) are documented in [Product Journey](./product-journey.md).

---

## Main product areas

Verified areas in this repository:

| Area | Description |
|------|-------------|
| **Clinician platform** | Dashboard, patient management, results queue, Assessment Center, plan assignment |
| **Patient portal** | Tokenized access to assigned rehabilitation sessions |
| **Post-stroke intake** | Clinician and patient intake flows under `app/post-stroke-intake/` |
| **Speech AI assistance** | Speech-related services under `app/lib/speech-ai/` |
| **Assessment workflows** | Remote assessment, general MSK forms, assessment report resolution |
| **Upper-Limb Motor Screen** | Clinician-assigned assessment tasks — library engines on `dev_branch` (not yet wired to UI) |
| **Interactive Rehabilitation** | Training sessions (e.g. interactive shoulder, Reach the Light) — separate from Motor Screen |
| **Computer Vision** | On-device pose tracking for optional camera assist during patient sessions; internal CV Lab for clinicians |
| **Reports and progress** | Assessment reports, motion analysis, Progress & Outcomes Hub |
| **Supabase-backed application services** | Migrations, auth integration, API persistence for production flows |

XR Rehabilitation and Communication Intelligence are strategic product domains documented in [Architecture](./architecture.md). They are not the current hackathon implementation focus.

---

## Role of AI and CV

| Layer | Role |
|-------|------|
| **AI** | Organizes workflow, drafts structured outputs for **clinician review** — assistive, non-diagnostic |
| **Clinicians** | Assign, supervise, decide, approve, and document all clinical actions |
| **Computer Vision** | Measures or observes movement; produces **factual movement observations** for therapist review |
| **CV does not** | Diagnose, classify severity, clear patients, or recommend treatment autonomously |

Measured values remain separate from AI interpretation. See [Decision Log](./decision-log.md).

---

## Product boundaries

Preserve these boundaries in all work:

- **Upper-Limb Motor Screen** = assessment
- **Interactive Upper-Limb Rehabilitation** = training
- Motor Screen **Forward Reach** (`taskId: forwardReach`) ≠ patient CV **`functional-reach`** exercise
- RASQ does **not** provide diagnosis
- No automatic clinical clearance, severity classification, FMA-UE scoring, or treatment recommendation
- Target completion does **not** confirm anatomical elbow extension
- All movement observations require **therapist review**

Details: [Upper-Limb Motor Screen](./upper-limb-motor-screen.md), [RASQ Current State](./RASQ_CURRENT_STATE.md).

---

## Current status

Detailed implementation tables, production snapshot, pilot readiness, and deferred items live in **[RASQ Current State](./RASQ_CURRENT_STATE.md)** — the single source of truth. This overview does not duplicate that table.

**Important:** Features merged to `dev_branch` (including Motor Screen engines) must not be described as fully deployed production functionality unless confirmed in Current State.

---

## What is next

Verified priorities from Current State and module documentation:

- Controlled STS pilot execution before gait capture or heel-raise promotion
- Upper-Limb Motor Screen UI, live-camera adapter, API persistence, and clinician review surface (after recorded-sequence validation)
- Gait live capture; Balance Assessment shell; Assessment Center forms
- Heel-raise CV hardening per existing plan
- Progress & Outcomes Hub validation with real session data

No timelines or contributor assignments are stated here. See [Team Ownership](./team-ownership.md) for current decision boundaries.
