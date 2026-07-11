# RASQ Engineering Workflow

This document describes the official workflow for parallel development across multiple developers and AI workers.

## Workflow

```
Idea
  ↓
GitHub Issue
  ↓
Planning
  ↓
Worker Branch
  ↓
Pull Request
  ↓
Review
  ↓
Merge
  ↓
Release
```

## Stages

### 1. Idea

A product need, bug report, or improvement is identified. Capture enough context to decide whether it warrants tracked work.

### 2. GitHub Issue

Open an issue using the appropriate template:

- **Feature** — new capability or product change
- **Bug** — defect or unexpected behavior
- **Task** — discrete engineering or operational work

Every issue should define scope, acceptance criteria, and known risks before implementation begins.

### 3. Planning

Before coding:

1. Confirm the issue is scoped and approved.
2. Identify expected files and the smallest safe change plan.
3. Assign an owner and note dependencies.
4. Confirm clinical, architectural, and patient-identity constraints.

Planning may happen in the issue comments, a linked design note, or a short planning branch. Do not skip planning for non-trivial changes.

### 4. Worker Branch

Create a dedicated branch from `main` for each unit of work.

Branch naming examples:

- `feature/short-description`
- `fix/short-description`
- `task/short-description`
- `agent/short-description` (AI worker branches)

Rules:

- Never work directly on `main`.
- One issue per branch when possible.
- Keep branches focused and short-lived.
- AI workers use `agent/*` branches and push task branches only.

### 5. Pull Request

Open a pull request against `main` using the PR template.

Every PR must include:

- Summary of the change
- Linked issue
- Files changed
- Tests performed
- Build result
- Risks and remaining follow-up

### 6. Review

A reviewer (MSI Control or designated maintainer) checks:

- Scope matches the issue
- Build and tests pass
- No unrelated files changed
- Clinical wording is safe and non-diagnostic
- Documentation updated when behavior changes

Request changes when needed. Do not merge until review is complete.

### 7. Merge

Approved PRs are merged into `main`.

- Never push directly to `main`.
- Never merge automatically without review.
- Prefer squash merge for a clean history on feature work.

### 8. Release

After merge, validate the deployed or releasable state:

- Confirm production build succeeds
- Run smoke checks on affected flows
- Update product status or decision log when appropriate
- Close the linked issue

## Parallel Work Rules

To avoid conflicts when multiple developers and AI workers operate simultaneously:

1. **One branch per task** — do not share in-progress branches across workers.
2. **Issue-first** — no implementation without a tracked GitHub issue.
3. **Small PRs** — prefer focused changes that merge quickly.
4. **Rebase or update from main** — keep worker branches current before opening or updating a PR.
5. **Respect boundaries** — do not modify unrelated files, secrets, or patient-identity logic without explicit approval.
6. **Report completion** — every task reports branch name, files changed, tests run, build result, risks, and manual checks required.

## Roles

| Role | Responsibility |
|------|----------------|
| **Claude** | Architecture review, risk analysis, technical planning, PR review |
| **Cursor** | Approved implementation, focused refactoring, testing, documentation |
| **ASUS Worker** | Isolated `agent/*` branch tasks, tests, builds, push only |
| **MSI Control** | PR review, final validation, merge to `main` |

## Related Documents

- [AGENTS.md](../AGENTS.md) — agent working agreement
- [CLAUDE.md](../CLAUDE.md) — project context and constraints
- [architecture.md](./architecture.md) — system boundaries
- [decision-log.md](./decision-log.md) — permanent decisions
- [product-status.md](./product-status.md) — current product state
