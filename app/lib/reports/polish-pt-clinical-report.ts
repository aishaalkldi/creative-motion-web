/**
 * Deterministic post-synthesis polish for PT clinical reports.
 * Conservative deduplication by clinical concept — not token overlap alone.
 */
import { FORBIDDEN_INTERPRETATION_TERMS } from "@/app/lib/reports/assessment-interpretation-draft";
import {
  conceptsMatchForDedup,
  getQuestionnaireFieldSpec,
  type ClinicalConcept,
} from "@/app/lib/reports/questionnaire-clinical-field-registry";
import { normalizeClinicalEnglishText, stripTranslatorNoteArtifacts } from "@/app/lib/reports/normalize-clinical-english";
import { isAllowedRasqModuleLabel, listRasqModuleLabels } from "@/app/lib/reports/rasq-assessment-modules";
import type {
  PtClinicalReportDraft,
  PtClinicalReportSection,
  PtReportSectionId,
} from "@/app/lib/reports/pt-clinical-report-schema";
import type { StructuredClinicalSourceBundle } from "@/app/lib/reports/structured-clinical-source-bundle";

const OBJECTIVE_FINDING_PATTERN =
  /\b(confirmed weakness|measured rom|limited rom|rom loss|grade\s*[0-9]|mmt\b|on examination|objectively)\b/i;

const BOILERPLATE_ONLY = new Set([
  "no detailed presentation fields were documented in the submitted questionnaire.",
  "no primary complaint was documented.",
  "no pain or symptom behavior details were documented.",
  "no functional limitations were documented.",
  "no activity or participation restrictions were documented.",
  "no patient goals were documented.",
]);

function cleanLine(line: string): string {
  const note = stripTranslatorNoteArtifacts(line);
  const normalized = normalizeClinicalEnglishText(note.text);
  return normalized.text.trim();
}

function containsForbiddenTerm(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return FORBIDDEN_INTERPRETATION_TERMS.some((term) => normalized.includes(term.trim()));
}

function isBoilerplateOnly(lines: string[]): boolean {
  if (lines.length === 0) return true;
  const corpus = lines.join(" ").trim().toLowerCase();
  if (!corpus) return true;
  return lines.every((line) => BOILERPLATE_ONLY.has(line.trim().toLowerCase()));
}

function inferConceptFromLine(
  line: string,
  bundle: StructuredClinicalSourceBundle,
): ClinicalConcept | null {
  const normalized = line.toLowerCase();
  for (const field of bundle.allFields) {
    const english = field.clinicalEnglish.toLowerCase();
    if (english && normalized.includes(english.slice(0, Math.min(english.length, 24)))) {
      return field.clinicalConcept;
    }
  }
  if (/\b(weakness|weak)\b/.test(normalized) && !/\bpain\b/.test(normalized)) return "weakness";
  if (/\bpain\b/.test(normalized) && /\brais|overhead|movement\b/.test(normalized)) {
    return "symptom_behavior_with_movement";
  }
  if (/\b(goal|return to|wish to)\b/.test(normalized)) return "patient_goals";
  if (/\b(stand|minute|hour|duration|tolerance)\b/.test(normalized)) return "standing_tolerance";
  if (/\b(walk|gait|distance|block)\b/.test(normalized)) return "walking_tolerance";
  if (/\b(balance|unsteady|fall)\b/.test(normalized)) return "balance_difficulty";
  if (/\b(shoulder|hand|arm|knee|back|neck|region|area)\b/.test(normalized)) return "anatomical_region";
  return null;
}

export function conservativeDedupeLines(
  lines: string[],
  bundle: StructuredClinicalSourceBundle,
  seenConcepts: Set<ClinicalConcept>,
): string[] {
  const kept: string[] = [];
  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line || containsForbiddenTerm(line) || OBJECTIVE_FINDING_PATTERN.test(line)) continue;

    const matchedField = bundle.allFields.find((field) =>
      line.toLowerCase().includes(field.clinicalEnglish.toLowerCase().slice(0, 20)),
    );
    const concept =
      matchedField?.clinicalConcept ?? inferConceptFromLine(line, bundle) ?? null;

    if (concept) {
      const duplicateConcept = Array.from(seenConcepts).some((seen) =>
        conceptsMatchForDedup(seen, concept),
      );
      const sameFieldDuplicate = matchedField
        ? kept.some((existing) =>
            existing.toLowerCase().includes(matchedField.clinicalEnglish.toLowerCase().slice(0, 20)),
          )
        : false;
      if (duplicateConcept && sameFieldDuplicate) continue;
      if (duplicateConcept && matchedField) {
        const spec = getQuestionnaireFieldSpec(matchedField.fieldKey);
        const primarySection = spec?.reportSectionHints[0];
        if (primarySection && primarySection !== "presentation") continue;
      }
      seenConcepts.add(concept);
    }

    kept.push(line);
  }
  return kept;
}

function polishRasqBullets(bullets: string[]): string[] {
  const allowedLabels = listRasqModuleLabels();
  const polished: string[] = [];
  for (const bullet of bullets) {
    const cleaned = cleanLine(bullet);
    if (!cleaned) continue;
    if (isAllowedRasqModuleLabel(cleaned)) {
      polished.push(cleaned.startsWith("Consider") ? cleaned : `Consider for therapist review: ${cleaned}`);
      continue;
    }
    const matched = allowedLabels.find((label) => cleaned.toLowerCase().includes(label.toLowerCase()));
    if (matched) {
      polished.push(`Consider for therapist review: ${matched} if clinically appropriate.`);
    }
  }
  return polished;
}

export function polishPtClinicalReportDraft(
  report: PtClinicalReportDraft,
  bundle: StructuredClinicalSourceBundle,
): PtClinicalReportDraft {
  const seenConcepts = new Set<ClinicalConcept>();
  const polishedSections: PtClinicalReportSection[] = [];

  for (const section of report.sections) {
    const paragraphs = conservativeDedupeLines(section.paragraphs, bundle, seenConcepts);
    const bullets =
      section.id === "suggested_rasq_modules"
        ? polishRasqBullets(section.bullets)
        : conservativeDedupeLines(section.bullets, bundle, seenConcepts);

    const hasContent = !isBoilerplateOnly([...paragraphs, ...bullets]);
    polishedSections.push({
      ...section,
      paragraphs: hasContent ? paragraphs : paragraphs.slice(0, 1),
      bullets,
    });
  }

  return { ...report, sections: polishedSections };
}

export function countSubstantiveReportLines(report: PtClinicalReportDraft): number {
  return report.sections.reduce(
    (sum, section) => sum + section.paragraphs.length + section.bullets.length,
    0,
  );
}

export function estimateReportPages(report: PtClinicalReportDraft): number {
  const lines = countSubstantiveReportLines(report);
  return Math.max(1, Math.ceil(lines / 18));
}

export function reportUsesSynthesisStyle(report: PtClinicalReportDraft): boolean {
  const interpretation = report.sections.find((section) => section.id === "pt_interpretation");
  if (!interpretation) return false;
  const text = [...interpretation.paragraphs, ...interpretation.bullets].join(" ").toLowerCase();
  return (
    text.includes("objective assessment is required") ||
    text.includes("for therapist review") ||
    text.includes("may be consistent with") ||
    text.includes("patient-reported presentation")
  );
}

export function sectionHasSubstantiveContent(section: PtClinicalReportSection): boolean {
  return !isBoilerplateOnly([...section.paragraphs, ...section.bullets]);
}

export function filterDisplaySections(report: PtClinicalReportDraft): PtClinicalReportSection[] {
  return report.sections.filter((section) => sectionHasSubstantiveContent(section));
}
