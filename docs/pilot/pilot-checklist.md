# RASQ Clinic Pilot — Checklist

Use this checklist before, during, and after a controlled clinic pilot demo.

---

## Before clinic demo

### Environment

- [ ] Production URL confirmed: https://creative-motion-web.vercel.app
- [ ] Clinician login tested (provider account active)
- [ ] Second device/browser ready for patient flows (assessment + portal)
- [ ] Stable network; backup hotspot if clinic Wi‑Fi is unreliable
- [ ] Demo patient names are synthetic (no real PHI unless policy allows)

### Content prep

- [ ] Chosen scenario(s): knee / lumbar / shoulder (see `demo-scenarios.md`)
- [ ] Pilot script printed or open (`clinic-pilot-script.md`)
- [ ] Success metrics form ready (`success-metrics.md`)
- [ ] Known limitations reviewed (`known-limitations.md`)

### Clinical & legal framing

- [ ] Team aligned: RASQ **does not diagnose** or **prescribe autonomously**
- [ ] **No AI / CV / voice** features active in this pilot — state explicitly
- [ ] Legal pages reviewed at high level; counsel review planned before paid contracts
- [ ] Informed consent / clinic policy for demo patients confirmed

### Data hygiene

- [ ] No real patient data in screen shares unless authorized
- [ ] Assessment and portal links treated as sensitive (do not post publicly)
- [ ] Plan to delete or archive demo patients after pilot if required by clinic

---

## During demo

### Opening (5 min)

- [ ] State intended use: clinician-led rehab workflow support
- [ ] Point to `/intended-use` and `/clinical-safety` if questions arise
- [ ] Confirm audience: licensed clinicians / coordinators only

### Live walkthrough

- [ ] Login → create patient → send remote assessment
- [ ] Patient device: complete and submit assessment
- [ ] Clinician: review assessment report (not as auto-diagnosis)
- [ ] Assign plan from pilot template
- [ ] Patient device: open portal → complete session → submit effort/pain
- [ ] Clinician: Results / review queue / progress

### Safety reminders (say aloud)

- [ ] Patient should **stop** if sharp pain, dizziness, chest pain, or neurological symptoms
- [ ] Remote assessment and portal **do not replace** in-person evaluation when indicated
- [ ] All clinical decisions remain with the **licensed clinician**
- [ ] Emergency: patient directed to local emergency services / clinic protocol

### Privacy reminders (say aloud)

- [ ] Patient links are token-based; do not share links in open channels
- [ ] Clinician workspace requires authentication; patient flows use expiring tokens
- [ ] Demo data should match clinic privacy policy for test patients
- [ ] Privacy policy at `/privacy` is pilot-ready — full legal review before commercial contracts

### Known limitations to mention

- [ ] No autonomous diagnosis or prescription
- [ ] No AI, computer vision, or voice input in current pilot build
- [ ] Clinician review required for flagged items
- [ ] Rate limits are in-memory (may reset on deploy)
- [ ] Legal pages not final counsel-reviewed

### Capture feedback

- [ ] Note confusion points in workflow
- [ ] Note language / UX issues (Arabic vs English)
- [ ] Record time to complete each step
- [ ] Ask: “Would you use this in clinic next week?” (Y/N + why)

---

## After demo

### Immediate

- [ ] Thank participants; share follow-up contact
- [ ] Secure or revoke demo links if clinic policy requires
- [ ] Export notes into success metrics worksheet

### Within 48 hours

- [ ] Complete success metrics scoring (`success-metrics.md`)
- [ ] Log bugs or UX issues (severity + steps to reproduce)
- [ ] Decide: proceed / iterate / pause pilot

### Reporting

- [ ] Summarize: completion rates, clinician satisfaction, patient clarity
- [ ] List top 3 improvements (documentation vs product — Sprint E is docs-only)
- [ ] Escalate any safety or privacy concerns to product lead

---

## Quick “go / no-go” for next pilot session

| Check | Go |
|-------|-----|
| Assessment link submitted successfully | ☐ |
| Plan assigned and portal opened | ☐ |
| Session completed with effort/pain | ☐ |
| Clinician understood review queue purpose | ☐ |
| No critical blocker (login, save, link broken) | ☐ |

If any critical blocker: fix before next clinic session; do not expand pilot scope.
