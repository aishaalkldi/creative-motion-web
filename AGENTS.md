<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RASQ Agent Working Agreement

## Shared Rules

- GitHub is the source of truth.
- Never work directly on main.
- Every task uses a dedicated branch.
- Never push directly to main.
- Never edit environment files or expose secrets.
- Never modify unrelated files.
- Never merge automatically.
- Stop and ask before changing architecture, authentication, patient identity, measured-data logic, or clinical wording.

## Roles

### Claude
- Architecture review
- Risk analysis
- Technical planning
- Pull request review

### Cursor
- Approved implementation
- Focused refactoring
- Testing
- Documentation updates

### ASUS Worker
- Works only on agent/* branches
- Runs isolated tasks
- Runs tests and builds
- Pushes task branches only
- Never merges to main

### MSI Control
- Reviews pull requests
- Runs final validation
- Merges approved work

## Required Completion Report

Every task must report:
1. Branch name
2. Files changed
3. Tests run
4. Build result
5. Remaining risks
6. Manual checks required
