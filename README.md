# RASQ

RASQ is an AI-assisted rehabilitation platform by Creative Motion Lab. The current hackathon scope focuses on **post-stroke upper-limb rehabilitation**.

Clinicians assign, supervise, and review patient work. AI assists with organization and structured outputs. Computer Vision provides **factual movement observations**. **Clinicians remain responsible for all clinical decisions.**

---

## Product boundaries

- **Upper-Limb Motor Screen** = assessment (clinician-assigned, CV-supported, clinician-reviewed)
- **Interactive Upper-Limb Rehabilitation** = training (separate domain)
- RASQ does **not** provide diagnosis
- No automatic clinical clearance
- No automatic severity classification
- No automatic FMA-UE scoring
- No automatic treatment recommendation
- Target completion does **not** confirm anatomical elbow extension

See [docs/upper-limb-motor-screen.md](./docs/upper-limb-motor-screen.md) and [docs/RASQ_CURRENT_STATE.md](./docs/RASQ_CURRENT_STATE.md) for verified boundaries.

---

## Current development status

Summary from [docs/RASQ_CURRENT_STATE.md](./docs/RASQ_CURRENT_STATE.md). **Development-branch features must not be interpreted as fully deployed production functionality.**

### Implemented foundations

- Core clinician and patient portal workflow (assessment → plan → session → review)
- Assessment Center with Sit-to-Stand review; optional patient CV (STS most mature)
- Progress & Outcomes Hub (read-only clinician aggregation)
- Upper-Limb Motor Screen **library engines** on `dev_branch` (PRs #191–#194) with synthetic tests
- Assessment delivery contract types; Supabase-backed application services

### Partially integrated areas

- Assessment Center (Gait shell; Balance and forms coming next)
- Patient CV beyond STS (wired exercises with varying maturity)
- Clinician AI draft summary (review only, not persisted to patient)
- Remote assessment and post-stroke intake flows

### Deferred work

- Upper-Limb Motor Screen clinician UI, patient UI, API persistence, Session Orchestrator integration, and live-camera validation
- Gait live capture; Balance Assessment shell; Functional Movement and Patient-Reported Forms
- Motor Screen Assessment Center review surface

Full status tables and pilot readiness: [docs/RASQ_CURRENT_STATE.md](./docs/RASQ_CURRENT_STATE.md).

---

## Repository structure

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router — clinician portal, patient portal, assessment flows, UI components |
| `app/api/` | Next.js API routes — clinician, patient, assessments, CV metrics, plans, health |
| `app/lib/` | Domain libraries — CV detectors, Motor Screen engines, assessment delivery, speech AI, Supabase helpers |
| `docs/` | Product, architecture, pilot, compliance, and module documentation |
| `supabase/` | Database migrations and Supabase project configuration |
| `public/` | Static assets (exercise media, icons) |

Backend services live in a separate **creative-motion-backend** repository (FastAPI). This repository is the Next.js frontend and API surface.

---

## Getting started

### Prerequisites

- Node.js **≥ 20 and < 23** (see `package.json` `engines`)
- npm (or compatible package manager)

### Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

Development server: [http://localhost:3000](http://localhost:3000)

This repository does **not** define an `npm test` script. Module-specific tests are run with direct commands such as `npx tsx --test <test-file>`. See [docs/developer-onboarding.md](./docs/developer-onboarding.md) and the relevant module documentation for verified test commands.

Optional local API (not required for most Next.js-only work):

The FastAPI backend is maintained in the separate **creative-motion-backend** repository. It is **not** included when cloning `creative-motion-web`. The `npm run api` script works only when that separate repository has been cloned manually into `backend/creative-motion-backend/`; the command **will fail** if that path is absent. Most contributors working only on the Next.js application do not need this command.

```bash
npm run api
```

### Environment configuration

Environment variables are required for Supabase, optional AI translation, and other services. Obtain configuration through an **approved project channel**. **Never commit** `.env` files or secrets. See [docs/supabase-setup.md](./docs/supabase-setup.md) and [docs/dev-auth-bypass.md](./docs/dev-auth-bypass.md).

---

## Start here

Read in this order:

1. [docs/project-overview.md](./docs/project-overview.md) — product purpose and main areas
2. [docs/RASQ_CURRENT_STATE.md](./docs/RASQ_CURRENT_STATE.md) — verified implementation status
3. [docs/product-journey.md](./docs/product-journey.md) — end-to-end clinician and patient flows
4. [docs/developer-onboarding.md](./docs/developer-onboarding.md) — setup and first-day checklist
5. [docs/README.md](./docs/README.md) — full documentation index
6. [docs/team-ownership.md](./docs/team-ownership.md) — decision and implementation boundaries
7. [docs/workflow.md](./docs/workflow.md) — branch and pull request workflow
8. [docs/upper-limb-motor-screen.md](./docs/upper-limb-motor-screen.md) — Motor Screen architecture and clinical boundaries

---

## Contribution note

- Do **not** work directly on `main` or `dev_branch`
- Use a **dedicated branch** and **pull request** for every task
- Read [docs/workflow.md](./docs/workflow.md) before starting
- Changes involving **clinical wording**, **measured data**, **patient identity**, **authentication**, **database contracts**, or **production services** require approval from the current decision owner
