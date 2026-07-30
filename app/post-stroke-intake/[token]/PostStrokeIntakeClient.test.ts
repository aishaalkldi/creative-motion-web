/**
 * Structural (source-level) coverage for the professor-approved UI/accessibility
 * refinements. This repository has no React render harness (established
 * convention — see PatientSubmittedAnswersReview.test.ts and
 * PtMedicalReportDraftPanel.test.ts), so these tests confirm the wiring is
 * present and correctly scoped by inspecting the component source directly.
 *
 * Run: npx tsx --test "app/post-stroke-intake/[token]/PostStrokeIntakeClient.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "PostStrokeIntakeClient.tsx",
);
const source = readFileSync(SOURCE_PATH, "utf8");

describe("contextual assistance-type visibility", () => {
  it("derives the visible assistance-type list from the shared pure helper, not a hardcoded list", () => {
    assert.match(source, /getVisibleAssistanceTypes\(respondentType\)/);
    assert.doesNotMatch(source, /const ASSISTANCE_TYPES\s*[:=]/);
  });

  it("only renders the assistance-type section when shouldShowAssistanceTypeSection allows it", () => {
    assert.match(source, /shouldShowAssistanceTypeSection\(respondentType\)/);
    assert.match(source, /\{showAssistanceSection \? \(/);
  });

  it("clears an invalid assistance type when the respondent type changes", () => {
    assert.match(
      source,
      /setAssistanceType\(\(prev\) => \(isAssistanceTypeValidForRespondent\(prev, type\) \? prev : undefined\)\)/,
    );
  });
});

describe("respondent-source clarification", () => {
  it("looks up RESPONDENT_SOURCE_CLARIFICATION for the selected respondent type", () => {
    assert.match(source, /RESPONDENT_SOURCE_CLARIFICATION\[respondentType\]/);
  });
});

describe("urgent-gate no-symptom option separation", () => {
  it("renders the real urgent symptoms separately from the exclusive none-of-the-above option", () => {
    assert.match(source, /REAL_URGENT_SYMPTOMS\.map/);
    assert.match(source, /NO_NEW_URGENT_SYMPTOMS[\s\S]{0,400}onClick=\{\(\) => toggleSymptom\(NO_NEW_URGENT_SYMPTOMS\)\}/);
  });

  it("uses a visual divider between the two groups, not color alone", () => {
    assert.match(source, /bg-white\/10.*aria-hidden|aria-hidden[\s\S]{0,80}bg-white\/10/);
  });
});

describe("selection indicator is not color-only", () => {
  it("renders a checkmark icon whose visibility is driven by the selected state, in addition to color", () => {
    assert.match(source, /function CheckIcon/);
    assert.match(source, /<CheckIcon \/>/);
    assert.match(source, /selected \? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white\/25 bg-transparent text-transparent"/);
  });
});

describe("keyboard focus visibility", () => {
  it("applies a shared focus-visible ring to interactive controls", () => {
    assert.match(source, /const FOCUS_RING =/);
    assert.match(source, /focus-visible:ring-2/);
    // Applied to the option cards and the primary action buttons.
    const focusRingUsages = source.match(/\$\{FOCUS_RING\}/g) ?? [];
    assert.ok(focusRingUsages.length >= 5, "expected FOCUS_RING applied to multiple controls");
  });
});

describe("RTL layout preserved", () => {
  it("sets dir on the page root from the selected language", () => {
    assert.match(source, /dir=\{formDir\}/);
  });

  it("uses logical text-start alignment on option cards instead of a fixed left/right", () => {
    assert.match(source, /text-start/);
    assert.doesNotMatch(source, /text-left/);
  });
});

describe("stopped state remains terminal", () => {
  it("never calls setStage anywhere inside the stopped-stage render block", () => {
    const stoppedBlockMatch = source.match(/\{stage === "stopped" && \(([\s\S]*?)\)\}\s*\n\s*\{stage === "cleared_placeholder"/);
    assert.ok(stoppedBlockMatch, "expected to locate the stopped-stage render block");
    assert.doesNotMatch(stoppedBlockMatch![1], /setStage/);
  });

  it("the local acknowledgement button only sets local acknowledgement state, never submission or stage state", () => {
    const ackButtonMatch = source.match(/onClick=\{\(\) => setHelpAcknowledged\(true\)\}/);
    assert.ok(ackButtonMatch, "expected the acknowledgement button to only call setHelpAcknowledged");
  });

  it("keeps the explicit retry action gated behind a server persistence failure", () => {
    assert.match(source, /\{submitError \? \(/);
  });
});

describe("Stage 3 — resume hydration", () => {
  it("fetches the token GET route directly and reads draft data, rather than the legacy general-MSK helper", () => {
    assert.match(source, /fetch\(`\/api\/remote-assessments\/\$\{encodeURIComponent\(token\)\}`\)/);
    assert.doesNotMatch(source, /getRemoteAssessment\(/);
  });

  it("only hydrates Stage 3 state when the resumed urgent gate is cleared (stopped === false)", () => {
    assert.match(source, /draft\.urgentGate\.stopped !== false/);
  });

  it("computes the resume screen from the shared pure helper, not ad hoc logic", () => {
    assert.match(source, /firstIncompleteFunctionalIntakeScreen\(resumedFunctionalIntake\)/);
  });

  it("never reads an assessmentId field off the resume draft or any request/response payload", () => {
    assert.doesNotMatch(source, /draft\??\.assessmentId/);
    assert.doesNotMatch(source, /\bassessmentId\s*[,:]/);
  });
});

describe("Stage 3 — three-screen flow exists", () => {
  it("defines all three functional-intake screens plus the post-submit confirmation as stages", () => {
    assert.match(source, /"functional_screen_1"/);
    assert.match(source, /"functional_screen_2"/);
    assert.match(source, /"functional_screen_3"/);
    assert.match(source, /"functional_submitted"/);
  });

  it("screen 1 covers mobility and assistance fields", () => {
    const block = source.match(/\{stage === "functional_screen_1" && \(([\s\S]*?)\{stage === "functional_screen_2"/);
    assert.ok(block, "expected to locate the functional_screen_1 render block");
    for (const field of [
      "moreAffectedSide",
      "sittingAbility",
      "standingAbility",
      "walkingAbility",
      "assistiveDevice",
      "recentFalls",
    ]) {
      assert.match(block![1], new RegExp(field), `expected screen 1 to reference ${field}`);
    }
  });

  it("screen 2 covers upper-limb use and communication support, with a conditional other-text input", () => {
    const block = source.match(/\{stage === "functional_screen_2" && \(([\s\S]*?)\{stage === "functional_screen_3"/);
    assert.ok(block, "expected to locate the functional_screen_2 render block");
    assert.match(block![1], /upperLimbUse/);
    assert.match(block![1], /communicationSupport/);
    assert.match(block![1], /communicationSupportOtherText/);
  });

  it("screen 3 covers the functional goal, a compact review, and the exact final-submit button text", () => {
    const block = source.match(/\{stage === "functional_screen_3" && \(([\s\S]*?)\{stage === "functional_submitted"/);
    assert.ok(block, "expected to locate the functional_screen_3 render block");
    assert.match(block![1], /functionalGoal/);
    assert.match(block![1], /REVIEW_STEP_TITLE/);
    assert.match(block![1], /SUBMIT_FUNCTIONAL_INTAKE_LABEL/);
  });

  it("each of screens 1 and 2 saves the draft before continuing", () => {
    assert.match(source, /handleFunctionalScreen1Continue/);
    assert.match(source, /handleFunctionalScreen2Continue/);
    assert.match(source, /saveFunctionalDraft/);
  });

  it("final submission uses an explicit action and is never inferred from field completeness alone", () => {
    assert.match(source, /action:\s*"complete_post_stroke_intake"/);
    assert.match(source, /isFunctionalIntakeComplete\(functionalIntake\)/);
  });

  it("uses a one-shot ref guard for the final submission, matching the existing urgent-stop/draft-save pattern", () => {
    assert.match(source, /finalSubmitSubmittedRef/);
  });
});

describe("Stage 3 — non-verdict framing throughout", () => {
  it("renders the patient/caregiver-reported and clinician-review-required notices", () => {
    assert.match(source, /FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE/);
    assert.match(source, /FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE/);
  });

  it("renders the exact approved post-submit notice", () => {
    assert.match(source, /FUNCTIONAL_INTAKE_SUBMITTED_NOTICE/);
  });

  it("never hardcodes a forbidden clinical-verdict word directly in the component source", () => {
    assert.doesNotMatch(source, /\bcleared for exercise\b|\bready for exercise\b|clinically completed/i);
  });
});

describe("Stage 3 — conditional other-text fields", () => {
  it("clears the paired other-text when the device/support selection moves away from 'other'", () => {
    assert.match(source, /assistiveDeviceOtherText: undefined/);
    assert.match(source, /communicationSupportOtherText: undefined/);
  });

  it("renders the other-text input only when the paired value is 'other'", () => {
    assert.match(source, /functionalIntake\.assistiveDevice === "other" \? \(/);
    assert.match(source, /functionalIntake\.communicationSupport === "other" \? \(/);
  });
});
