"use client";

import { useMemo, useState } from "react";
import type { PatientAssessmentDraft, PatientSectionId } from "@/app/lib/api/remote-assessments";
import {
  buildFullClinicianReview,
  type PatientReviewEntry,
} from "@/app/lib/patient-assessment-questions";
import {
  PATIENT_ANSWER_CLINICAL_ENGLISH_LABEL,
  PATIENT_ANSWER_ORIGINAL_LABEL,
} from "@/app/lib/reports/clinical-report-copy";
import {
  isTranslatablePatientFieldKey,
  readStoredClinicalTranslation,
} from "@/app/lib/reports/patient-clinical-translation";

type FieldRow = {
  fieldKey: string;
  label: string;
  originalArabic: string;
  clinicalEnglish: string;
};

type Props = {
  patientDraft: PatientAssessmentDraft;
  includedSections: PatientSectionId[];
  structuredData: Record<string, unknown>;
  onSaveEdits: (edits: { fieldKey: string; clinicalEnglish: string }[]) => Promise<void>;
  busy?: boolean;
};

function collectReviewFields(
  patientDraft: PatientAssessmentDraft,
  includedSections: PatientSectionId[],
  structuredData: Record<string, unknown>,
): FieldRow[] {
  const blocks = buildFullClinicianReview(patientDraft, includedSections);
  const rows: FieldRow[] = [];

  for (const block of blocks) {
    for (const entry of block.entries) {
      if (!isTranslatablePatientFieldKey(entry.fieldKey)) continue;
      const originalArabic = entry.value.trim();
      if (!originalArabic || /^\d+$/.test(originalArabic)) continue;
      rows.push({
        fieldKey: entry.fieldKey!,
        label: entry.label,
        originalArabic,
        clinicalEnglish: readStoredClinicalTranslation(structuredData, entry.fieldKey!),
      });
    }
  }

  return rows;
}

export function ClinicalEnglishReviewFields({
  patientDraft,
  includedSections,
  structuredData,
  onSaveEdits,
  busy = false,
}: Props) {
  const initialRows = useMemo(
    () => collectReviewFields(patientDraft, includedSections, structuredData),
    [patientDraft, includedSections, structuredData],
  );
  const [edits, setEdits] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.fieldKey, row.clinicalEnglish])),
  );
  const [dirty, setDirty] = useState(false);

  const handleChange = (fieldKey: string, value: string) => {
    setEdits((current) => ({ ...current, [fieldKey]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    const payload = initialRows
      .map((row) => ({
        fieldKey: row.fieldKey,
        clinicalEnglish: (edits[row.fieldKey] ?? "").trim(),
      }))
      .filter((item) => item.clinicalEnglish);
    await onSaveEdits(payload);
    setDirty(false);
  };

  if (initialRows.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-white/50">
        No translatable free-text fields were submitted.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {initialRows.map((row) => (
        <div
          key={row.fieldKey}
          className="rounded-[7px] border border-[#1E2D42] bg-[#0F1825] px-3 py-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            {row.label}
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {PATIENT_ANSWER_ORIGINAL_LABEL}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/85 whitespace-pre-wrap" dir="rtl">
                {row.originalArabic}
              </p>
            </div>
            <div>
              <label
                htmlFor={`clinical-en-${row.fieldKey}`}
                className="text-[10px] font-semibold uppercase tracking-wider text-white/30"
              >
                {PATIENT_ANSWER_CLINICAL_ENGLISH_LABEL}
              </label>
              <textarea
                id={`clinical-en-${row.fieldKey}`}
                value={edits[row.fieldKey] ?? ""}
                onChange={(event) => handleChange(row.fieldKey, event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2 text-sm leading-relaxed text-white/90"
              />
            </div>
          </div>
        </div>
      ))}

      {dirty ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-[6px] border border-[#1E2D42] bg-[#0F1825] px-3.5 py-[6px] text-[11px] font-medium text-white/80 transition hover:border-[#1D9E75]/25 hover:text-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving edits…" : "Save Clinical English edits"}
        </button>
      ) : null}
    </div>
  );
}

export function collectClinicalEnglishReviewRows(
  patientDraft: PatientAssessmentDraft,
  includedSections: PatientSectionId[],
): { entries: PatientReviewEntry[] }[] {
  return buildFullClinicianReview(patientDraft, includedSections).map((block) => ({
    entries: block.entries,
  }));
}
