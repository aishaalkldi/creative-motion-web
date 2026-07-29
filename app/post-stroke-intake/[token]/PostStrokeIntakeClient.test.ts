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
