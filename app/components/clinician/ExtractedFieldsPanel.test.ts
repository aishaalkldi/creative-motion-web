/**
 * Run: npx tsx --test app/components/clinician/ExtractedFieldsPanel.test.ts
 *
 * This repo has no React render harness (no @testing-library/react,
 * react-test-renderer, or jsdom), and none may be added, so these tests
 * cover only the exported pure functions — parsing, validation, and state
 * derivation — not the rendered component output. Component-mount behavior
 * ("no POST/PATCH fires automatically") is confirmed by code inspection in
 * the accompanying report, not by a render test: ExtractedFieldsPanel.tsx's
 * fetch calls exist only inside runExtraction/confirmExtraction, both of
 * which are plain useCallback closures invoked solely from onClick handlers
 * — no useEffect in the file ever calls either of them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPanelViewModel,
  deriveInitialState,
  deriveStateFromExtractionResponse,
  isLowConfidence,
  parseConfirmApiResponse,
  parseExtractionApiResponse,
  parseGeneratedAt,
  parseReviewed,
  parseStoredExtraction,
  type StructuredExtraction,
} from "./ExtractedFieldsPanel";

const SHOULDER_EXTRACTION: StructuredExtraction = {
  body_region: "shoulder",
  side: "right",
  primary_symptom: "pain",
  aggravating_factor: "overhead arm elevation",
  language: "ar",
  confidence: 0.92,
};

describe("parseGeneratedAt", () => {
  it("accepts a valid ISO timestamp", () => {
    assert.equal(parseGeneratedAt("2026-01-02T00:00:00.000Z"), "2026-01-02T00:00:00.000Z");
  });

  it("handles an invalid timestamp safely by returning null, not throwing", () => {
    assert.equal(parseGeneratedAt("not-a-date"), null);
    assert.equal(parseGeneratedAt(12345), null);
    assert.equal(parseGeneratedAt(undefined), null);
    assert.equal(parseGeneratedAt(""), null);
  });
});

describe("parseReviewed", () => {
  it("reviewed false → unconfirmed", () => {
    assert.equal(parseReviewed(false), false);
  });

  it("reviewed true → confirmed", () => {
    assert.equal(parseReviewed(true), true);
  });

  it("anything other than a literal true defaults to unconfirmed", () => {
    assert.equal(parseReviewed(undefined), false);
    assert.equal(parseReviewed(null), false);
    assert.equal(parseReviewed("true"), false);
    assert.equal(parseReviewed(1), false);
  });
});

describe("isLowConfidence", () => {
  it("confidence below 0.5 is flagged as needing careful review", () => {
    assert.equal(isLowConfidence({ ...SHOULDER_EXTRACTION, confidence: 0.49 }), true);
    assert.equal(isLowConfidence({ ...SHOULDER_EXTRACTION, confidence: 0 }), true);
  });

  it("confidence equal to or above 0.5 is a normal review state", () => {
    assert.equal(isLowConfidence({ ...SHOULDER_EXTRACTION, confidence: 0.5 }), false);
    assert.equal(isLowConfidence({ ...SHOULDER_EXTRACTION, confidence: 1 }), false);
  });
});

describe("deriveInitialState", () => {
  it("no valid extraction stored → idle", () => {
    assert.deepEqual(deriveInitialState(undefined, undefined, undefined), { kind: "idle" });
    assert.deepEqual(deriveInitialState("garbage", "also garbage", true), { kind: "idle" });
  });

  it("a valid stored extraction is displayed without alteration, reviewed initialized from stored value", () => {
    const state = deriveInitialState(SHOULDER_EXTRACTION, "2026-01-02T00:00:00.000Z", false);
    assert.deepEqual(state, {
      kind: "extracted",
      extraction: SHOULDER_EXTRACTION,
      generatedAt: "2026-01-02T00:00:00.000Z",
      reviewed: false,
    });
  });

  it("initializes reviewed:true from stored metadata when already confirmed", () => {
    const state = deriveInitialState(SHOULDER_EXTRACTION, "2026-01-02T00:00:00.000Z", true);
    assert.equal(state.kind, "extracted");
    assert.equal((state as { reviewed: boolean }).reviewed, true);
  });
});

describe("parseExtractionApiResponse / deriveStateFromExtractionResponse", () => {
  it("a successful extraction response derives an unconfirmed state by default", () => {
    const parsed = parseExtractionApiResponse({
      extraction: SHOULDER_EXTRACTION,
      generatedAt: "2026-01-02T00:00:00.000Z",
      reviewed: false,
      cached: false,
    });
    assert.ok(parsed);
    const state = deriveStateFromExtractionResponse(parsed!);
    assert.equal(state.kind, "extracted");
    assert.equal((state as { reviewed: boolean }).reviewed, false);
  });

  it("a malformed or missing reviewed field also defaults to unconfirmed, never auto-confirmed", () => {
    const parsed = parseExtractionApiResponse({
      extraction: SHOULDER_EXTRACTION,
      generatedAt: "2026-01-02T00:00:00.000Z",
      cached: false,
    });
    assert.equal(parsed!.reviewed, false);
  });

  it("rejects a response with an invalid extraction shape", () => {
    assert.equal(parseExtractionApiResponse({ extraction: { side: "right" } }), null);
    assert.equal(parseExtractionApiResponse(null), null);
    assert.equal(parseExtractionApiResponse("not an object"), null);
  });
});

describe("parseConfirmApiResponse", () => {
  it("returns true only for an exact { reviewed: true } response", () => {
    assert.equal(parseConfirmApiResponse({ reviewed: true }), true);
  });

  it("returns false for anything else, safely", () => {
    assert.equal(parseConfirmApiResponse({ reviewed: false }), false);
    assert.equal(parseConfirmApiResponse({}), false);
    assert.equal(parseConfirmApiResponse(null), false);
    assert.equal(parseConfirmApiResponse("ok"), false);
  });
});

describe("buildPanelViewModel — original text preservation", () => {
  it("preserves Arabic original text byte-for-byte", () => {
    const arabic = "عندي ألم في الكتف الأيمن لما أرفع يدي، وخصوصًا في الليل.";
    const view = buildPanelViewModel(arabic, { kind: "idle" });
    assert.equal(view.originalText, arabic);
  });

  it("preserves English original text byte-for-byte", () => {
    const english = "I have sharp pain in my right shoulder, especially overhead — worse at night.";
    const view = buildPanelViewModel(english, { kind: "idle" });
    assert.equal(view.originalText, english);
  });

  it("preserves original text unchanged across every panel state", () => {
    const text = "Original chief complaint text.";
    const states: import("./ExtractedFieldsPanel").ExtractionPanelState[] = [
      { kind: "idle" },
      { kind: "loading" },
      { kind: "unavailable" },
      {
        kind: "extracted",
        extraction: SHOULDER_EXTRACTION,
        generatedAt: "2026-01-02T00:00:00.000Z",
        reviewed: false,
      },
    ];
    for (const state of states) {
      assert.equal(buildPanelViewModel(text, state).originalText, text);
    }
  });
});

describe("buildPanelViewModel — required wording", () => {
  it("shows the confidence warning text only below 0.5", () => {
    const low = buildPanelViewModel("x", {
      kind: "extracted",
      extraction: { ...SHOULDER_EXTRACTION, confidence: 0.3 },
      generatedAt: null,
      reviewed: false,
    });
    assert.equal(low.confidenceWarningText, "Needs careful review");

    const normal = buildPanelViewModel("x", {
      kind: "extracted",
      extraction: { ...SHOULDER_EXTRACTION, confidence: 0.9 },
      generatedAt: null,
      reviewed: false,
    });
    assert.equal(normal.confidenceWarningText, null);
  });

  it("shows 'Not confirmed' status text before confirmation", () => {
    const view = buildPanelViewModel("x", {
      kind: "extracted",
      extraction: SHOULDER_EXTRACTION,
      generatedAt: null,
      reviewed: false,
    });
    assert.match(view.reviewStatusText, /Not confirmed/);
  });

  it("shows 'Confirmed by clinician' status text after confirmation", () => {
    const view = buildPanelViewModel("x", {
      kind: "extracted",
      extraction: SHOULDER_EXTRACTION,
      generatedAt: null,
      reviewed: true,
    });
    assert.match(view.reviewStatusText, /Confirmed by clinician/);
  });

  it("shows 'Extraction unavailable' status text on failure", () => {
    const view = buildPanelViewModel("x", { kind: "unavailable" });
    assert.match(view.reviewStatusText, /Extraction unavailable/);
  });
});

describe("no helper function initiates any side effect", () => {
  it("every exported function in this module is synchronous (no fetch, POST, PATCH, or Promise)", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("no helper function may call fetch");
    }) as typeof fetch;

    try {
      parseStoredExtraction(SHOULDER_EXTRACTION);
      parseGeneratedAt("2026-01-01T00:00:00.000Z");
      parseReviewed(true);
      isLowConfidence(SHOULDER_EXTRACTION);
      deriveInitialState(SHOULDER_EXTRACTION, "2026-01-01T00:00:00.000Z", false);
      const parsed = parseExtractionApiResponse({
        extraction: SHOULDER_EXTRACTION,
        generatedAt: null,
        reviewed: false,
        cached: false,
      });
      deriveStateFromExtractionResponse(parsed!);
      parseConfirmApiResponse({ reviewed: true });
      buildPanelViewModel("text", { kind: "idle" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
