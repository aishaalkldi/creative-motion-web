# Team Ownership

**Status:** Current repository ownership — subject to change
**Last updated:** 2026-07-31

This file records **current decision, approval, and implementation boundaries** for the RASQ repository. It does **not** represent permanent employment or permanent team membership. **Git history and merged pull requests** remain the source of contribution attribution.

---

## Ownership table

| Area | Decision owner | Current implementation owner |
|------|----------------|------------------------------|
| Product direction and scope | Aisha Almalki | Aisha Almalki |
| Clinical direction and terminology | Aisha Almalki | Aisha Almalki |
| Project priorities and final integration | Aisha Almalki | Aisha Almalki |
| Upper-Limb Motor Screen | Aisha Almalki | Aisha Almalki |
| Interactive Rehabilitation | Aisha Almalki | Currently unassigned |
| Computer Vision development | Aisha Almalki | Currently unassigned |
| Web and UI development | Aisha Almalki | Currently unassigned |
| Architecture and technical decisions | Aisha Almalki | Aisha Almalki |
| GitHub releases and production approval | Aisha Almalki | Aisha Almalki |
| Supabase, authentication, and data contracts | Aisha Almalki | Aisha Almalki |

**“Currently unassigned”** means no forward-looking implementation maintainer is presently assigned to that area. It does **not** mean the repository has no historical code in that domain. Historical authorship and contributions remain recorded through Git commits and merged pull requests.

---

## Contributor assignment

Contributor assignment is tracked in the **task board**.

A contributor may be recorded as implementation owner for an area **after**:

1. Scope is approved
2. Work begins on a dedicated branch
3. A reviewed pull request is submitted
4. The contribution is merged

An assignment without reviewed merged work is **not** repository ownership.

---

## Working rules

- Use **dedicated task branches** — never work directly on `main` or `dev_branch`
- Do **not** modify another contributor's active scope without coordination
- Keep pull requests **focused** — one task, minimal file surface
- **Approval required** for clinical wording, measured data, patient identity, authentication, database contracts, and production changes
- Ownership may change with availability and project priorities — update this file when boundaries change

---

## Attribution

Individual contribution history is recorded in **commits** and **merged pull requests**. This table does not replace per-change authorship in Git.

For engineering process roles (Claude, Cursor, ASUS Worker, MSI Control), see [AGENTS.md](../AGENTS.md) and [Workflow](./workflow.md).

---

## Related documents

- [Developer Onboarding](./developer-onboarding.md) — approval boundaries for contributors
- [Workflow](./workflow.md) — branch and review process
- [Decision Log](./decision-log.md) — permanent product decisions
