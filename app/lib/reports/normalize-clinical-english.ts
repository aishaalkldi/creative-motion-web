/**
 * Deterministic Clinical English cleanup — surface hygiene only, no semantic rewriting.
 */

export type ClinicalEnglishNormalizationResult = {
  text: string;
  hadFillersRemoved: boolean;
  hadTranslatorNoteArtifacts: boolean;
  hadDuplicateFraming: boolean;
  preservedUncertainty: boolean;
};

const FILLER_PATTERN =
  /\b(um+|uh+|er+|ah+|like,?\s+|you know,?\s+|i mean,?\s+)/gi;

const REPEATED_WORD_PATTERN = /\b(\w+)(\s+\1\b)+/gi;

const TRANSLATOR_NOTE_PATTERN = /\[translator note:\s*([^\]]+)\]/gi;

const PATIENT_REPORTS_PREFIX = /^(the patient reports|patient-reported)\s*/i;

const DOUBLE_FRAMING_PATTERN =
  /(the patient reports|patient-reported)[^.]*\b(the patient reports|patient-reported)\b/i;

const PATIENT_REPORTS_MARKER = /\b(the patient reports|patient-reported)\b/gi;

export function stripTranslatorNoteArtifacts(text: string): {
  text: string;
  hadArtifacts: boolean;
  preservedUncertainty: boolean;
} {
  let hadArtifacts = false;
  let preservedUncertainty = false;
  const cleaned = text.replace(TRANSLATOR_NOTE_PATTERN, (_match, note: string) => {
    hadArtifacts = true;
    const trimmedNote = String(note).trim();
    if (/ambiguous|unclear|uncertain/i.test(trimmedNote)) {
      preservedUncertainty = true;
      return " (wording reported as uncertain by the patient)";
    }
    return "";
  });
  return { text: cleaned.replace(/\s{2,}/g, " ").trim(), hadArtifacts, preservedUncertainty };
}

export function removeObviousFillers(text: string): { text: string; removed: boolean } {
  const before = text;
  const withoutFillers = text
    .replace(FILLER_PATTERN, " ")
    .replace(REPEATED_WORD_PATTERN, "$1")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: withoutFillers, removed: withoutFillers !== before.trim() };
}

export function collapseDuplicatePatientReportsFraming(text: string): { text: string; collapsed: boolean } {
  let collapsed = false;
  let next = text.trim();

  for (let pass = 0; pass < 8 && DOUBLE_FRAMING_PATTERN.test(next); pass += 1) {
    collapsed = true;
    const previous = next;
    next = next.replace(DOUBLE_FRAMING_PATTERN, (match) => {
      const markers = [...match.matchAll(PATIENT_REPORTS_MARKER)];
      if (markers.length < 2) {
        return match;
      }
      const secondMarker = markers[1];
      const body = match
        .slice(secondMarker.index! + secondMarker[0].length)
        .replace(/^\s*(main complaint of|symptoms of)\s*/i, "")
        .trim();
      return body ? `The patient reports ${body}` : "The patient reports";
    });
    if (next === previous) {
      break;
    }
  }

  if (/^(the patient reports\s+){2,}/i.test(next)) {
    collapsed = true;
    next = next.replace(/^(the patient reports\s+)+/i, "The patient reports ");
  }
  return { text: next.trim(), collapsed };
}

export function normalizeClinicalEnglishText(text: string): ClinicalEnglishNormalizationResult {
  const fillerStep = removeObviousFillers(text);
  const noteStep = stripTranslatorNoteArtifacts(fillerStep.text);
  const framingStep = collapseDuplicatePatientReportsFraming(noteStep.text);

  let normalized = framingStep.text
    .replace(/\s+([.!?])/g, "$1")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .trim();

  if (normalized && !PATIENT_REPORTS_PREFIX.test(normalized) && /^i\s+/i.test(normalized)) {
    normalized = `The patient reports ${normalized.replace(/^i\s+/i, "")}`;
  }

  return {
    text: normalized,
    hadFillersRemoved: fillerStep.removed,
    hadTranslatorNoteArtifacts: noteStep.hadArtifacts,
    hadDuplicateFraming: framingStep.collapsed,
    preservedUncertainty: noteStep.preservedUncertainty,
  };
}
