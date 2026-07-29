"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getRemoteAssessment,
  isExpired,
  submitRemoteAssessment,
  type AssessmentLanguage,
} from "@/app/lib/api/remote-assessments";
import { LanguageToggle, type PatientLang } from "@/app/components/patient/LanguageToggle";
import { TrustFooter } from "@/app/components/trust/TrustFooter";
import { trustFooterUi } from "@/app/lib/patient-portal-ui";
import {
  ASSISTANCE_TYPE_LABELS,
  ASSISTANCE_TYPE_STEP_TITLE,
  POST_STROKE_CONSENT_BODY,
  POST_STROKE_INTAKE_TITLE,
  POST_STROKE_UI,
  RESPONDENT_SOURCE_CLARIFICATION,
  RESPONDENT_STEP_TITLE,
  RESPONDENT_TYPE_HINT,
  RESPONDENT_TYPE_LABELS,
  URGENT_GATE_STEP_HINT,
  URGENT_GATE_STEP_TITLE,
  URGENT_STOP_SCREEN,
  URGENT_STOP_SCREEN_ORDER,
  URGENT_SYMPTOM_LABELS,
  patientText,
} from "@/app/lib/post-stroke-intake/questions";
import { evaluateUrgentGate, NO_NEW_URGENT_SYMPTOMS, URGENT_SYMPTOM_VALUES } from "@/app/lib/post-stroke-intake/urgent-gate";
import {
  getVisibleAssistanceTypes,
  isAssistanceTypeValidForRespondent,
  shouldShowAssistanceTypeSection,
  type PostStrokeAssistanceType,
  type PostStrokeRespondentType,
  type PostStrokeUrgentGateResult,
  type PostStrokeUrgentSymptom,
} from "@/app/lib/post-stroke-intake/types";

type TokenState = "loading" | "valid" | "invalid";
type Stage = "respondent" | "urgent_gate" | "stopped" | "cleared_placeholder";

const RESPONDENT_TYPES: PostStrokeRespondentType[] = [
  "patient",
  "patient_with_caregiver_assistance",
  "caregiver_proxy",
];

/** Every real urgent symptom, excluding the exclusive "none of the above" option. */
const REAL_URGENT_SYMPTOMS: PostStrokeUrgentSymptom[] = URGENT_SYMPTOM_VALUES.filter(
  (symptom) => symptom !== NO_NEW_URGENT_SYMPTOMS,
);

/** Focus-visible ring shared by every interactive control on these screens. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a2f]";

function ConsentPanel({ lang, onAccept }: { lang: PatientLang; onAccept: () => void }) {
  const leading = lang === "ar" ? "leading-8" : "leading-6";
  return (
    <div className="mx-auto my-10 max-w-[480px] rounded-[10px] border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-semibold text-white">
        {patientText(POST_STROKE_INTAKE_TITLE, lang)}
      </h2>
      <div className={`mt-4 space-y-3 text-sm ${leading} text-white/70`}>
        {POST_STROKE_CONSENT_BODY.map((paragraph, i) => (
          <p key={i}>{patientText(paragraph, lang)}</p>
        ))}
      </div>
      <button
        type="button"
        onClick={onAccept}
        className={`mt-5 w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 ${FOCUS_RING}`}
      >
        {patientText(POST_STROKE_UI.beginLabel, lang)}
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3 w-3">
      <path
        d="M4 10.2l3.6 3.6L16 5.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A fully clickable option card. Selection is communicated by a checkmark
 * indicator plus a border/background change — never by color alone.
 */
function RadioOption({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-start text-sm transition ${FOCUS_RING} ${
        selected
          ? "border-cyan-300/40 bg-cyan-400/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
          selected ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/25 bg-transparent text-transparent"
        }`}
      >
        <CheckIcon />
      </span>
      <span className="flex-1">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="mt-1 block text-sm font-normal text-white/45">{hint}</span> : null}
      </span>
    </button>
  );
}

export function PostStrokeIntakeClient() {
  const params = useParams();
  const token = String(params.token ?? "");

  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [lang, setLang] = useState<PatientLang>("en");
  const [consentGiven, setConsentGiven] = useState(false);
  const [stage, setStage] = useState<Stage>("respondent");

  const [respondentType, setRespondentType] = useState<PostStrokeRespondentType | null>(null);
  const [assistanceType, setAssistanceType] = useState<PostStrokeAssistanceType | undefined>(undefined);
  const [respondentError, setRespondentError] = useState<string | null>(null);

  const [selectedSymptoms, setSelectedSymptoms] = useState<PostStrokeUrgentSymptom[]>([]);
  const [symptomError, setSymptomError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Local-only — never continues the intake or changes any persisted state.
  const [helpAcknowledged, setHelpAcknowledged] = useState(false);

  // One-shot guard against a rapid double-click or re-render submitting the
  // same urgent stop twice. A ref (not state) so the check-and-set is
  // synchronous within a single event handler invocation — no render can
  // race it. Cleared only on an explicit user-initiated retry after failure.
  const urgentStopSubmittedRef = useRef(false);
  const stoppedGateResultRef = useRef<PostStrokeUrgentGateResult | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    let cancelled = false;
    void (async () => {
      const req = await getRemoteAssessment(token);
      if (cancelled) return;
      if (!req || isExpired(req) || req.status === "submitted") {
        setTokenState("invalid");
        return;
      }
      setTokenState("valid");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function toggleSymptom(symptom: PostStrokeUrgentSymptom) {
    setSymptomError(null);
    setSelectedSymptoms((prev) => {
      if (symptom === NO_NEW_URGENT_SYMPTOMS) {
        // Exclusive — selecting "no new urgent symptoms" clears every other selection.
        return prev.includes(NO_NEW_URGENT_SYMPTOMS) ? [] : [NO_NEW_URGENT_SYMPTOMS];
      }
      // Selecting any real symptom clears the exclusive "none" option and toggles this one.
      const withoutNone = prev.filter((s) => s !== NO_NEW_URGENT_SYMPTOMS);
      return withoutNone.includes(symptom)
        ? withoutNone.filter((s) => s !== symptom)
        : [...withoutNone, symptom];
    });
  }

  /** Switching respondent type drops any assistance-type value that is no longer valid for it. */
  function handleRespondentTypeSelect(type: PostStrokeRespondentType) {
    setRespondentType(type);
    setRespondentError(null);
    setAssistanceType((prev) => (isAssistanceTypeValidForRespondent(prev, type) ? prev : undefined));
  }

  function handleRespondentContinue() {
    if (!respondentType) {
      setRespondentError(patientText(POST_STROKE_UI.selectRespondentRequired, lang));
      return;
    }
    setRespondentError(null);
    setStage("urgent_gate");
  }

  /**
   * Submits the recorded urgent stop. Guarded so neither a rapid double-click
   * nor a React re-render can create a second record; an explicit retry
   * (only reachable via the user-facing "Try again" button after a failure)
   * clears the guard immediately before re-attempting, so it still only ever
   * runs once at a time. The server independently recomputes and validates
   * stopped/flags/recordedAt regardless of what is sent here.
   */
  async function submitUrgentStop() {
    const gateResult = stoppedGateResultRef.current;
    if (!gateResult || !respondentType) return;
    if (urgentStopSubmittedRef.current) return;
    urgentStopSubmittedRef.current = true;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitRemoteAssessment(
        token,
        {
          postStrokeIntake: {
            respondent: { type: respondentType, assistanceType },
            urgentGate: gateResult,
          },
          assessmentLanguage: lang,
        },
        lang as AssessmentLanguage,
      );
    } catch {
      // Allow exactly one explicit retry action to try again — never an automatic one.
      urgentStopSubmittedRef.current = false;
      setSubmitError(patientText(POST_STROKE_UI.submitError, lang));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUrgentGateContinue() {
    if (selectedSymptoms.length === 0) {
      setSymptomError(patientText(POST_STROKE_UI.selectSymptomRequired, lang));
      return;
    }
    setSymptomError(null);

    const gateResult = evaluateUrgentGate(selectedSymptoms);

    if (!gateResult.stopped) {
      // Nothing more is implemented yet for a cleared intake in this stage —
      // no functional/communication/caregiver questions exist to reach.
      setStage("cleared_placeholder");
      return;
    }

    stoppedGateResultRef.current = gateResult;
    // Show the urgent-care instructions immediately — they must never wait on a network round trip.
    setStage("stopped");
    await submitUrgentStop();
  }

  const formDir = lang === "ar" ? "rtl" : "ltr";
  const proseLeading = lang === "ar" ? "leading-8" : "leading-6";
  const showAssistanceSection = shouldShowAssistanceTypeSection(respondentType);
  const visibleAssistanceTypes = getVisibleAssistanceTypes(respondentType);
  const respondentClarification = respondentType ? RESPONDENT_SOURCE_CLARIFICATION[respondentType] : undefined;

  if (tokenState === "invalid") {
    return (
      <div className="flex min-h-screen flex-col bg-[#071a2f] px-6 text-center text-white">
        <div className="flex flex-1 flex-col items-center justify-center">
          <h1 className="text-xl font-bold text-white">This link is no longer available.</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            The link may have expired, already been submitted, or does not exist. Please contact your
            healthcare provider for a new link.
          </p>
        </div>
        <TrustFooter variant="dark" labels={trustFooterUi(lang)} className="pb-8" />
      </div>
    );
  }

  if (tokenState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071a2f]">
        <p className="text-sm text-white/40">Verifying link…</p>
      </div>
    );
  }

  if (!consentGiven) {
    return (
      <div className="flex min-h-screen flex-col bg-[#071a2f] text-white">
        <header className="flex h-14 items-center justify-center border-b border-white/8 bg-[#071a2f]/90 px-5 backdrop-blur-md">
          <span className="text-sm font-bold tracking-[-0.03em] text-cyan-300">RASQ</span>
        </header>
        <div className="flex-1">
          <ConsentPanel lang={lang} onAccept={() => setConsentGiven(true)} />
        </div>
        <TrustFooter variant="dark" labels={trustFooterUi(lang)} className="mx-auto w-full max-w-xl px-5 pb-8" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#071a2f] text-white" dir={formDir}>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#071a2f]/90 px-5 backdrop-blur-md">
        <span className="text-sm font-bold tracking-[-0.03em] text-cyan-300">RASQ</span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/50">
          {patientText(POST_STROKE_INTAKE_TITLE, lang)}
        </span>
      </header>

      <main className="mx-auto w-full max-w-xl px-5 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Language</p>
          <LanguageToggle current={lang} onChange={setLang} />
        </div>

        {stage === "respondent" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{patientText(RESPONDENT_STEP_TITLE, lang)}</h2>
            <p className={`text-base ${proseLeading} text-white/50`}>{patientText(RESPONDENT_TYPE_HINT, lang)}</p>

            <div className="space-y-3">
              {RESPONDENT_TYPES.map((type) => (
                <RadioOption
                  key={type}
                  selected={respondentType === type}
                  label={patientText(RESPONDENT_TYPE_LABELS[type], lang)}
                  onClick={() => handleRespondentTypeSelect(type)}
                />
              ))}
            </div>

            {respondentClarification ? (
              <p className={`rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-3.5 py-3 text-sm ${proseLeading} text-cyan-100/90`}>
                {patientText(respondentClarification, lang)}
              </p>
            ) : null}

            {showAssistanceSection ? (
              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(ASSISTANCE_TYPE_STEP_TITLE, lang)}
                </h3>
                <div className="mt-3 space-y-2">
                  {visibleAssistanceTypes.map((type) => (
                    <RadioOption
                      key={type}
                      selected={assistanceType === type}
                      label={patientText(ASSISTANCE_TYPE_LABELS[type], lang)}
                      onClick={() => setAssistanceType((prev) => (prev === type ? undefined : type))}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {respondentError ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {respondentError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleRespondentContinue}
              className={`w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 ${FOCUS_RING}`}
            >
              {patientText(POST_STROKE_UI.continueLabel, lang)}
            </button>
          </div>
        )}

        {stage === "urgent_gate" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{patientText(URGENT_GATE_STEP_TITLE, lang)}</h2>
            <p className={`text-base ${proseLeading} text-white/50`}>{patientText(URGENT_GATE_STEP_HINT, lang)}</p>

            <div className="space-y-2">
              {REAL_URGENT_SYMPTOMS.map((symptom) => (
                <RadioOption
                  key={symptom}
                  selected={selectedSymptoms.includes(symptom)}
                  label={patientText(URGENT_SYMPTOM_LABELS[symptom], lang)}
                  onClick={() => toggleSymptom(symptom)}
                />
              ))}
            </div>

            {/* Visual separation for the exclusive "none of the above" option — neutral
                section treatment, not just color, so it reads as a distinct choice. */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-2">
              <RadioOption
                selected={selectedSymptoms.includes(NO_NEW_URGENT_SYMPTOMS)}
                label={patientText(URGENT_SYMPTOM_LABELS[NO_NEW_URGENT_SYMPTOMS], lang)}
                onClick={() => toggleSymptom(NO_NEW_URGENT_SYMPTOMS)}
              />
            </div>

            {symptomError ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {symptomError}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage("respondent")}
                className={`flex-1 rounded-2xl border border-white/12 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 ${FOCUS_RING}`}
              >
                {patientText(POST_STROKE_UI.back, lang)}
              </button>
              <button
                type="button"
                onClick={() => void handleUrgentGateContinue()}
                className={`flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 ${FOCUS_RING}`}
              >
                {patientText(POST_STROKE_UI.continueLabel, lang)}
              </button>
            </div>
          </div>
        )}

        {stage === "stopped" && (
          <div className="space-y-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-6">
            {URGENT_STOP_SCREEN_ORDER.map((key, index) => (
              <p
                key={key}
                className={
                  index === 0
                    ? `text-2xl font-bold ${proseLeading} text-rose-100`
                    : key === "disclaimer"
                      ? `text-xs italic ${proseLeading} text-rose-100/80`
                      : key === "noExercise" || key === "noWaitForTherapist"
                        ? `text-sm font-semibold ${proseLeading} text-rose-50`
                        : `text-sm ${proseLeading} text-rose-50`
                }
              >
                {patientText(URGENT_STOP_SCREEN[key], lang)}
              </p>
            ))}

            {submitting ? (
              <p className="text-xs text-rose-100/70">{patientText(POST_STROKE_UI.submitting, lang)}</p>
            ) : null}

            {submitError ? (
              <>
                <p className="rounded-[10px] border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-[11px] text-rose-50">
                  {submitError}
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitUrgentStop()}
                  className={`w-full rounded-2xl border border-rose-200/30 bg-rose-200/10 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-200/15 disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {patientText(POST_STROKE_UI.retry, lang)}
                </button>
              </>
            ) : null}

            {/* Local acknowledgement only — never advances the intake, never
                touches persisted state. Purely a UX closure for the patient. */}
            <button
              type="button"
              disabled={helpAcknowledged}
              onClick={() => setHelpAcknowledged(true)}
              className={`w-full rounded-2xl border py-3 text-sm font-semibold transition ${FOCUS_RING} ${
                helpAcknowledged
                  ? "border-rose-200/15 bg-transparent text-rose-100/50"
                  : "border-rose-200/30 bg-rose-200/10 text-rose-50 hover:bg-rose-200/15"
              }`}
            >
              {patientText(POST_STROKE_UI.acknowledgeHelp, lang)}
            </button>
          </div>
        )}

        {stage === "cleared_placeholder" && (
          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-bold text-white">{patientText(POST_STROKE_UI.moreQuestionsComingSoon, lang)}</h2>
          </div>
        )}
      </main>

      <TrustFooter variant="dark" labels={trustFooterUi(lang)} className="mx-auto w-full max-w-xl px-5 pb-8" />
    </div>
  );
}
