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
    assert.match(source, /saveIntakeDraft/);
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

describe("Stage 4 — functional goal voice input", () => {
  it("renders VoiceFieldControls beside the functional goal textarea, wired to the same field", () => {
    const goalBlock = source.match(/\{patientText\(FUNCTIONAL_GOAL_STEP_TITLE, lang\)\}[\s\S]{0,1400}/);
    assert.ok(goalBlock, "expected to locate the functional goal block");
    assert.match(goalBlock![0], /<VoiceFieldControls/);
    assert.match(goalBlock![0], /updateFunctionalIntake\(\{ functionalGoal: text \}\)/);
  });

  it("imports VoiceFieldControls from the existing patient-facing component, not a new one", () => {
    assert.match(source, /import \{ VoiceFieldControls \} from "@\/app\/components\/patient\/VoiceFieldControls"/);
  });
});

describe("Stage 4 — open-ended subjective narrative screens", () => {
  it("defines both narrative screens as stages", () => {
    assert.match(source, /"subjective_screen_a"/);
    assert.match(source, /"subjective_screen_b"/);
  });

  it("screen A covers exactly the three required screen-A questions, each with text and voice input", () => {
    const block = source.match(/\{stage === "subjective_screen_a" && \(([\s\S]*?)\{stage === "subjective_screen_b"/);
    assert.ok(block, "expected to locate the subjective_screen_a render block");
    assert.match(block![1], /SUBJECTIVE_NARRATIVE_SCREEN_A_QUESTION_IDS\.map/);
    assert.match(block![1], /<TextAreaField/);
    assert.match(block![1], /<VoiceFieldControls/);
    assert.match(block![1], /handleSubjectiveTextChange/);
    assert.match(block![1], /handleSubjectiveTranscript/);
  });

  it("screen B covers the remaining questions, marks additionalInformation optional, and hosts the final review", () => {
    const block = source.match(/\{stage === "subjective_screen_b" && \(([\s\S]*?)\{stage === "functional_submitted"/);
    assert.ok(block, "expected to locate the subjective_screen_b render block");
    assert.match(block![1], /SUBJECTIVE_NARRATIVE_SCREEN_B_QUESTION_IDS\.map/);
    assert.match(block![1], /SUBJECTIVE_NARRATIVE_OPTIONAL_HINT/);
    assert.match(block![1], /REVIEW_STEP_TITLE/);
  });

  it("voice transcription populates the very same textarea state used for typed input (same response map)", () => {
    assert.match(
      source,
      /function updateSubjectiveResponse\(questionId: PostStrokeSubjectiveQuestionId, inputMode: PostStrokeSubjectiveInputMode, text: string\)/,
    );
    assert.match(source, /updateSubjectiveResponse\(questionId, "voice", text\)/);
    assert.match(source, /handleSubjectiveTextChange\(questionId, text\)/);
  });

  it("never shows an AI-generated clinical summary to the patient", () => {
    assert.doesNotMatch(source, /aiDraft|clinicianEdit|ptMedicalReportDraft|approvedPatientReportFacts/);
  });
});

describe("Stage 4 — voice provenance preserved after editing", () => {
  it("editing text preserves the existing inputMode instead of always resetting to text", () => {
    const handlerMatch = source.match(/function handleSubjectiveTextChange\(([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate handleSubjectiveTextChange");
    assert.match(handlerMatch![1], /prev\[questionId\]\?\.inputMode \?\? "text"/);
    assert.doesNotMatch(handlerMatch![1], /updateSubjectiveResponse\(questionId, "text", text\)/);
  });

  it("a fresh transcription always marks inputMode voice, regardless of prior state", () => {
    const handlerMatch = source.match(/function handleSubjectiveTranscript\(([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate handleSubjectiveTranscript");
    assert.match(handlerMatch![1], /updateSubjectiveResponse\(questionId, "voice", text\)/);
  });
});

describe("Stage 4 — single final confirmation gate", () => {
  it("uses exactly one confirmation checkbox on the final review screen, never a per-question confirm", () => {
    const checkboxMatches = source.match(/type="checkbox"/g) ?? [];
    assert.equal(checkboxMatches.length, 1, "expected exactly one checkbox in the whole component");
    assert.match(source, /checked=\{patientConfirmed\}/);
    assert.match(source, /PATIENT_CONFIRMATION_STATEMENT/);
  });

  it("disables final submission until the patient explicitly confirms", () => {
    assert.match(source, /disabled=\{finalSubmitting \|\| !patientConfirmed\}/);
  });

  it("requires confirmation before calling submitFunctionalIntake", () => {
    const handlerMatch = source.match(/async function handleFinalSubmit\(\) \{([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate handleFinalSubmit");
    assert.match(handlerMatch![1], /if \(!patientConfirmed\)/);
    assert.match(handlerMatch![1], /await submitFunctionalIntake\(\)/);
  });
});

describe("Stage 4 — final submission never calls AI/OpenAI and reuses the exact approved wording", () => {
  it("submitFunctionalIntake only fetches the existing submit route — no OpenAI/AI client import anywhere", () => {
    const handlerMatch = source.match(/async function submitFunctionalIntake\(\) \{([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate submitFunctionalIntake");
    assert.match(handlerMatch![1], /\/api\/remote-assessments\/\$\{encodeURIComponent\(token\)\}\/submit/);
    assert.doesNotMatch(source, /^import .*openai/im);
    assert.doesNotMatch(source, /new OpenAI\(/);
  });

  it("sends patientConfirmed as a request-only field, never nested inside subjectiveNarrative", () => {
    const handlerMatch = source.match(/async function submitFunctionalIntake\(\) \{([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate submitFunctionalIntake");
    assert.match(handlerMatch![1], /patientConfirmed,/);
    assert.doesNotMatch(handlerMatch![1], /patientConfirmedAt/);
  });

  it("reuses the exact approved final button label and success notice constants", () => {
    assert.match(source, /SUBMIT_FUNCTIONAL_INTAKE_LABEL/);
    assert.match(source, /FUNCTIONAL_INTAKE_SUBMITTED_NOTICE/);
  });
});

describe("Stage 4 — draft saving includes subjective responses", () => {
  it("saveIntakeDraft sends both functionalIntake and subjectiveNarrative to the existing save-draft endpoint", () => {
    const handlerMatch = source.match(/async function saveIntakeDraft\(([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate saveIntakeDraft");
    assert.match(handlerMatch![1], /\/save-draft/);
    assert.match(handlerMatch![1], /functionalIntake: nextFunctionalIntake/);
    assert.match(handlerMatch![1], /subjectiveNarrative: \{ responses \}/);
  });

  it("never includes patientConfirmedAt in a draft save", () => {
    const handlerMatch = source.match(/async function saveIntakeDraft\(([\s\S]*?)\n  \}/);
    assert.ok(handlerMatch, "expected to locate saveIntakeDraft");
    assert.doesNotMatch(handlerMatch![1], /patientConfirmedAt/);
  });
});

describe("Stage 4 — resume hydration includes the subjective narrative", () => {
  it("hydrates subjectiveResponses from the resumed draft and computes the correct next screen", () => {
    assert.match(source, /setSubjectiveResponses\(resumedResponseMap\)/);
    assert.match(source, /firstIncompleteSubjectiveNarrativeScreen\(resumedResponses\)/);
  });

  it("only advances into the narrative screens once functionalIntake is itself fully complete", () => {
    assert.match(source, /!isFunctionalIntakeComplete\(resumedFunctionalIntake\)/);
  });
});

describe("Stage 5 — Arabic voice control labels", () => {
  const voiceFieldControlsSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/patient/VoiceFieldControls.tsx"),
    "utf8",
  );
  const voiceInputButtonSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/patient/VoiceInputButton.tsx"),
    "utf8",
  );
  const voiceLabelsSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../components/patient/voice-ui-labels.ts"),
    "utf8",
  );

  it("defines Arabic aria-label strings for listen and voice-input controls", () => {
    assert.match(voiceLabelsSource, /listenToQuestion:[\s\S]*ar: "استمع إلى السؤال"/);
    assert.match(voiceLabelsSource, /startVoiceInput:[\s\S]*ar: "ابدأ الإدخال الصوتي"/);
    assert.match(voiceLabelsSource, /stopVoiceInput:[\s\S]*ar: "أوقف الإدخال الصوتي"/);
  });

  it("VoiceFieldControls uses localized aria-labels instead of hardcoded English", () => {
    assert.match(voiceFieldControlsSource, /aria-label=\{voiceLabel\("listenToQuestion", lang\)\}/);
    assert.doesNotMatch(voiceFieldControlsSource, /aria-label="Listen to question"/);
  });

  it("VoiceInputButton uses localized aria-labels instead of hardcoded English", () => {
    assert.match(voiceInputButtonSource, /voiceLabel\("startVoiceInput", lang\)/);
    assert.match(voiceInputButtonSource, /voiceLabel\("stopVoiceInput", lang\)/);
    assert.doesNotMatch(voiceInputButtonSource, /aria-label="Start voice input"/);
  });
});
