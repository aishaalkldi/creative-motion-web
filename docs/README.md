# RASQ Documentation

This index lists verified documentation in this repository. For implementation status, [RASQ Current State](./RASQ_CURRENT_STATE.md) is the source of truth.

---

## Start here

| Document | Purpose |
|----------|---------|
| [Project Overview](./project-overview.md) | Product purpose, users, main areas, boundaries |
| [Current State](./RASQ_CURRENT_STATE.md) | Verified implementation, pilot, and deferred status |
| [Product Journey](./product-journey.md) | End-to-end clinician and patient flows with integration labels |
| [Developer Onboarding](./developer-onboarding.md) | Clone, setup, commands, first-day checklist |
| [Team Ownership](./team-ownership.md) | Decision and implementation boundaries |

---

## Product and clinical boundaries

| Document | Purpose |
|----------|---------|
| [Upper-Limb Motor Screen](./upper-limb-motor-screen.md) | Assessment domain — tasks, engines, clinical boundaries |
| [Assessment Delivery Architecture](./assessment-delivery-architecture.md) | Clinic and remote delivery contract |
| [Decision Log](./decision-log.md) | Permanent product and engineering decisions |
| [Current State](./RASQ_CURRENT_STATE.md) | Platform snapshot and pilot readiness |

---

## Architecture and engineering

| Document | Purpose |
|----------|---------|
| [Architecture](./architecture.md) | Product domains and repository boundaries |
| [Workflow](./workflow.md) | Issue → branch → PR → review → merge |
| [Supabase Setup](./supabase-setup.md) | Database, migrations, environment guidance |
| [Development Authentication](./dev-auth-bypass.md) | Dev-only auth bypass (not production auth) |
| [Project Log](./project-log.md) | Historical merge and milestone log |

---

## Specialized documentation

### Assessments

| Document | Purpose |
|----------|---------|
| [Gait Assessment v1 Capture Audit](./assessments/GAIT_ASSESSMENT_V1_CAPTURE_AUDIT.md) | Gait capture scope and sequencing |

### Computer Vision

| Document | Purpose |
|----------|---------|
| [CV Exercise Allowlist Plan](./cv/CV_EXERCISE_ALLOWLIST_PLAN.md) | Post-STS exercise expansion sequence |
| [Heel Raise CV Hardening Plan](./cv/HEEL_RAISE_CV_HARDENING_PLAN.md) | Heel-raise gap analysis and slices |
| [Shoulder Abduction Reach Detector](./shoulder-abduction-reach-detector.md) | Interactive shoulder rehabilitation CV |

Additional CV design specs live under [cv-roadmap/](./cv-roadmap/).

### Compliance

| Document | Purpose |
|----------|---------|
| [PDPL Foundation](./compliance/PDPL_FOUNDATION.md) | Privacy-by-design data inventory |
| [Data Flow Map](./compliance/DATA_FLOW_MAP.md) | Stored vs not stored across CV path |
| [Pilot Privacy Checklist](./compliance/PILOT_PRIVACY_CHECKLIST.md) | Pre-pilot privacy verification |

### Pilot

| Document | Purpose |
|----------|---------|
| [Pilot Workflow](./pilot/pilot-workflow.md) | End-to-end controlled pilot flow |
| [Clinician Onboarding Guide](./pilot/clinician-onboarding-guide.md) | First-time clinician steps |
| [Pilot Checklist](./pilot/pilot-checklist.md) | Before / during / after demo |
| [Known Limitations](./pilot/known-limitations.md) | Share with clinicians before pilot |
| [Controlled STS Pilot Plan](./pilot/CONTROLLED_STS_PILOT_PLAN.md) | First STS clinic pilot protocol |

### Upper-Limb Motor Screen

| Document | Purpose |
|----------|---------|
| [Upper-Limb Motor Screen](./upper-limb-motor-screen.md) | Architecture, tasks, validation, deferred integration |

---

## Audience guide

| Audience | Start with | Then read |
|----------|------------|-----------|
| **New contributors** | [Project Overview](./project-overview.md), [Developer Onboarding](./developer-onboarding.md), [Workflow](./workflow.md) | [Current State](./RASQ_CURRENT_STATE.md), module docs for assigned scope |
| **Product and clinical reviewers** | [Project Overview](./project-overview.md), [Product Journey](./product-journey.md) | [Current State](./RASQ_CURRENT_STATE.md), [Upper-Limb Motor Screen](./upper-limb-motor-screen.md), [Decision Log](./decision-log.md) |
| **CV developers** | [Current State](./RASQ_CURRENT_STATE.md) (Patient CV section) | [CV Exercise Allowlist Plan](./cv/CV_EXERCISE_ALLOWLIST_PLAN.md), [Upper-Limb Motor Screen](./upper-limb-motor-screen.md), relevant `app/lib/cv/` and test files |
| **Web developers** | [Developer Onboarding](./developer-onboarding.md), [Architecture](./architecture.md) | [Workflow](./workflow.md), [Assessment Delivery Architecture](./assessment-delivery-architecture.md), routes under `app/` |
| **Pilot and QA users** | [Pilot Workflow](./pilot/pilot-workflow.md), [Clinician Onboarding Guide](./pilot/clinician-onboarding-guide.md) | [Known Limitations](./pilot/known-limitations.md), [Pilot Checklist](./pilot/pilot-checklist.md), [Current State](./RASQ_CURRENT_STATE.md) |
