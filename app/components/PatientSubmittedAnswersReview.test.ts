/**
 * Regression coverage for the infinite React update loop in the Arabic
 * translation progress flow:
 *
 *   PatientSubmittedAnswersReview.useEffect
 *     → AssessmentReportClient.handleTranslationProgress
 *     → setState → parent render → child effect runs again
 *
 * Root cause: `blocks` (buildFullClinicianReview(...)) was recomputed,
 * unmemoized, on every render, cascading into a new `arabicFields` array and
 * a new `translateAll` closure identity every render — even when nothing
 * meaningful changed. The progress-reporting effect included `translateAll`
 * in its dependency array, so it refired every render; the parent's own
 * `setTranslationExport` bailout (comparing all five fields, including
 * `translateAll`, by reference) then always saw a "change" because of the
 * identity churn alone, forcing a real state update and a fresh parent
 * render — which repeated indefinitely.
 *
 * The fix: memoize `blocks` (stabilizing the whole arabicFields/translateAll
 * chain) and, as a second independent guard, only call the parent's
 * onTranslationProgress when its primitive values actually changed —
 * regardless of translateAll's identity.
 *
 * This repository has no React render harness (established convention — see
 * Stage 1's voice-clinical-assistant.test.ts and Stage 3B's
 * ExtractedFieldsPanel.test.ts). These tests cover the exported pure
 * decision function directly, plus source-level structural checks
 * confirming the memoization and guard are wired correctly and that nothing
 * else (auto-review, auto Gate 1 approval, the setup notice) was touched.
 *
 * Run: npx tsx --test app/components/PatientSubmittedAnswersReview.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  hasTranslationProgressChanged,
  type TranslationProgressSnapshot,
} from "./PatientSubmittedAnswersReview";

const SOURCE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "PatientSubmittedAnswersReview.tsx",
);

const BASE: TranslationProgressSnapshot = {
  doneCount: 1,
  totalCount: 3,
  allTranslated: false,
  anyLoading: false,
};

describe("hasTranslationProgressChanged", () => {
  it("reports true on the very first call (no prior snapshot) — initial progress is always reported once", () => {
    assert.equal(hasTranslationProgressChanged(null, BASE), true);
  });

  it("reports false when every primitive value is identical to the last reported snapshot", () => {
    const same: TranslationProgressSnapshot = { ...BASE };
    assert.equal(hasTranslationProgressChanged(BASE, same), false);
  });

  it("reports true when doneCount changes — a real translation completing", () => {
    assert.equal(hasTranslationProgressChanged(BASE, { ...BASE, doneCount: 2 }), true);
  });

  it("reports true when totalCount changes", () => {
    assert.equal(hasTranslationProgressChanged(BASE, { ...BASE, totalCount: 4 }), true);
  });

  it("reports true when allTranslated flips", () => {
    assert.equal(hasTranslationProgressChanged(BASE, { ...BASE, allTranslated: true }), true);
  });

  it("reports true when anyLoading flips", () => {
    assert.equal(hasTranslationProgressChanged(BASE, { ...BASE, anyLoading: true }), true);
  });

  it("is a pure function with no side effects (no fetch, no state mutation)", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("hasTranslationProgressChanged must never call fetch");
    }) as typeof fetch;
    try {
      hasTranslationProgressChanged(BASE, BASE);
      hasTranslationProgressChanged(null, BASE);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("PatientSubmittedAnswersReview source — loop-fix wiring", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");

  it("memoizes blocks with useMemo keyed only on patientDraft and includedSections", () => {
    assert.match(
      source,
      /const blocks = useMemo\(\s*\n\s*\(\) => buildFullClinicianReview\(patientDraft, includedSections\),\s*\n\s*\[patientDraft, includedSections\],\s*\n\s*\);/,
    );
  });

  it("gates the progress effect's callback invocation behind hasTranslationProgressChanged", () => {
    assert.match(source, /if \(!hasTranslationProgressChanged\(lastReportedProgressRef\.current, next\)\) {\s*\n\s*return;/);
  });

  it("resets the tracked snapshot when assessmentId changes, so a new assessment's initial progress always reports", () => {
    assert.match(source, /lastReportedAssessmentIdRef\.current !== assessmentId/);
  });

  it("does not call fetch, PATCH, or any review/approval action from the progress-reporting effect", () => {
    const effectMatch = source.match(
      /const lastReportedProgressRef[\s\S]*?}, \[\s*\n\s*onTranslationProgress,[\s\S]*?\]\);/,
    );
    assert.ok(effectMatch, "expected to locate the progress-reporting effect in source");
    // Strip comments first — the fix's own explanatory comments use words
    // like "reviewed" (clinician reviewing the assessment) that would
    // otherwise false-positive against a naive raw-source check.
    const effectBody = effectMatch![0]
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(effectBody, /fetch\(/);
    assert.doesNotMatch(effectBody, /PATCH/);
    assert.doesNotMatch(effectBody, /setApprovedFacts/);
    assert.doesNotMatch(effectBody, /approvePatientReportFacts/);
    assert.doesNotMatch(effectBody, /reviewed/i);
  });

  it("keeps Gate 1 approval as an explicit clinician action only (handleApprovePatientReportFacts is not called from any effect)", () => {
    // handleApprovePatientReportFacts must only appear in its own declaration
    // and in the button's onClick handler — never inside a useEffect body.
    const occurrences = [...source.matchAll(/handleApprovePatientReportFacts/g)];
    assert.ok(occurrences.length >= 2, "expected the declaration plus at least one onClick usage");
    assert.match(source, /onClick={.*handleApprovePatientReportFacts/);
    const useEffectBlocks = [...source.matchAll(/useEffect\(\(\) => \{[\s\S]*?\n\s{2}\}, \[[\s\S]*?\]\);/g)];
    for (const block of useEffectBlocks) {
      assert.doesNotMatch(block[0], /handleApprovePatientReportFacts/);
    }
  });

  it("keeps the setup notice condition unchanged: disabled translation + Arabic + non-compact", () => {
    assert.match(
      source,
      /showSetupNotice\s*=\s*!aiTranslationEnabled\s*&&\s*assessmentLanguage === "ar"\s*&&\s*!compact/,
    );
  });
});
