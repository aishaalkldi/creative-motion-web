"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  submitRemoteAssessment,
  type AssessmentLanguage,
} from "@/app/lib/api/remote-assessments";
import { LanguageToggle, type PatientLang } from "@/app/components/patient/LanguageToggle";
import { TrustFooter } from "@/app/components/trust/TrustFooter";
import { trustFooterUi } from "@/app/lib/patient-portal-ui";
import {
  ASSISTANCE_TYPE_LABELS,
  ASSISTANCE_TYPE_STEP_TITLE,
  ASSISTIVE_DEVICE_LABELS,
  ASSISTIVE_DEVICE_OTHER_LABEL,
  ASSISTIVE_DEVICE_STEP_TITLE,
  COMMUNICATION_SUPPORT_LABELS,
  COMMUNICATION_SUPPORT_OTHER_LABEL,
  COMMUNICATION_SUPPORT_STEP_TITLE,
  FUNCTIONAL_ABILITY_LABELS,
  FUNCTIONAL_GOAL_HINT,
  FUNCTIONAL_GOAL_PLACEHOLDER,
  FUNCTIONAL_GOAL_STEP_TITLE,
  FUNCTIONAL_GOAL_TOO_SHORT,
  FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE,
  FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE,
  FUNCTIONAL_INTAKE_SCREEN_TITLES,
  FUNCTIONAL_INTAKE_SUBMITTED_NOTICE,
  MORE_AFFECTED_SIDE_LABELS,
  MORE_AFFECTED_SIDE_STEP_TITLE,
  POST_STROKE_CONSENT_BODY,
  POST_STROKE_INTAKE_TITLE,
  POST_STROKE_UI,
  RECENT_FALLS_LABELS,
  RECENT_FALLS_STEP_TITLE,
  RESPONDENT_SOURCE_CLARIFICATION,
  RESPONDENT_STEP_TITLE,
  RESPONDENT_TYPE_HINT,
  RESPONDENT_TYPE_LABELS,
  REVIEW_EDIT_LABEL,
  REVIEW_STEP_TITLE,
  SITTING_ABILITY_STEP_TITLE,
  STANDING_ABILITY_STEP_TITLE,
  SUBMIT_FUNCTIONAL_INTAKE_LABEL,
  UPPER_LIMB_USE_LABELS,
  UPPER_LIMB_USE_STEP_TITLE,
  URGENT_GATE_STEP_HINT,
  URGENT_GATE_STEP_TITLE,
  URGENT_STOP_SCREEN,
  URGENT_STOP_SCREEN_ORDER,
  URGENT_SYMPTOM_LABELS,
  WALKING_ABILITY_LABELS,
  WALKING_ABILITY_STEP_TITLE,
  patientText,
} from "@/app/lib/post-stroke-intake/questions";
import { evaluateUrgentGate, NO_NEW_URGENT_SYMPTOMS, URGENT_SYMPTOM_VALUES } from "@/app/lib/post-stroke-intake/urgent-gate";
import {
  firstIncompleteFunctionalIntakeScreen,
  getVisibleAssistanceTypes,
  isAssistanceTypeValidForRespondent,
  isFunctionalIntakeComplete,
  POST_STROKE_ASSISTIVE_DEVICE_VALUES,
  POST_STROKE_COMMUNICATION_SUPPORT_VALUES,
  POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES,
  POST_STROKE_FUNCTIONAL_ABILITY_VALUES,
  POST_STROKE_MORE_AFFECTED_SIDE_VALUES,
  POST_STROKE_UPPER_LIMB_USE_VALUES,
  POST_STROKE_WALKING_ABILITY_VALUES,
  shouldShowAssistanceTypeSection,
  type PostStrokeAssistanceType,
  type PostStrokeFunctionalIntake,
  type PostStrokeRespondentType,
  type PostStrokeUrgentGateResult,
  type PostStrokeUrgentSymptom,
} from "@/app/lib/post-stroke-intake/types";

type TokenState = "loading" | "valid" | "invalid";
type Stage =
  | "respondent"
  | "urgent_gate"
  | "stopped"
  | "cleared_placeholder"
  | "functional_screen_1"
  | "functional_screen_2"
  | "functional_screen_3"
  | "functional_submitted";

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

/** A single-line free-text input matching the option-card visual language. */
function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/30 transition ${FOCUS_RING}`}
    />
  );
}

/** A multi-line free-text input for the functional goal — same visual language as TextField. */
function TextAreaField({
  value,
  onChange,
  placeholder,
  maxLength,
  dir,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  dir?: "rtl" | "ltr";
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      dir={dir}
      rows={3}
      className={`w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/30 transition ${FOCUS_RING}`}
    />
  );
}

/** One line of the Screen 3 compact review — label, the answer given, and a jump-back-to-edit affordance. */
function ReviewRow({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        <p className="text-white/45">{label}</p>
        <p className="font-medium text-white">{value || "—"}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className={`shrink-0 rounded-full border border-white/12 px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/10 ${FOCUS_RING}`}
      >
        {editLabel}
      </button>
    </div>
  );
}

/** Non-verdict framing shown throughout the Stage 3 screens — never cleared/safe/approved. */
function PatientReportedNotice({ lang, proseLeading }: { lang: PatientLang; proseLeading: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <p className={`text-xs ${proseLeading} text-white/60`}>{patientText(FUNCTIONAL_INTAKE_INCOMPLETE_NOTICE, lang)}</p>
      <p className={`text-xs ${proseLeading} text-white/60`}>{patientText(FUNCTIONAL_INTAKE_REVIEW_REQUIRED_NOTICE, lang)}</p>
    </div>
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

  // Partial no-urgent draft save (separate from the terminal urgent-stop submit above).
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  // Stage 3 — minimal functional intake. Populated fresh, or hydrated from an
  // existing linked draft on resume (see the token-loading effect below).
  const [functionalIntake, setFunctionalIntake] = useState<Partial<PostStrokeFunctionalIntake>>({});
  const [screen1Error, setScreen1Error] = useState<string | null>(null);
  const [screen2Error, setScreen2Error] = useState<string | null>(null);
  const [screen3Error, setScreen3Error] = useState<string | null>(null);

  // Final Stage 3 submission (explicit action, never inferred from completeness).
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [finalSubmitError, setFinalSubmitError] = useState<string | null>(null);
  const finalSubmitSubmittedRef = useRef(false);

  // Local-only — never continues the intake or changes any persisted state.
  const [helpAcknowledged, setHelpAcknowledged] = useState(false);

  // One-shot guards against a rapid double-click or re-render submitting the
  // same urgent stop / draft save twice. Refs (not state) so the check-and-set
  // is synchronous within a single event handler invocation — no render can
  // race it. Cleared only on an explicit user-initiated retry after failure.
  const urgentStopSubmittedRef = useRef(false);
  const noUrgentDraftSubmittedRef = useRef(false);
  const stoppedGateResultRef = useRef<PostStrokeUrgentGateResult | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    let cancelled = false;
    void (async () => {
      let res: Response;
      try {
        res = await fetch(`/api/remote-assessments/${encodeURIComponent(token)}`);
      } catch {
        if (!cancelled) setTokenState("invalid");
        return;
      }
      if (cancelled) return;
      if (!res.ok) {
        setTokenState("invalid");
        return;
      }

      type ResumableDraft = {
        respondent?: { type: PostStrokeRespondentType; assistanceType?: PostStrokeAssistanceType };
        urgentGate?: { symptoms: PostStrokeUrgentSymptom[]; stopped: boolean };
        functionalIntake?: Partial<PostStrokeFunctionalIntake>;
        assessmentLanguage?: "en" | "ar";
      };
      const data = (await res.json()) as { draft?: ResumableDraft };
      setTokenState("valid");

      // Reopening the same pending token restores the saved answers and
      // returns to the first incomplete screen — it never creates another
      // assessment; assessment_id stays linked server-side and is never sent
      // to this client at all.
      const draft = data.draft;
      if (!draft || !draft.respondent || !draft.urgentGate || draft.urgentGate.stopped !== false) return;

      if (draft.assessmentLanguage) setLang(draft.assessmentLanguage);
      setRespondentType(draft.respondent.type);
      setAssistanceType(draft.respondent.assistanceType);
      setSelectedSymptoms(draft.urgentGate.symptoms);

      const resumedFunctionalIntake = draft.functionalIntake ?? {};
      setFunctionalIntake(resumedFunctionalIntake);
      const nextScreen = firstIncompleteFunctionalIntakeScreen(resumedFunctionalIntake);
      setStage(
        nextScreen === 1 ? "functional_screen_1" : nextScreen === 2 ? "functional_screen_2" : "functional_screen_3",
      );
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

  /**
   * Persists the partial no-urgent draft (assessments.status = "draft",
   * urgentGate.stopped = false). Guarded the same way as submitUrgentStop —
   * a one-shot ref plus an explicit retry-only reset on failure. Uses a
   * dedicated draft-save endpoint (not /submit) so the request never becomes
   * "submitted" and the token stays reusable for a later Stage 3 resume.
   * The server independently revalidates and recomputes stopped/flags/
   * recordedAt regardless of what is sent here. On success, advances straight
   * into Stage 3 (screen 1) rather than stopping at a dead-end placeholder.
   */
  async function saveNoUrgentDraft() {
    if (!respondentType) return;
    if (noUrgentDraftSubmittedRef.current) return;
    noUrgentDraftSubmittedRef.current = true;

    setDraftSaving(true);
    setDraftSaveError(null);
    try {
      const res = await fetch(`/api/remote-assessments/${encodeURIComponent(token)}/save-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredData: {
            postStrokeIntake: {
              respondent: { type: respondentType, assistanceType },
              urgentGate: { symptoms: [NO_NEW_URGENT_SYMPTOMS] },
            },
            assessmentLanguage: lang,
          },
        }),
      });
      if (!res.ok) throw new Error("save-draft failed");
      setDraftSaved(true);
      setStage("functional_screen_1");
    } catch {
      // Allow exactly one explicit retry action to try again — never an automatic one.
      noUrgentDraftSubmittedRef.current = false;
      setDraftSaveError(patientText(POST_STROKE_UI.submitError, lang));
    } finally {
      setDraftSaving(false);
    }
  }

  /**
   * Saves the full known Stage 3 state so far (respondent + cleared urgent
   * gate + functionalIntake accumulated across screens) via the same
   * save-draft endpoint used by the Stage 2 no-urgent draft. Same
   * rebuild-from-input contract: the client always resends everything it
   * knows, so an earlier screen's answers are preserved by resending them,
   * never by a server-side merge.
   */
  async function saveFunctionalDraft(next: Partial<PostStrokeFunctionalIntake>): Promise<boolean> {
    if (!respondentType) return false;
    setDraftSaving(true);
    setDraftSaveError(null);
    try {
      const res = await fetch(`/api/remote-assessments/${encodeURIComponent(token)}/save-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredData: {
            postStrokeIntake: {
              respondent: { type: respondentType, assistanceType },
              urgentGate: { symptoms: [NO_NEW_URGENT_SYMPTOMS] },
              functionalIntake: next,
            },
            assessmentLanguage: lang,
          },
        }),
      });
      if (!res.ok) throw new Error("save-draft failed");
      return true;
    } catch {
      setDraftSaveError(patientText(POST_STROKE_UI.submitError, lang));
      return false;
    } finally {
      setDraftSaving(false);
    }
  }

  /**
   * Final Stage 3 submission — an explicit action, never inferred merely
   * because every field is present. Guarded the same one-shot-ref way as
   * submitUrgentStop/saveNoUrgentDraft. The server independently revalidates
   * completeness and recomputes every timestamp/flag regardless of what is
   * sent here.
   */
  async function submitFunctionalIntake() {
    if (!respondentType) return;
    if (finalSubmitSubmittedRef.current) return;
    finalSubmitSubmittedRef.current = true;

    setFinalSubmitting(true);
    setFinalSubmitError(null);
    try {
      const res = await fetch(`/api/remote-assessments/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_post_stroke_intake",
          structuredData: {
            postStrokeIntake: {
              respondent: { type: respondentType, assistanceType },
              urgentGate: { symptoms: [NO_NEW_URGENT_SYMPTOMS] },
              functionalIntake,
            },
            assessmentLanguage: lang,
          },
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStage("functional_submitted");
    } catch {
      // Allow exactly one explicit retry action to try again — never an automatic one.
      finalSubmitSubmittedRef.current = false;
      setFinalSubmitError(patientText(POST_STROKE_UI.submitError, lang));
    } finally {
      setFinalSubmitting(false);
    }
  }

  function updateFunctionalIntake(patch: Partial<PostStrokeFunctionalIntake>) {
    setFunctionalIntake((prev) => ({ ...prev, ...patch }));
  }

  async function handleFunctionalScreen1Continue() {
    const fi = functionalIntake;
    const requiredMissing =
      !fi.moreAffectedSide ||
      !fi.sittingAbility ||
      !fi.standingAbility ||
      !fi.walkingAbility ||
      !fi.assistiveDevice ||
      !fi.recentFalls;
    if (requiredMissing) {
      setScreen1Error(patientText(POST_STROKE_UI.completeRequiredFields, lang));
      return;
    }
    if (fi.assistiveDevice === "other" && !fi.assistiveDeviceOtherText?.trim()) {
      setScreen1Error(patientText(POST_STROKE_UI.otherTextRequired, lang));
      return;
    }
    setScreen1Error(null);
    if (await saveFunctionalDraft(fi)) setStage("functional_screen_2");
  }

  async function handleFunctionalScreen2Continue() {
    const fi = functionalIntake;
    if (!fi.upperLimbUse || !fi.communicationSupport) {
      setScreen2Error(patientText(POST_STROKE_UI.completeRequiredFields, lang));
      return;
    }
    if (fi.communicationSupport === "other" && !fi.communicationSupportOtherText?.trim()) {
      setScreen2Error(patientText(POST_STROKE_UI.otherTextRequired, lang));
      return;
    }
    setScreen2Error(null);
    if (await saveFunctionalDraft(fi)) setStage("functional_screen_3");
  }

  function handleFunctionalGoalChange(value: string) {
    setScreen3Error(null);
    updateFunctionalIntake({ functionalGoal: value });
  }

  async function handleFinalSubmit() {
    const goal = functionalIntake.functionalGoal?.trim() ?? "";
    if (goal.length < 2) {
      setScreen3Error(patientText(FUNCTIONAL_GOAL_TOO_SHORT, lang));
      return;
    }
    if (!isFunctionalIntakeComplete(functionalIntake)) {
      setScreen3Error(patientText(POST_STROKE_UI.completeRequiredFields, lang));
      return;
    }
    setScreen3Error(null);
    await submitFunctionalIntake();
  }

  async function handleUrgentGateContinue() {
    if (selectedSymptoms.length === 0) {
      setSymptomError(patientText(POST_STROKE_UI.selectSymptomRequired, lang));
      return;
    }
    setSymptomError(null);

    const gateResult = evaluateUrgentGate(selectedSymptoms);

    if (!gateResult.stopped) {
      // Briefly shows the "saving" transition, then advances into Stage 3
      // (screen 1) once the partial draft is persisted so it can be resumed.
      setStage("cleared_placeholder");
      await saveNoUrgentDraft();
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
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {draftSaved ? (
              <h2 className={`text-xl font-bold ${proseLeading} text-white`}>
                {patientText(POST_STROKE_UI.noUrgentDraftSavedNotice, lang)}
              </h2>
            ) : draftSaving ? (
              <p className="text-sm text-white/60">{patientText(POST_STROKE_UI.submitting, lang)}</p>
            ) : null}

            {draftSaveError ? (
              <>
                <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                  {draftSaveError}
                </p>
                <button
                  type="button"
                  disabled={draftSaving}
                  onClick={() => void saveNoUrgentDraft()}
                  className={`w-full rounded-2xl border border-white/12 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {patientText(POST_STROKE_UI.retry, lang)}
                </button>
              </>
            ) : null}
          </div>
        )}

        {stage === "functional_screen_1" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">
              {patientText(FUNCTIONAL_INTAKE_SCREEN_TITLES.mobility, lang)}
            </h2>
            <PatientReportedNotice lang={lang} proseLeading={proseLeading} />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(MORE_AFFECTED_SIDE_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_MORE_AFFECTED_SIDE_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.moreAffectedSide === value}
                      label={patientText(MORE_AFFECTED_SIDE_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ moreAffectedSide: value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(SITTING_ABILITY_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_FUNCTIONAL_ABILITY_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.sittingAbility === value}
                      label={patientText(FUNCTIONAL_ABILITY_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ sittingAbility: value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(STANDING_ABILITY_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_FUNCTIONAL_ABILITY_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.standingAbility === value}
                      label={patientText(FUNCTIONAL_ABILITY_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ standingAbility: value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(WALKING_ABILITY_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_WALKING_ABILITY_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.walkingAbility === value}
                      label={patientText(WALKING_ABILITY_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ walkingAbility: value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(ASSISTIVE_DEVICE_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_ASSISTIVE_DEVICE_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.assistiveDevice === value}
                      label={patientText(ASSISTIVE_DEVICE_LABELS[value], lang)}
                      onClick={() =>
                        updateFunctionalIntake({
                          assistiveDevice: value,
                          ...(value !== "other" ? { assistiveDeviceOtherText: undefined } : {}),
                        })
                      }
                    />
                  ))}
                </div>
                {functionalIntake.assistiveDevice === "other" ? (
                  <div className="mt-2">
                    <TextField
                      value={functionalIntake.assistiveDeviceOtherText ?? ""}
                      onChange={(value) => updateFunctionalIntake({ assistiveDeviceOtherText: value })}
                      placeholder={patientText(ASSISTIVE_DEVICE_OTHER_LABEL, lang)}
                      maxLength={200}
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(RECENT_FALLS_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_FALLS_OR_NEAR_FALLS_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.recentFalls === value}
                      label={patientText(RECENT_FALLS_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ recentFalls: value })}
                    />
                  ))}
                </div>
              </div>
            </div>

            {screen1Error ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {screen1Error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={draftSaving}
              onClick={() => void handleFunctionalScreen1Continue()}
              className={`w-full rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 ${FOCUS_RING}`}
            >
              {draftSaving ? patientText(POST_STROKE_UI.submitting, lang) : patientText(POST_STROKE_UI.continueLabel, lang)}
            </button>
          </div>
        )}

        {stage === "functional_screen_2" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">
              {patientText(FUNCTIONAL_INTAKE_SCREEN_TITLES.upperLimbAndCommunication, lang)}
            </h2>
            <PatientReportedNotice lang={lang} proseLeading={proseLeading} />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(UPPER_LIMB_USE_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_UPPER_LIMB_USE_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.upperLimbUse === value}
                      label={patientText(UPPER_LIMB_USE_LABELS[value], lang)}
                      onClick={() => updateFunctionalIntake({ upperLimbUse: value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  {patientText(COMMUNICATION_SUPPORT_STEP_TITLE, lang)}
                </h3>
                <div className="mt-2 space-y-2">
                  {POST_STROKE_COMMUNICATION_SUPPORT_VALUES.map((value) => (
                    <RadioOption
                      key={value}
                      selected={functionalIntake.communicationSupport === value}
                      label={patientText(COMMUNICATION_SUPPORT_LABELS[value], lang)}
                      onClick={() =>
                        updateFunctionalIntake({
                          communicationSupport: value,
                          ...(value !== "other" ? { communicationSupportOtherText: undefined } : {}),
                        })
                      }
                    />
                  ))}
                </div>
                {functionalIntake.communicationSupport === "other" ? (
                  <div className="mt-2">
                    <TextField
                      value={functionalIntake.communicationSupportOtherText ?? ""}
                      onChange={(value) => updateFunctionalIntake({ communicationSupportOtherText: value })}
                      placeholder={patientText(COMMUNICATION_SUPPORT_OTHER_LABEL, lang)}
                      maxLength={200}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {screen2Error ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {screen2Error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage("functional_screen_1")}
                className={`flex-1 rounded-2xl border border-white/12 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 ${FOCUS_RING}`}
              >
                {patientText(POST_STROKE_UI.back, lang)}
              </button>
              <button
                type="button"
                disabled={draftSaving}
                onClick={() => void handleFunctionalScreen2Continue()}
                className={`flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {draftSaving ? patientText(POST_STROKE_UI.submitting, lang) : patientText(POST_STROKE_UI.continueLabel, lang)}
              </button>
            </div>
          </div>
        )}

        {stage === "functional_screen_3" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">
              {patientText(FUNCTIONAL_INTAKE_SCREEN_TITLES.functionalGoal, lang)}
            </h2>

            <div>
              <h3 className="text-sm font-semibold text-white/80">{patientText(FUNCTIONAL_GOAL_STEP_TITLE, lang)}</h3>
              <p className={`mt-1 text-sm ${proseLeading} text-white/45`}>{patientText(FUNCTIONAL_GOAL_HINT, lang)}</p>
              <div className="mt-2">
                <TextAreaField
                  value={functionalIntake.functionalGoal ?? ""}
                  onChange={handleFunctionalGoalChange}
                  placeholder={patientText(FUNCTIONAL_GOAL_PLACEHOLDER, lang)}
                  maxLength={500}
                  dir={formDir}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white/80">{patientText(REVIEW_STEP_TITLE, lang)}</h3>
              <ReviewRow
                label={patientText(MORE_AFFECTED_SIDE_STEP_TITLE, lang)}
                value={functionalIntake.moreAffectedSide ? patientText(MORE_AFFECTED_SIDE_LABELS[functionalIntake.moreAffectedSide], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(SITTING_ABILITY_STEP_TITLE, lang)}
                value={functionalIntake.sittingAbility ? patientText(FUNCTIONAL_ABILITY_LABELS[functionalIntake.sittingAbility], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(STANDING_ABILITY_STEP_TITLE, lang)}
                value={functionalIntake.standingAbility ? patientText(FUNCTIONAL_ABILITY_LABELS[functionalIntake.standingAbility], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(WALKING_ABILITY_STEP_TITLE, lang)}
                value={functionalIntake.walkingAbility ? patientText(WALKING_ABILITY_LABELS[functionalIntake.walkingAbility], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(ASSISTIVE_DEVICE_STEP_TITLE, lang)}
                value={functionalIntake.assistiveDevice ? patientText(ASSISTIVE_DEVICE_LABELS[functionalIntake.assistiveDevice], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(RECENT_FALLS_STEP_TITLE, lang)}
                value={functionalIntake.recentFalls ? patientText(RECENT_FALLS_LABELS[functionalIntake.recentFalls], lang) : ""}
                onEdit={() => setStage("functional_screen_1")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(UPPER_LIMB_USE_STEP_TITLE, lang)}
                value={functionalIntake.upperLimbUse ? patientText(UPPER_LIMB_USE_LABELS[functionalIntake.upperLimbUse], lang) : ""}
                onEdit={() => setStage("functional_screen_2")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
              <ReviewRow
                label={patientText(COMMUNICATION_SUPPORT_STEP_TITLE, lang)}
                value={
                  functionalIntake.communicationSupport
                    ? patientText(COMMUNICATION_SUPPORT_LABELS[functionalIntake.communicationSupport], lang)
                    : ""
                }
                onEdit={() => setStage("functional_screen_2")}
                editLabel={patientText(REVIEW_EDIT_LABEL, lang)}
              />
            </div>

            <PatientReportedNotice lang={lang} proseLeading={proseLeading} />

            {screen3Error ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {screen3Error}
              </p>
            ) : null}

            {finalSubmitError ? (
              <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {finalSubmitError}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage("functional_screen_2")}
                className={`flex-1 rounded-2xl border border-white/12 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 ${FOCUS_RING}`}
              >
                {patientText(POST_STROKE_UI.back, lang)}
              </button>
              <button
                type="button"
                disabled={finalSubmitting}
                onClick={() => void handleFinalSubmit()}
                className={`flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {finalSubmitting
                  ? patientText(POST_STROKE_UI.submitting, lang)
                  : patientText(SUBMIT_FUNCTIONAL_INTAKE_LABEL, lang)}
              </button>
            </div>
          </div>
        )}

        {stage === "functional_submitted" && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className={`text-xl font-bold ${proseLeading} text-white`}>
              {patientText(FUNCTIONAL_INTAKE_SUBMITTED_NOTICE, lang)}
            </h2>
          </div>
        )}
      </main>

      <TrustFooter variant="dark" labels={trustFooterUi(lang)} className="mx-auto w-full max-w-xl px-5 pb-8" />
    </div>
  );
}
