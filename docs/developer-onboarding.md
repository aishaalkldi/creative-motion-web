# Developer Onboarding

Practical path for contributors joining the RASQ frontend repository (`creative-motion-web`).

---

## Before access

- **GitHub repository access** from the project owner
- **Approved environment configuration** — Supabase URL, keys, and other variables through a private channel
- **No secrets** in issues, commits, pull requests, or documentation
- **No real patient data** in local tests — use demo patients and synthetic fixtures only

---

## Prerequisites

Confirmed from tracked repository files:

| Requirement | Source |
|-------------|--------|
| Node.js **≥ 20 and < 23** | `package.json` `engines` |
| npm (or compatible package manager) | Standard for this repo |
| Next.js **16.2.2** | `package.json` dependencies |
| React **19.2.4** | `package.json` dependencies |
| TypeScript **5** | `package.json` devDependencies |

The FastAPI backend is maintained in the separate **creative-motion-backend** repository. It is **not** included in a fresh clone of `creative-motion-web`. The existing `npm run api` script works only when that separate repository has been manually cloned into `backend/creative-motion-backend/`. Clone it only when your assigned task requires backend work.

---

## Clone and install

```bash
git clone https://github.com/aishaalkldi/creative-motion-web.git
cd creative-motion-web
npm install
```

Do not embed credentials in clone URLs or commit history.

---

## Local development

Verified scripts from `package.json`:

```bash
npm install      # Install dependencies
npm run dev      # Next.js development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

Optional:

```bash
npm run start    # Serve production build locally
npm run api      # FastAPI backend on 127.0.0.1:8000 — requires separate creative-motion-backend clone at backend/creative-motion-backend/
```

### Testing

This repository **does not** define an `npm test` script.

Some modules include tests executed directly, for example:

```bash
npx tsx --test app/lib/upper-limb-motor-screen/forward-reach-engine.test.ts
```

`tsx` is not currently declared as a project dependency. The first `npx tsx` invocation may download it, so **network access** and an **npm confirmation prompt** may be required. Use the exact module-specific test command documented for your task.

Use the **module-specific documentation** and existing `*.test.ts` files in the assigned scope as the source of truth for test commands. Motor Screen test counts and commands: [Upper-Limb Motor Screen](./upper-limb-motor-screen.md).

Run `npm run build` before opening a pull request when your change affects application code.

---

## Environment setup

| Document | Purpose |
|----------|---------|
| [Supabase Setup](./supabase-setup.md) | `.env.local`, migrations, health checks |
| [Development Authentication](./dev-auth-bypass.md) | Dev-only login bypass when backend auth is unavailable |

Rules:

- **Never commit** `.env`, `.env.local`, or secret values
- **Never print** secrets in logs, issues, or chat
- Request configuration through an **approved private channel**
- Development authentication tools are **not** production authentication — they are disabled in production builds

---

## Repository map

| Location | Contents |
|----------|----------|
| `app/clinician/`, `app/patient/` | Clinician and patient portal UI routes |
| `app/assessment/`, `app/post-stroke-intake/` | Assessment and intake flows |
| `app/api/` | Next.js API routes (clinician, patient, CV, plans, health) |
| `app/lib/cv/` | Computer Vision detectors and capture helpers |
| `app/lib/upper-limb-motor-screen/` | Motor Screen assessment engines (library) |
| `app/lib/interactive-shoulder/` | Interactive rehabilitation (training) |
| `app/lib/assessment-delivery/` | Shared clinic/remote delivery contract types |
| `app/lib/speech-ai/` | Speech AI integration |
| `app/lib/supabase/` | Supabase client helpers |
| `supabase/migrations/` | Database schema migrations (apply in order) |
| `docs/` | All product and engineering documentation |

The FastAPI backend is maintained in the separate **creative-motion-backend** repository. It is not included in a fresh clone of `creative-motion-web`. The existing `npm run api` script works only when that separate repository has been manually cloned into `backend/creative-motion-backend/`.

---

## Branch workflow

Read [Workflow](./workflow.md) in full.

Summary:

- **No direct work** on `main` or `dev_branch`
- **One branch per task** — e.g. `feature/…`, `docs/…`, `fix/…`
- **Clean working tree** before creating a branch
- **Focused pull requests** — only files required for the task
- Verify exact changed files before commit (`git diff --name-only`)
- Run relevant tests and `npm run build` before merge where applicable

---

## Clinical and data approval boundaries

Changes involving any of the following require approval from the **current decision owner** ([Team Ownership](./team-ownership.md)):

- Clinical wording or safety vocabulary
- Measured data logic or metric definitions
- Patient identity (Supabase UUID vs numeric demo paths)
- Authentication and session handling
- Database contracts and API payloads
- Supabase migrations
- Production services and deployment configuration

When in doubt, ask before editing.

---

## First-day checklist

- [ ] Read [README](../README.md)
- [ ] Read [Project Overview](./project-overview.md)
- [ ] Read [RASQ Current State](./RASQ_CURRENT_STATE.md)
- [ ] Read [Product Journey](./product-journey.md)
- [ ] Read [Workflow](./workflow.md)
- [ ] Read [Team Ownership](./team-ownership.md)
- [ ] Read module-specific documentation for your assigned scope
- [ ] Confirm your dedicated branch name and task scope
- [ ] Run `npm run dev` and open http://localhost:3000
- [ ] Run `npm run build` to confirm the tree compiles
- [ ] Verify task file allowlist before editing — do not modify unrelated files
