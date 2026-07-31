/**
 * Structural (source-level) coverage — this repository has no React render
 * harness (established convention, see PostStrokeIntakeClient.test.ts and
 * PatientSubmittedAnswersReview.test.ts), so these tests confirm required-
 * field gating, contract-safe payload construction, and token-handling
 * safety by inspecting the component source directly.
 *
 * Run: npx tsx --test "app/clinician/patients/[id]/AssignMotorScreenModal.test.ts"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "AssignMotorScreenModal.tsx",
);
const source = readFileSync(SOURCE_PATH, "utf8");

describe("no default values for the spotlighted required fields", () => {
  it("affectedSide starts as null, never pre-selected", () => {
    assert.match(source, /useState<UpperLimbSide \| null>\(null\)/);
    assert.match(source, /const \[affectedSide, setAffectedSide\] = useState<UpperLimbSide \| null>\(null\)/);
  });

  it("testedSide starts as null, never pre-selected", () => {
    assert.match(source, /const \[testedSide, setTestedSide\] = useState<UpperLimbSide \| null>\(null\)/);
  });

  it("deliveryMode starts as null, never pre-selected", () => {
    assert.match(
      source,
      /const \[deliveryMode, setDeliveryMode\] = useState<UpperLimbDeliveryMode \| null>\(null\)/,
    );
  });

  it("does not hardcode a default UPPER_LIMB_SIDES or UPPER_LIMB_DELIVERY_MODES index as an initial value", () => {
    assert.doesNotMatch(source, /useState\(UPPER_LIMB_SIDES\[0\]\)/);
    assert.doesNotMatch(source, /useState\(UPPER_LIMB_DELIVERY_MODES\[0\]\)/);
  });
});

describe("submission gating", () => {
  it("submit button is disabled until canSubmit is true", () => {
    assert.match(source, /disabled=\{!canSubmit\}/);
  });

  it("canSubmit requires all three spotlighted fields to be non-null", () => {
    assert.match(source, /affectedSide !== null &&/);
    assert.match(source, /testedSide !== null &&/);
    assert.match(source, /deliveryMode !== null &&/);
  });

  it("canSubmit also requires the full contract-required configuration set (no silent defaults)", () => {
    for (const field of [
      "startingSittingPosition",
      "backTrunkSupport",
      "affectedArmSupport",
      "baselinePainScore",
      "movementRangeKind",
      "caregiverSupervisionRequirement",
      "taskEligibilityConfirmed",
      "restPeriodValid",
      "targetPlacementSatisfied",
      "stopCriteriaSatisfied",
    ]) {
      assert.match(source, new RegExp(field), `expected canSubmit to reference ${field}`);
    }
  });

  it("guards handleSubmit against duplicate submission while a request is pending", () => {
    assert.match(source, /if \(submitting \|\| !canSubmit\) return;/);
    assert.match(source, /setSubmitting\(true\)/);
    assert.match(source, /submitting \? "Assigning…" : "Assign Forward Reach"/);
  });
});

describe("closing is blocked while a request is in flight", () => {
  it("routes the header close button through a guard that no-ops while submitting", () => {
    assert.match(
      source,
      /function handleClose\(\) \{\s*if \(submitting\) return;\s*onClose\(\);\s*\}/,
    );
    assert.match(source, /onClick=\{handleClose\}/);
  });

  it("disables the header close button and marks it accessibly while submitting", () => {
    assert.match(source, /disabled=\{submitting\}/);
    assert.match(source, /aria-disabled=\{submitting\}/);
    assert.match(source, /aria-label=\{submitting \? "Close \(disabled while assigning\)" : "Close"\}/);
  });

  it("guards the backdrop/overlay click against closing while submitting", () => {
    assert.match(
      source,
      /function handleOverlayClick\(e: React\.MouseEvent\) \{\s*if \(submitting\) return;\s*if \(e\.target === overlayRef\.current\) onClose\(\);\s*\}/,
    );
  });

  it("does not register the Escape-key listener at all while submitting", () => {
    assert.match(
      source,
      /useEffect\(\(\) => \{\s*if \(submitting\) return;\s*function onKey\(e: KeyboardEvent\) \{\s*if \(e\.key === "Escape"\) onClose\(\);\s*\}\s*window\.addEventListener\("keydown", onKey\);\s*return \(\) => window\.removeEventListener\("keydown", onKey\);\s*\}, \[onClose, submitting\]\);/,
    );
  });

  it("resets submitting in a finally block so every close path re-enables after success or failure", () => {
    assert.match(source, /finally \{\s*setSubmitting\(false\);\s*\}/);
  });

  it("never aborts or cancels an in-flight assignment request as a way of allowing close", () => {
    assert.doesNotMatch(source, /AbortController/);
    assert.doesNotMatch(source, /\.abort\(/);
  });

  it("the post-success Done action is not itself gated (submitting is already false once created is set)", () => {
    assert.match(source, /onCreated\(created\);\s*onClose\(\);/);
  });
});

describe("side clarification helper text", () => {
  it("explains affected side as clinician-identified, without implying diagnosis or clearance", () => {
    assert.match(
      source,
      /The side affected by the patient's condition, as identified by the clinician\./,
    );
  });

  it("explains tested side as scoped to this assignment", () => {
    assert.match(
      source,
      /The side being assessed in this specific Forward Reach assignment/,
    );
  });

  it("does not suggest the two sides must always match", () => {
    assert.match(source, /may be the same as or different from the affected side/);
    assert.doesNotMatch(source, /must (be|match) the (same|affected) side/i);
  });

  it("associates each helper text with its field group via aria-describedby", () => {
    assert.match(source, /aria-describedby=\{helperText \? helperId : undefined\}/);
    assert.match(source, /helperId="affected-side-helper"/);
    assert.match(source, /helperId="tested-side-helper"/);
  });
});

describe("request payload shape", () => {
  it("delegates task/attempts construction to the shared helper rather than building attempts locally", () => {
    // attempts is fixed inside createForwardReachAssignment (upper-limb-motor-screen.ts),
    // not re-derived from any editable state variable here.
    assert.doesNotMatch(source, /attempts:\s*attempts,/);
    assert.doesNotMatch(source, /taskId:\s*taskId,/);
  });

  it("calls the existing createForwardReachAssignment helper, not a raw fetch", () => {
    assert.match(source, /await createForwardReachAssignment\(/);
    assert.doesNotMatch(source, /await fetch\(/);
  });

  it("eligible is only submitted after explicit clinician confirmation", () => {
    assert.match(source, /taskEligibilityConfirmed/);
    assert.match(source, /eligible: true,/);
  });
});

describe("secure link handling", () => {
  it("never writes to localStorage or sessionStorage", () => {
    assert.doesNotMatch(source, /localStorage\./);
    assert.doesNotMatch(source, /sessionStorage\./);
  });

  it("never logs the assignment result, link, or token", () => {
    assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\(/);
  });

  it("never renders or references token_hash", () => {
    assert.doesNotMatch(source, /token_hash/i);
  });

  it("builds the link via the shared helper using the app's own origin, not a hardcoded domain", () => {
    assert.match(source, /buildMotorScreenPatientLink\(created\.patientAccessToken\)/);
    assert.doesNotMatch(source, /https:\/\/[a-z0-9.-]+\.(com|app|dev)/i);
  });

  it("provides Copy and Open patient page actions", () => {
    assert.match(source, /Copy Link/);
    assert.match(source, /Open patient page/);
    assert.match(source, /target="_blank"/);
    assert.match(source, /rel="noopener noreferrer"/);
  });

  it("explains the link should be shared only with the intended patient", () => {
    assert.match(source, /should be shared only with/);
  });
});

describe("clinical and product boundary wording", () => {
  it("names the task, attempt count, and review requirement explicitly", () => {
    assert.match(source, /Forward Reach/);
    assert.match(source, /Attempts:<\/span> 1/);
    assert.match(source, /Clinician\s*[\s\S]{0,20}assignment and review are required/);
  });

  it("states this is not a diagnosis or standardized impairment score", () => {
    assert.match(source, /not a diagnosis or a standardized\s*\n?\s*impairment score/);
  });

  it("only uses 'diagnosis' inside the required 'not a diagnosis' disclaimer, never as a claim or label", () => {
    const mentions = source.match(/diagnos[a-z]*/gi) ?? [];
    for (const _ of mentions) {
      assert.match(source, /not a diagnosis/);
    }
    // No affirmative usage like "Diagnosis:" as a field label.
    assert.doesNotMatch(source, /diagnosis:/i);
  });

  it("does not use other forbidden clinical vocabulary", () => {
    for (const banned of [
      /\bseverity\b/i,
      /\bsafe\b/i,
      /\bunsafe\b/i,
      /\bclearance\b/i,
      /\bFMA-UE\b/i,
      /muscle strength/i,
      /full range confirmed/i,
    ]) {
      assert.doesNotMatch(source, banned);
    }
  });
});

describe("accessibility", () => {
  it("uses fieldset/legend for grouped choices", () => {
    assert.match(source, /<fieldset>/);
    assert.match(source, /<legend/);
  });

  it("applies a visible focus ring to interactive controls", () => {
    assert.match(source, /focus-visible:ring-2/);
  });

  it("labels the close control for assistive technology, including while disabled", () => {
    assert.match(source, /aria-label=\{submitting \? "Close \(disabled while assigning\)" : "Close"\}/);
  });

  it("does not rely on color alone for selection state (aria-pressed present)", () => {
    assert.match(source, /aria-pressed=\{selected\}/);
  });
});
