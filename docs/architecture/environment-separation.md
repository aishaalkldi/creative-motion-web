# RASQ Environment Separation Report

## 1. Purpose

This report documents the current state of environment separation between RASQ Development and Production. It records verified architecture, intentional design decisions, isolation controls, practical test results, and remaining governance actions.

The goal is to provide a professional, auditable reference for engineers and stakeholders without exposing secrets, credentials, or full sensitive configuration values.

---

## 2. Current Environment Architecture

### Development

| Component | Detail |
|-----------|--------|
| Repository branch | `dev_branch` |
| Frontend URL | [https://dev.rasqhealth.com](https://dev.rasqhealth.com) |
| Frontend hosting | Vercel Preview deployment for `dev_branch` |
| Frontend auth / data | Supabase Staging |
| Backend URL | [https://api.dev.rasqhealth.com](https://api.dev.rasqhealth.com) |
| Backend hosting | Render |
| Backend database | Isolated Render PostgreSQL instance |

### Production

| Component | Detail |
|-----------|--------|
| Repository branch | `main` |
| Frontend URL | [https://rasqhealth.com](https://rasqhealth.com) |
| Production resources | Not modified during this separation work |

### Scope of this work

Development and Production were exercised and compared. Production resources were intentionally left unchanged. Assessment execution and result generation are **not enabled yet** and are outside the scope of completed verification described in this report.

---

## 3. Intentional Architecture Decision

RASQ Development is designed as a fully isolated stack:

- **Frontend:** Vercel Preview on `dev_branch`, bound to Supabase Staging.
- **Backend:** Dedicated FastAPI service on Render with its own PostgreSQL database.
- **Production:** Remains on `main` with its existing frontend deployment; no cross-environment writes or shared patient data were introduced during this work.

This separation allows safe iteration on Development features, backend schema, and provider workflows without risking Production data or user experience.

Destructive automatic database initialization was removed from FastAPI startup. Backend readiness checks now **fail safely** rather than modifying incompatible or unintended databases.

---

## 4. Verified Separation Controls

The following controls were verified or confirmed as part of this work:

| Control | Status |
|---------|--------|
| Separate repository branches (`dev_branch` vs `main`) | Verified |
| Separate frontend URLs | Verified |
| Development frontend on Vercel Preview | Verified |
| Development backend on Render with isolated PostgreSQL | Verified |
| Supabase Staging used for Development auth/data | Verified |
| Production resources unmodified during work | Verified |
| Destructive DB init removed from FastAPI startup | Verified |
| Readiness checks fail safely without DB mutation | Verified |
| Development provider login | Tested successfully |
| Development patient route | Tested successfully |
| Assignment creation in Development | Tested successfully |
| Backend health check in Development | Tested successfully |
| Database isolation between environments | Tested successfully |

**Not yet verified or enabled:**

- Assessment execution
- Assessment result generation

These capabilities should not be described as completed until explicitly enabled and tested.

---

## 5. Practical Isolation Test

Practical cross-environment checks confirmed that Development activity does not appear in Production:

1. **Patient isolation** — A patient created in Development was **not** visible in Production.
2. **Feature isolation** — The Development-only feature **Upper Limb Motor Screen** was **not** visible in Production.
3. **Staging identifier in Production sources** — The known Supabase Staging project identifier was **not** found in browser-visible Production JavaScript sources.

Together, these results support the conclusion that Development and Production are operationally separated at the application and data layers for the workflows tested.

---

## 6. Vercel Environment Variable Observation

During review of Vercel project settings:

- **`NEXT_PUBLIC_SUPABASE_URL`** — The Production entry is marked **Sensitive** and displayed with scope **Production and Preview**. Its exact stored value was **not** visually verified in the dashboard.
- **Branch-specific Preview value** — A Preview-scoped value exists for `dev_branch` and successfully supports Development authentication.

**Implication:** Development authentication is confirmed working via the branch-specific Preview configuration. The Production Supabase project reference should be confirmed through an authorized review that does not expose secrets in documentation or shared channels.

---

## 7. Current Conclusion

Available evidence indicates that Development and Production are separated by branch, hosting platform, backend service, database configuration, and observed application data for the workflows verified in this report. The exact Production Supabase project reference remains pending authorized verification.

**Operationally complete, with governance and documentation closeout remaining.**

Assessment execution and result generation remain future work and are not claimed as complete.

---

## 8. Remaining Professional Closeout Actions

The following governance and documentation items should be completed to close out this effort professionally:

- Verify the Production Supabase project reference through an authorized review without exposing secrets.
- Narrow Vercel environment variable scopes where appropriate (e.g., ensure Preview-only values are not unnecessarily shared with Production).
- Document whether a Production FastAPI backend exists, is planned, or is intentionally unused.
- Add branch protection to `dev_branch` and `main`.
- Require pull-request review before merges.
- Prevent force pushes and direct Production deployments.
- Add a repeatable environment smoke-test checklist for Development and Production.
- Maintain a secure environment matrix (URLs, branches, hosting targets, Supabase projects, backend services) **without** secrets.

---

## 9. Recommended Deployment Flow

```text
Feature work → dev_branch → Vercel Preview (dev.rasqhealth.com)
                          → Render Development API (api.dev.rasqhealth.com)
                          → Supabase Staging + isolated Render PostgreSQL

Approved release → Pull request → review → merge to main → Production frontend (rasqhealth.com)
```

**Guidelines:**

1. All Development changes land on `dev_branch` first and deploy via Vercel Preview.
2. Backend changes deploy to the Render Development service; never point Development at Production databases.
3. Merges to `main` require pull-request review and protected-branch rules.
4. Production deployments must not bypass CI, review, or branch protection.
5. Run the environment smoke-test checklist after significant infrastructure or configuration changes.

---

## 10. Security Rules

- **Never** commit, document, or share passwords, tokens, secret keys, database URLs, or full sensitive values.
- **Never** use Production Supabase or Production databases from Development deployments.
- **Never** re-enable destructive automatic database initialization on backend startup.
- **Never** force-push to `main` or `dev_branch`.
- **Never** deploy directly to Production without pull-request review.
- Treat all `NEXT_PUBLIC_*` variables as client-exposed; scope them deliberately in Vercel.
- Keep measured clinical values separate from AI interpretation in all environments (Clinical Safety).
- Restrict environment matrix and architecture documentation to authorized personnel; store secrets only in approved secret managers.

---

## 11. Evidence Summary

| Evidence | Result |
|----------|--------|
| Development frontend accessible at dev.rasqhealth.com | Confirmed |
| Development backend health check | Passed |
| Development provider login | Passed |
| Development patient route | Passed |
| Assignment creation in Development | Passed |
| Patient created in Development absent from Production | Confirmed |
| Upper Limb Motor Screen absent from Production | Confirmed |
| Staging Supabase identifier absent from Production JS sources | Confirmed |
| Production resources unchanged during work | Confirmed |
| Destructive DB init removed; readiness checks fail safely | Confirmed |
| Branch-specific Vercel Preview Supabase config supports Dev auth | Confirmed |
| Assessment execution / result generation | Not enabled; not verified |

---

*Report branch context: `dev_branch`. Production branch: `main`. Last updated as part of RASQ environment separation verification.*
