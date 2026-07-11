# RASQ Project Context

RASQ is an AI-assisted rehabilitation intelligence platform by Creative Motion Lab.

## Technology

Frontend repository:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Next.js API routes
- Vercel

Backend repository:
- FastAPI
- Python
- PostgreSQL / Supabase

## Product Domains

- Care Delivery
- Rehab Plans
- Movement Intelligence
- XR Rehabilitation
- Communication Intelligence
- Platform Foundation

Clinical Safety is a cross-cutting governance layer that applies to every domain.

## Current Product Areas

- Clinician portal
- Patient portal
- Rehabilitation assessments
- Computer vision movement capture
- Rehabilitation plans
- Motion analysis reports
- Progress and outcomes
- XR rehabilitation
- Speech AI
- Remote assessment workflows

## Current Assessments

- Sit-to-Stand
- Mini Squat
- Single-Leg Stance
- Functional Reach
- Timed Up and Go
- Gait observation

## Critical Constraints

- Preserve Supabase UUID patients.
- Preserve numeric demo patients.
- Do not duplicate measured metrics or business logic.
- Keep measured values separate from AI interpretation.
- Preserve Arabic and English behavior.
- Never expose or modify secrets.
- Prefer small reversible changes over broad refactors.
- Do not rewrite working flows without evidence.

## Claude Role

Act as the architecture reviewer, technical planner, and code-review advisor.

Before implementation:
1. Inspect only relevant files.
2. Explain the current data flow.
3. Identify risks.
4. Propose the smallest safe plan.

Do not edit application code unless explicitly asked.
