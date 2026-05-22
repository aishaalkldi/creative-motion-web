"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import {
  getRemoteAssessment,
  updateRemoteAssessmentDraft,
  submitRemoteAssessment,
  isExpired,
  daysUntilExpiry,
  ASSESSMENT_TYPE_LABELS,
  type RemoteAssessmentRequest,
  type PatientAssessmentDraft,
  type PatientSectionId,
  type AssessmentLanguage,
} from "@/app/lib/api/remote-assessments";
import { LanguageToggle, type PatientLang } from "@/app/components/patient/LanguageToggle";
import {
  PATIENT_SECTION_QUESTIONS,
  PATIENT_SECTION_TITLES,
  PATIENT_UI,
  buildPatientReviewEntries,
  patientText,
  type PatientQuestionField,
} from "@/app/lib/patient-assessment-questions";

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  display: "swap",
});

type Stage = "consent" | "section" | "review" | "submitting";

function PainScale({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  lang: PatientLang;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-white/40">
        <span>{patientText(PATIENT_UI.painScaleMin, lang)}</span>
        <span>{patientText(PATIENT_UI.painScaleMax, lang)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, i) => {
          const v = String(i);
          const isActive = value === v;
          const color = i === 0 ? "lime" : i <= 3 ? "lime" : i <= 6 ? "amber" : "rose";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(v)}
              className={`h-9 w-9 rounded-xl border text-sm font-bold transition ${
                isActive
                  ? color === "lime"
                    ? "border-lime-300/40 bg-lime-400/15 text-lime-200"
                    : color === "amber"
                      ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                      : "border-rose-300/40 bg-rose-400/15 text-rose-200"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
              }`}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-semibold text-white/90">{children}</p>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs text-white/45">{children}</p>;
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-300/30 focus:bg-white/[0.06]"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-cyan-300/30 focus:bg-white/[0.06]"
    />
  );
}

function emptyDraft(): PatientAssessmentDraft {
  return {
    pain: { chiefComplaint: "", painLocation: "", painScore: "", aggravating: "", easing: "", dailyImpact: "", goals: "" },
    rom: { limitations: "", worseWith: "" },
    strength: { weaknessDescription: "", activitiesAffected: "" },
    balance: { difficultyDescription: "", fallHistory: "" },
    gait: { walkingDescription: "", aids: "" },
    functional: { standingDuration: "", walkingDistance: "", stairsAbility: "", otherNotes: "" },
  };
}

function getSectionData(
  section: PatientSectionId,
  draft: PatientAssessmentDraft,
): Record<string, string> {
  const block = draft[section];
  return (block ?? {}) as Record<string, string>;
}

function ConfigSectionForm({
  section,
  data,
  onChange,
  lang,
}: {
  section: PatientSectionId;
  data: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  lang: PatientLang;
}) {
  const fields = PATIENT_SECTION_QUESTIONS[section];

  return (
    <div className="space-y-5">
      {fields.map((field: PatientQuestionField) => {
        const placeholder =
          field.placeholder
            ? patientText(field.placeholder, lang)
            : undefined;
        const value = data[field.key] ?? "";

        return (
          <div key={field.key}>
            <Label>{patientText(field.text, lang)}</Label>
            {field.hint && <Hint>{patientText(field.hint, lang)}</Hint>}
            {field.kind === "painScale" ? (
              <PainScale value={value} onChange={(v) => onChange({ ...data, [field.key]: v })} lang={lang} />
            ) : field.kind === "textarea" ? (
              <TextArea
                value={value}
                onChange={(v) => onChange({ ...data, [field.key]: v })}
                placeholder={placeholder}
                rows={field.rows ?? 3}
              />
            ) : (
              <TextInput
                value={value}
                onChange={(v) => onChange({ ...data, [field.key]: v })}
                placeholder={placeholder}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewSection({
  section,
  data,
  lang,
}: {
  section: PatientSectionId;
  data: PatientAssessmentDraft;
  lang: PatientLang;
}) {
  const entries = buildPatientReviewEntries(section, data, lang);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold text-white/70">{patientText(PATIENT_SECTION_TITLES[section], lang)}</p>
        <p className="mt-1 text-xs italic text-white/30">{patientText(PATIENT_UI.noInfo, lang)}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="border-b border-white/8 bg-white/[0.04] px-4 py-3">
        <p className="text-xs font-bold text-white">{patientText(PATIENT_SECTION_TITLES[section], lang)}</p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {entries.map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
            <p className="mt-0.5 text-sm text-white/80 whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatientAssessmentClient() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");

  const [req, setReq] = useState<RemoteAssessmentRequest | null>(null);
  const [tokenState, setTokenState] = useState<"loading" | "valid" | "invalid">("loading");
  const [stage, setStage] = useState<Stage>("consent");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [consented, setConsented] = useState(false);
  const [draft, setDraft] = useState<PatientAssessmentDraft>(emptyDraft());
  const [lang, setLang] = useState<PatientLang>("en");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }

    let cancelled = false;

    void (async () => {
      const r = await getRemoteAssessment(token);
      if (cancelled) return;
      if (!r || isExpired(r) || r.status === "submitted") {
        setTokenState("invalid");
        return;
      }
      setReq(r);
      if (r.patientDraft) {
        setDraft({ ...emptyDraft(), ...r.patientDraft });
      }
      if (r.assessmentLanguage === "ar" || r.assessmentLanguage === "en") {
        setLang(r.assessmentLanguage);
      }
      setTokenState("valid");
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const autoSave = useCallback(
    (d: PatientAssessmentDraft, language: PatientLang) => {
      if (token) updateRemoteAssessmentDraft(token, d, language);
    },
    [token],
  );

  function handleLangChange(next: PatientLang) {
    setLang(next);
    autoSave(draft, next);
  }

  function updateSection(section: PatientSectionId, sectionData: Record<string, string>) {
    const next = { ...draft, [section]: sectionData } as PatientAssessmentDraft;
    setDraft(next);
    autoSave(next, lang);
  }

  async function handleSubmit() {
    if (!req) return;
    setSubmitting(true);
    setStage("submitting");
    try {
      await submitRemoteAssessment(token, draft, lang as AssessmentLanguage);
      router.push(`/assessment/${token}/complete`);
    } catch {
      setSubmitting(false);
      setStage("review");
    }
  }

  const sections = req?.includedSections ?? [];
  const currentSection = sections[sectionIdx] as PatientSectionId | undefined;
  const totalSections = sections.length;
  const progress = totalSections > 0 ? (sectionIdx / totalSections) * 100 : 0;
  const formDir = lang === "ar" ? "rtl" : "ltr";
  const formLang = lang === "ar" ? "ar" : "en";
  const fontClass = lang === "ar" ? arabicFont.className : "";

  if (tokenState === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#071a2f] px-6 text-center">
        <div className="mx-auto max-w-sm">
          <h1 className="text-xl font-bold text-white">{patientText(PATIENT_UI.linkUnavailable, lang)}</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">{patientText(PATIENT_UI.linkUnavailableBody, lang)}</p>
          <p className="mt-6 text-xs font-semibold text-cyan-400/70 tracking-wide">RASQ</p>
        </div>
      </div>
    );
  }

  if (tokenState === "loading" || !req) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071a2f]">
        <p className="text-sm text-white/40">{patientText(PATIENT_UI.verifying, lang)}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071a2f] text-white">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#071a2f]/90 px-5 backdrop-blur-md">
        <span className="text-sm font-bold tracking-[-0.03em] text-cyan-300">RASQ</span>
        {stage === "section" && (
          <span className="text-xs text-white/40">
            {sectionIdx + 1} {patientText(PATIENT_UI.sectionOf, lang)} {totalSections}{" "}
            {patientText(PATIENT_UI.sections, lang)}
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/50">
          {patientText(PATIENT_UI.remoteAssessment, lang)}
        </span>
      </header>

      {stage === "section" && (
        <div className="h-1 bg-white/[0.06]">
          <div
            className="h-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${progress + (1 / totalSections) * 100}%` }}
          />
        </div>
      )}

      <main className="mx-auto max-w-xl px-5 py-10">
        {/* Language toggle — visible on all stages after load */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {patientText(PATIENT_UI.languageLabel, lang)}
          </p>
          <LanguageToggle current={lang} onChange={handleLangChange} />
        </div>

        {stage === "consent" && (
          <div className={`space-y-7 ${fontClass}`} dir={formDir} lang={formLang}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">
                {ASSESSMENT_TYPE_LABELS[req.assessmentType]}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">{patientText(PATIENT_UI.yourRemoteAssessment, lang)}</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">{patientText(PATIENT_UI.welcomeBody, lang)}</p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/50">
                {patientText(PATIENT_UI.linkExpires, lang)}{" "}
                <span className="font-semibold text-white/80">
                  {daysUntilExpiry(req)} {patientText(PATIENT_UI.days, lang)}
                </span>
                . {patientText(PATIENT_UI.autoSaveProgress, lang)}
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                {patientText(PATIENT_UI.assessmentCovers, lang)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {req.includedSections.map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-bold text-cyan-300">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-white/80">
                      {patientText(PATIENT_SECTION_TITLES[s], lang)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 transition ${
                consented ? "border-cyan-300/25 bg-cyan-400/[0.06]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <span
                  onClick={() => setConsented((v) => !v)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                    consented ? "border-cyan-400 bg-cyan-400" : "border-white/25 bg-transparent"
                  }`}
                >
                  {consented && (
                    <svg className="h-3 w-3 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span className="cursor-pointer text-sm leading-5 text-white/75" onClick={() => setConsented((v) => !v)}>
                  {patientText(PATIENT_UI.consentLabel, lang)}
                </span>
              </label>
            </div>

            <p className="text-xs leading-5 text-white/35">{patientText(PATIENT_UI.disclaimer, lang)}</p>

            <button
              type="button"
              disabled={!consented}
              onClick={() => setStage("section")}
              className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {patientText(PATIENT_UI.beginAssessment, lang)}
            </button>
          </div>
        )}

        {stage === "section" && currentSection && (
          <div className="space-y-7">
            <div dir={formDir} lang={formLang} className={fontClass}>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">
                {patientText(PATIENT_UI.sectionHeader, lang)} {sectionIdx + 1} {patientText(PATIENT_UI.sectionOf, lang)}{" "}
                {totalSections}
              </p>
              <h2 className="mt-1.5 text-2xl font-bold text-white">
                {patientText(PATIENT_SECTION_TITLES[currentSection], lang)}
              </h2>
              <p className="mt-1.5 text-sm text-white/50">{patientText(PATIENT_UI.answerAccurately, lang)}</p>
            </div>

            <div
              className={`rounded-[22px] border border-white/10 bg-white/[0.03] p-5 ${fontClass}`}
              dir={formDir}
              lang={formLang}
            >
              <ConfigSectionForm
                section={currentSection}
                data={getSectionData(currentSection, draft)}
                onChange={(d) => updateSection(currentSection, d)}
                lang={lang}
              />
            </div>

            <div className="flex gap-3">
              {sectionIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setSectionIdx((i) => i - 1)}
                  className="flex-1 rounded-2xl border border-white/12 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {patientText(PATIENT_UI.previous, lang)}
                </button>
              )}
              {sectionIdx < totalSections - 1 ? (
                <button
                  type="button"
                  onClick={() => setSectionIdx((i) => i + 1)}
                  className="flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  {patientText(PATIENT_UI.nextSection, lang)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage("review")}
                  className="flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  {patientText(PATIENT_UI.reviewAnswers, lang)}
                </button>
              )}
            </div>

            <p className="text-center text-[11px] text-white/25">{patientText(PATIENT_UI.progressSaved, lang)}</p>
          </div>
        )}

        {stage === "review" && (
          <div className={`space-y-6 ${fontClass}`} dir={formDir} lang={formLang}>
            <div>
              <h2 className="text-2xl font-bold text-white">{patientText(PATIENT_UI.reviewTitle, lang)}</h2>
              <p className="mt-1.5 text-sm text-white/50">{patientText(PATIENT_UI.reviewSubtitle, lang)}</p>
            </div>

            {sections.map((s, i) => (
              <div key={s}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    {patientText(PATIENT_UI.sectionHeader, lang)} {i + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSectionIdx(i);
                      setStage("section");
                    }}
                    className="text-[11px] text-cyan-400/70 transition hover:text-cyan-300"
                  >
                    {patientText(PATIENT_UI.edit, lang)}
                  </button>
                </div>
                <ReviewSection section={s} data={draft} lang={lang} />
              </div>
            ))}

            <div className="pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {submitting ? patientText(PATIENT_UI.submitting, lang) : patientText(PATIENT_UI.submitAssessment, lang)}
              </button>
              <p className="mt-3 text-center text-xs text-white/30">{patientText(PATIENT_UI.submitOnceNote, lang)}</p>
            </div>
          </div>
        )}

        {stage === "submitting" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />
            <p className="text-sm text-white/60">{patientText(PATIENT_UI.sending, lang)}</p>
          </div>
        )}
      </main>
    </div>
  );
}
