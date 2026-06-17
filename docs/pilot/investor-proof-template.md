# RASQ Investor Proof — 1-Page Template

**Purpose:** Turn one controlled clinic pilot session into a concise evidence narrative for investors, advisors, or grant reviewers.

**When to use:** After completing `pilot-evidence-log.md` and clinician feedback for a session.

**Length:** One page. Replace bracketed placeholders. Remove instructions before sharing externally.

**Privacy:** No patient PHI. Use synthetic names or role labels only.

---

## RASQ Pilot Evidence — [Date] · [Clinic / Site]

---

### Problem observed

_What clinical or operational pain did the clinic describe before RASQ?_

> [e.g. Remote patients complete exercises at home but clinicians lack structured visibility into pain response between visits.]

---

### Workflow validated

_Which end-to-end path was demonstrated live?_

- [ ] Clinician creates patient
- [ ] Remote assessment sent and submitted
- [ ] Assessment reviewed (not auto-diagnosis)
- [ ] Structured plan assigned
- [ ] Patient portal opened
- [ ] Session completed with effort/pain
- [ ] Review queue / timeline surfaced actionable item
- [ ] Clinician acknowledged review
- [ ] AI draft summary generated (clinician-only; optional for PILOT-ACTIVATION-0)
- [ ] Patient portal confirmed no AI surface

**One-sentence summary:**

> [e.g. A licensed PT sent an assessment link, assigned a knee rehab plan, and reviewed a pain-increase flag within one clinic session.]

---

### Metrics collected

_Manual counts from pilot — not product analytics._

| Metric | Value |
|--------|-------|
| Patients in session | |
| Assessment completion | / sent |
| Plans assigned | |
| Sessions completed | |
| Review flags raised | |
| Review flags resolved | |
| Clinician usefulness (1–5) | |
| AI draft summary usefulness (1–5) | |
| Clinician trust in AI draft (Y/Maybe/N) | |
| Unsafe wording incidents | |
| Generate success rate | |
| CV save success (if STS used) | |
| Sit-to-Stand rep count usefulness (1–5) | |
| Patient portal clarity (1–5) | |
| Recommend to colleague (0–10) | |

---

### Clinician quote

> "[Verbatim or approved paraphrase — e.g. 'The review queue showed a pain increase I would have missed until the next visit.']"
>
> — [Role], [Clinic]

---

### Patient quote

> "[e.g. 'I understood the exercises and knew when to stop.']"
>
> — Patient feedback (anonymous)

---

### Proof moment

_One concrete moment that shows RASQ delivering value._

**What happened:**

> [e.g. After session 3, RASQ flagged consecutive pain increase. Clinician opened patient profile, saw Rehabilitation Journey timeline, and marked review complete — all in under 2 minutes.]

**Evidence:** [Screenshot filename or session reference — no PHI in shared version]

---

### What changed after feedback

_Actions taken from this pilot session — product, process, or messaging._

| Change | Status |
|--------|--------|
| [e.g. Clarified patient portal link instructions in clinic handout] | Done / Planned |
| [e.g. Added Arabic label for effort score] | Done / Planned |
| [e.g. Scheduled second demo with 3 real patients] | Done / Planned |

---

### Next pilot goal

_One measurable goal for the next session._

> [e.g. Run 3 live patients through assessment → plan → 2 sessions each; target ≥ 2/3 assessment completion and clinician usefulness ≥ 4/5.]

---

## Internal checklist before sharing

| Check | Done |
|-------|------|
| No PHI in quotes or screenshots | ☐ |
| Clinician approved use of quote | ☐ |
| Metrics match `pilot-metrics-manual-tracker.md` | ☐ |
| Claims match actual product (no patient-facing AI; clinician-only AI draft summary for review only — not clinical decision support; no voice in supported workflow; Assessment Center STS review + Gait shell; optional experimental CV if mentioned — sit-to-stand primary; supine exercises manual-only) | ☐ |
| Intended-use framing: clinician-led, not autonomous diagnosis | ☐ |
