# RASQ Architecture Summary

## Product Domains

- Care Delivery
- Rehab Plans
- Movement Intelligence
- XR Rehabilitation
- Communication Intelligence
- Platform Foundation

## Governance

Clinical Safety is a cross-cutting governance layer for every product domain.

AI Governance is a future cross-cutting layer and is not fully operationalized yet.

## Repository Boundaries

creative-motion-web:
- Next.js frontend
- Next.js API routes
- Clinician and patient experiences

creative-motion-backend:
- FastAPI
- Python services
- PostgreSQL / Supabase integration

## Critical Boundaries

- Measured data and AI interpretation remain separate.
- Supabase UUID and numeric demo patient paths both remain supported.
- Arabic and English behavior remains consistent.
- Cross-repository changes must document contract impact.
