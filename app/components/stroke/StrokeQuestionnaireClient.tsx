"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RemoteAssessmentRequest } from "@/app/lib/api/remote-assessments";
import { submitRemoteAssessment } from "@/app/lib/api/remote-assessments";
import {
  buildStrokeBranchTrace,
  resolveStrokeSafetyState,
  visibleStrokeQuestions,
  visibleStrokeSections,
} from "@/app/lib/stroke-questionnaire/stroke-branch-engine";
import {
  STROKE_PATHWAY,
  STROKE_QUESTIONNAIRE_KIND,
  STROKE_QUESTIONNAIRE_VERSION,
  STROKE_SECTION_TITLES,
  compactStrokeResponsesForSubmission,
  type StrokeQuestionDefinition,
  type StrokeResponse,
  type StrokeSectionId,
} from "@/app/lib/stroke-questionnaire/stroke-questionnaire-schema";
import { LanguageToggle, type PatientLang } from "@/app/components/patient/LanguageToggle";

type Props = {
  token: string;
  request: RemoteAssessmentRequest;
};

function label(question: StrokeQuestionDefinition, lang: PatientLang): string {
  return lang === "ar" ? question.ar : question.en;
}

function displayRawValue(response: StrokeResponse): string {
  return Array.isArray(response.rawValue)
    ? response.rawValue.join(", ")
    : response.rawValue;
}

export function StrokeQuestionnaireClient({ token }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<PatientLang>("en");
  const [responses, setResponses] = useState<Record<string, StrokeResponse>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sections = useMemo(() => visibleStrokeSections(responses), [responses]);
  const currentSection = sections[sectionIndex] ?? sections[0];
  const questions = useMemo(
    () => visibleStrokeQuestions(currentSection, responses),
    [currentSection, responses],
  );
  const safetyState = resolveStrokeSafetyState(responses);
  const informationSource = Array.isArray(responses.sc_information_source?.rawValue)
    ? ""
    : responses.sc_information_source?.rawValue;
  const caregiverDefault = informationSource === "caregiver";

  function updateResponse(
    question: StrokeQuestionDefinition,
    rawValue: string | string[],
  ) {
    const reporterRole = caregiverDefault ? "caregiver" : "patient";
    setResponses((current) => ({
      ...current,
      [question.id]: {
        rawValue,
        rawLanguage: lang,
        responseMethod:
          question.kind === "short_text" ||
          question.kind === "long_text" ||
          question.kind === "date"
            ? "text"
            : "selection",
        provenance:
          reporterRole === "caregiver" ? "CAREGIVER_REPORTED" : "PATIENT_REPORTED",
        reporterRole,
        translation: { status: "not_generated" },
      },
    }));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      await submitRemoteAssessment(
        token,
        {
          questionnaireKind: STROKE_QUESTIONNAIRE_KIND,
          questionnaireVersion: STROKE_QUESTIONNAIRE_VERSION,
          pathway: STROKE_PATHWAY,
          assessmentLanguage: lang,
          safetyState,
          responses: compactStrokeResponsesForSubmission(responses),
          branchTrace: buildStrokeBranchTrace(responses),
        },
        lang,
      );
      router.push(`/assessment/${token}/complete`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not submit the intake.",
      );
      setSubmitting(false);
    }
  }

  if (safetyState === "URGENT_ESCALATION" && currentSection === "safety_gate") {
    return (
      <main className="min-h-screen bg-[#071a2f] px-5 py-12 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-300/30 bg-rose-400/10 p-6">
          <h1 className="text-xl font-bold">Urgent safety escalation</h1>
          <p className="mt-3 text-sm leading-6 text-rose-50">
            These answers may indicate a need for urgent medical review. Do not perform
            rehabilitation movement tests. Contact local emergency services or the
            treating medical team now.
          </p>
          <p className="mt-3 text-xs text-rose-100/75">
            This intake result does not diagnose a new stroke or any other condition.
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="mt-5 rounded-lg bg-rose-200 px-4 py-2 text-sm font-bold text-rose-950 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send safety responses to clinic"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#071a2f] px-5 py-8 text-white"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              RASQ
            </p>
            <h1 className="mt-1 text-xl font-bold">
              {lang === "ar"
                ? "استبيان التأهيل العصبي عن بُعد"
                : "Remote Neurorehabilitation Intake"}
            </h1>
          </div>
          <LanguageToggle current={lang} onChange={setLang} />
        </header>

        {safetyState === "REQUIRES_CLINICIAN_REVIEW" ? (
          <div className="mb-5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
            A clinician should review the reported safety concern. This does not mean
            the patient is cleared for exercise.
          </div>
        ) : null}

        {!reviewing ? (
          <>
            <div className="mb-5">
              <p className="text-xs text-white/45">
                Section {sectionIndex + 1} of {sections.length}
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {STROKE_SECTION_TITLES[currentSection][lang]}
              </h2>
              {currentSection === "safety_gate" ? (
                <p className="mt-2 text-sm text-white/55">
                  PASS means only that no escalation trigger was selected in this
                  intake. It is not medical clearance for exercise.
                </p>
              ) : null}
            </div>

            <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              {questions.map((question) => (
                <StrokeQuestion
                  key={question.id}
                  question={question}
                  lang={lang}
                  response={responses[question.id]}
                  onChange={(value) => updateResponse(question, value)}
                />
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {sectionIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => setSectionIndex((index) => index - 1)}
                  className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold"
                >
                  Previous
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (sectionIndex < sections.length - 1) {
                    setSectionIndex((index) => index + 1);
                  } else {
                    setReviewing(true);
                  }
                }}
                className="flex-1 rounded-xl bg-cyan-300 py-3 text-sm font-bold text-slate-950"
              >
                {sectionIndex < sections.length - 1 ? "Next" : "Review answers"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold">Review responses</h2>
            <p className="text-sm text-white/60">
              Information remains tagged as patient- or caregiver-reported.
            </p>
            {sections.map((sectionId) => (
              <section
                key={sectionId}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h3 className="font-bold">{STROKE_SECTION_TITLES[sectionId][lang]}</h3>
                <dl className="mt-3 space-y-3">
                  {visibleStrokeQuestions(sectionId, responses)
                    .filter((question) => responses[question.id])
                    .map((question) => (
                      <div key={question.id}>
                        <dt className="text-xs text-white/45">{label(question, lang)}</dt>
                        <dd className="mt-1 text-sm text-white/85">
                          {displayRawValue(responses[question.id])}
                          <span className="ml-2 text-[10px] text-cyan-300/70">
                            {responses[question.id].provenance}
                          </span>
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="flex-1 rounded-xl bg-cyan-300 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit intake"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StrokeQuestion({
  question,
  lang,
  response,
  onChange,
}: {
  question: StrokeQuestionDefinition;
  lang: PatientLang;
  response?: StrokeResponse;
  onChange: (value: string | string[]) => void;
}) {
  const current = response?.rawValue ?? "";
  if (question.kind === "long_text" || question.kind === "short_text") {
    return (
      <label className="block">
        <span className="text-sm font-semibold">{label(question, lang)}</span>
        <textarea
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={question.kind === "long_text" ? 3 : 1}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
        />
      </label>
    );
  }
  if (question.kind === "date") {
    return (
      <label className="block">
        <span className="text-sm font-semibold">{label(question, lang)}</span>
        <input
          type="date"
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
      </label>
    );
  }
  if (question.kind === "multi_select") {
    const selected = Array.isArray(current) ? current : [];
    return (
      <fieldset>
        <legend className="text-sm font-semibold">{label(question, lang)}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {question.options?.map((option) => (
            <label key={option.value} className="flex gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((value) => value !== option.value),
                  )
                }
              />
              {lang === "ar" ? option.ar : option.en}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label(question, lang)}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {question.options?.map((option) => (
          <label key={option.value} className="flex gap-2 text-sm text-white/80">
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={current === option.value}
              onChange={() => onChange(option.value)}
            />
            {lang === "ar" ? option.ar : option.en}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
