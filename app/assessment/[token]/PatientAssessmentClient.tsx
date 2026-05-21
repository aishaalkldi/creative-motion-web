"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getRemoteAssessment,
  updateRemoteAssessmentDraft,
  submitRemoteAssessment,
  isExpired,
  daysUntilExpiry,
  PATIENT_SECTION_LABELS,
  ASSESSMENT_TYPE_LABELS,
  type RemoteAssessmentRequest,
  type PatientAssessmentDraft,
  type PatientSectionId,
} from "@/app/lib/api/remote-assessments";

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = "consent" | "section" | "review" | "submitting";

// ── Pain scale ─────────────────────────────────────────────────────────────────

function PainScale({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-white/40">
        <span>No pain</span>
        <span>Worst pain</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, i) => {
          const v = String(i);
          const isActive = value === v;
          const color =
            i === 0 ? "lime"
            : i <= 3 ? "lime"
            : i <= 6 ? "amber"
            : "rose";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(v)}
              className={`h-9 w-9 rounded-xl border text-sm font-bold transition ${
                isActive
                  ? color === "lime"   ? "border-lime-300/40 bg-lime-400/15 text-lime-200"
                  : color === "amber"  ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                  :                     "border-rose-300/40 bg-rose-400/15 text-rose-200"
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

// ── Field helpers ──────────────────────────────────────────────────────────────

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

// ── Section forms ──────────────────────────────────────────────────────────────

function PainForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["pain"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["pain"]>) => void;
}) {
  const p = <K extends keyof typeof data>(k: K, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <div>
        <Label>What is your main complaint or reason for this assessment?</Label>
        <TextArea value={data.chiefComplaint} onChange={(v) => p("chiefComplaint", v)} placeholder="e.g. Pain in my right knee after running…" />
      </div>
      <div>
        <Label>Where do you feel the pain or discomfort?</Label>
        <TextInput value={data.painLocation} onChange={(v) => p("painLocation", v)} placeholder="e.g. Right knee, outer side" />
      </div>
      <div>
        <Label>Right now, how would you rate your pain? (0 = no pain, 10 = worst)</Label>
        <PainScale value={data.painScore} onChange={(v) => p("painScore", v)} />
      </div>
      <div>
        <Label>What makes the pain worse?</Label>
        <Hint>Activities, positions, or times of day that increase your symptoms</Hint>
        <TextArea value={data.aggravating} onChange={(v) => p("aggravating", v)} placeholder="e.g. Going up stairs, sitting for long periods…" />
      </div>
      <div>
        <Label>What helps relieve the pain?</Label>
        <TextArea value={data.easing} onChange={(v) => p("easing", v)} placeholder="e.g. Rest, ice, gentle movement…" />
      </div>
      <div>
        <Label>How does this affect your daily life?</Label>
        <Hint>Work, exercise, sleep, hobbies — what can you no longer do comfortably?</Hint>
        <TextArea value={data.dailyImpact} onChange={(v) => p("dailyImpact", v)} placeholder="e.g. I can no longer jog or play with my kids…" rows={4} />
      </div>
      <div>
        <Label>What are your goals for this rehabilitation?</Label>
        <TextArea value={data.goals} onChange={(v) => p("goals", v)} placeholder="e.g. Return to football, walk without pain…" />
      </div>
    </div>
  );
}

function RomForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["rom"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["rom"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Describe any movements that feel restricted or limited</Label>
        <Hint>Think about bending, reaching, turning, or straightening your joints</Hint>
        <TextArea value={data.limitations} onChange={(v) => onChange({ ...data, limitations: v })}
          placeholder="e.g. I can't fully bend my knee past 90°, or straighten my arm completely…" rows={4} />
      </div>
      <div>
        <Label>Are there any movements that make your symptoms worse?</Label>
        <TextArea value={data.worseWith} onChange={(v) => onChange({ ...data, worseWith: v })}
          placeholder="e.g. Reaching overhead causes shoulder pain…" />
      </div>
    </div>
  );
}

function StrengthForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["strength"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["strength"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you notice any weakness in your muscles or limbs?</Label>
        <Hint>Where do you feel weak, and during which activities?</Hint>
        <TextArea value={data.weaknessDescription} onChange={(v) => onChange({ ...data, weaknessDescription: v })}
          placeholder="e.g. My left leg feels weak when climbing stairs…" rows={4} />
      </div>
      <div>
        <Label>Which activities are most affected by this weakness?</Label>
        <TextArea value={data.activitiesAffected} onChange={(v) => onChange({ ...data, activitiesAffected: v })}
          placeholder="e.g. Carrying groceries, lifting objects, pushing doors…" />
      </div>
    </div>
  );
}

function BalanceForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["balance"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["balance"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Do you have any difficulty with balance or stability?</Label>
        <Hint>Think about standing, turning, uneven surfaces, or low-light environments</Hint>
        <TextArea value={data.difficultyDescription} onChange={(v) => onChange({ ...data, difficultyDescription: v })}
          placeholder="e.g. I feel unsteady when standing on one leg or on uneven ground…" rows={4} />
      </div>
      <div>
        <Label>Have you had any falls in the past 6 months?</Label>
        <TextInput value={data.fallHistory} onChange={(v) => onChange({ ...data, fallHistory: v })}
          placeholder="e.g. No falls / 2 falls in the past 3 months…" />
      </div>
    </div>
  );
}

function GaitForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["gait"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["gait"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Describe how you walk and any difficulties you notice</Label>
        <Hint>Limping, pain while walking, uneven steps, fatigue after short distances</Hint>
        <TextArea value={data.walkingDescription} onChange={(v) => onChange({ ...data, walkingDescription: v })}
          placeholder="e.g. I limp on my right leg, especially after the first few steps…" rows={4} />
      </div>
      <div>
        <Label>Do you use any walking aids? (crutches, cane, brace, etc.)</Label>
        <TextInput value={data.aids} onChange={(v) => onChange({ ...data, aids: v })}
          placeholder="e.g. None / Right knee brace / Crutches on left side" />
      </div>
    </div>
  );
}

function FunctionalForm({
  data,
  onChange,
}: {
  data: NonNullable<PatientAssessmentDraft["functional"]>;
  onChange: (d: NonNullable<PatientAssessmentDraft["functional"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>How long can you stand comfortably without sitting down?</Label>
        <TextInput value={data.standingDuration} onChange={(v) => onChange({ ...data, standingDuration: v })}
          placeholder="e.g. 5 minutes / 30 minutes / all day without difficulty" />
      </div>
      <div>
        <Label>How far can you walk before pain or discomfort stops you?</Label>
        <TextInput value={data.walkingDistance} onChange={(v) => onChange({ ...data, walkingDistance: v })}
          placeholder="e.g. 100 metres / 2 blocks / unlimited" />
      </div>
      <div>
        <Label>Can you climb stairs? If yes, how difficult is it?</Label>
        <TextInput value={data.stairsAbility} onChange={(v) => onChange({ ...data, stairsAbility: v })}
          placeholder="e.g. Yes but slowly / Only one step at a time / Not at all" />
      </div>
      <div>
        <Label>Anything else you would like your therapist to know?</Label>
        <TextArea value={data.otherNotes} onChange={(v) => onChange({ ...data, otherNotes: v })}
          placeholder="Any other symptoms, concerns, or important context…" rows={3} />
      </div>
    </div>
  );
}

// ── Empty section defaults ─────────────────────────────────────────────────────

function emptyDraft(): PatientAssessmentDraft {
  return {
    pain:       { chiefComplaint: "", painLocation: "", painScore: "", aggravating: "", easing: "", dailyImpact: "", goals: "" },
    rom:        { limitations: "", worseWith: "" },
    strength:   { weaknessDescription: "", activitiesAffected: "" },
    balance:    { difficultyDescription: "", fallHistory: "" },
    gait:       { walkingDescription: "", aids: "" },
    functional: { standingDuration: "", walkingDistance: "", stairsAbility: "", otherNotes: "" },
  };
}

// ── Review summary ─────────────────────────────────────────────────────────────

function ReviewSection({
  section,
  data,
}: {
  section: PatientSectionId;
  data: PatientAssessmentDraft;
}) {
  const entries: { label: string; value: string }[] = [];

  switch (section) {
    case "pain":
      if (data.pain) {
        if (data.pain.chiefComplaint) entries.push({ label: "Main complaint", value: data.pain.chiefComplaint });
        if (data.pain.painLocation)   entries.push({ label: "Pain location", value: data.pain.painLocation });
        if (data.pain.painScore)      entries.push({ label: "Pain score", value: `${data.pain.painScore} / 10` });
        if (data.pain.aggravating)    entries.push({ label: "Makes it worse", value: data.pain.aggravating });
        if (data.pain.easing)         entries.push({ label: "Provides relief", value: data.pain.easing });
        if (data.pain.dailyImpact)    entries.push({ label: "Daily impact", value: data.pain.dailyImpact });
        if (data.pain.goals)          entries.push({ label: "Goals", value: data.pain.goals });
      }
      break;
    case "rom":
      if (data.rom) {
        if (data.rom.limitations) entries.push({ label: "Movement limitations", value: data.rom.limitations });
        if (data.rom.worseWith)   entries.push({ label: "Worsened by", value: data.rom.worseWith });
      }
      break;
    case "strength":
      if (data.strength) {
        if (data.strength.weaknessDescription) entries.push({ label: "Weakness", value: data.strength.weaknessDescription });
        if (data.strength.activitiesAffected)  entries.push({ label: "Affected activities", value: data.strength.activitiesAffected });
      }
      break;
    case "balance":
      if (data.balance) {
        if (data.balance.difficultyDescription) entries.push({ label: "Balance difficulty", value: data.balance.difficultyDescription });
        if (data.balance.fallHistory)           entries.push({ label: "Fall history", value: data.balance.fallHistory });
      }
      break;
    case "gait":
      if (data.gait) {
        if (data.gait.walkingDescription) entries.push({ label: "Walking pattern", value: data.gait.walkingDescription });
        if (data.gait.aids)               entries.push({ label: "Walking aids", value: data.gait.aids });
      }
      break;
    case "functional":
      if (data.functional) {
        if (data.functional.standingDuration) entries.push({ label: "Standing tolerance", value: data.functional.standingDuration });
        if (data.functional.walkingDistance)  entries.push({ label: "Walking distance", value: data.functional.walkingDistance });
        if (data.functional.stairsAbility)    entries.push({ label: "Stairs", value: data.functional.stairsAbility });
        if (data.functional.otherNotes)       entries.push({ label: "Additional notes", value: data.functional.otherNotes });
      }
      break;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold text-white/70">{PATIENT_SECTION_LABELS[section]}</p>
        <p className="mt-1 text-xs italic text-white/30">No information provided</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="border-b border-white/8 bg-white/[0.04] px-4 py-3">
        <p className="text-xs font-bold text-white">{PATIENT_SECTION_LABELS[section]}</p>
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

// ── Main client ────────────────────────────────────────────────────────────────

export function PatientAssessmentClient() {
  const params  = useParams();
  const router  = useRouter();
  const token   = String(params.token ?? "");

  const [req, setReq]           = useState<RemoteAssessmentRequest | null>(null);
  const [tokenState, setTokenState] = useState<"loading" | "valid" | "invalid">("loading");
  const [stage, setStage]       = useState<Stage>("consent");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [consented, setConsented]   = useState(false);
  const [draft, setDraft]       = useState<PatientAssessmentDraft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);

  // Load request
  useEffect(() => {
    if (!token) { setTokenState("invalid"); return; }
    const r = getRemoteAssessment(token);
    if (!r || isExpired(r) || r.status === "submitted") {
      setTokenState("invalid");
      return;
    }
    setReq(r);
    // Restore any saved draft
    if (r.patientDraft) {
      setDraft({ ...emptyDraft(), ...r.patientDraft });
    }
    setTokenState("valid");
  }, [token]);

  // Auto-save on draft change
  const autoSave = useCallback(
    (d: PatientAssessmentDraft) => {
      if (token) updateRemoteAssessmentDraft(token, d);
    },
    [token],
  );

  function updateDraft(patch: Partial<PatientAssessmentDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    autoSave(next);
  }

  async function handleSubmit() {
    if (!req) return;
    setSubmitting(true);
    setStage("submitting");
    try {
      submitRemoteAssessment(token, draft);
      router.push(`/assessment/${token}/complete`);
    } catch {
      setSubmitting(false);
      setStage("review");
    }
  }

  const sections = req?.includedSections ?? [];
  const currentSection = sections[sectionIdx] as PatientSectionId | undefined;
  const totalSections  = sections.length;
  const progress       = totalSections > 0 ? ((sectionIdx) / totalSections) * 100 : 0;

  // ── Invalid / expired / submitted ──
  if (tokenState === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#071a2f] px-6 text-center">
        <div className="mx-auto max-w-sm">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] mx-auto">
            <svg className="h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">This assessment link is no longer available.</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            The link may have expired, already been submitted, or does not exist.
            Please contact your healthcare provider for a new link.
          </p>
          <p className="mt-6 text-xs font-semibold text-cyan-400/70 tracking-wide">RASQ</p>
        </div>
      </div>
    );
  }

  if (tokenState === "loading" || !req) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071a2f]">
        <p className="text-sm text-white/40">Verifying assessment link…</p>
      </div>
    );
  }

  // ── Branded shell ──
  return (
    <div className="min-h-screen bg-[#071a2f] text-white">
      {/* Minimal branded header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#071a2f]/90 px-5 backdrop-blur-md">
        <span className="text-sm font-bold tracking-[-0.03em] text-cyan-300">RASQ</span>
        {stage === "section" && (
          <span className="text-xs text-white/40">
            {sectionIdx + 1} of {totalSections} sections
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/50">
          Remote Assessment
        </span>
      </header>

      {/* Progress bar (section stage only) */}
      {stage === "section" && (
        <div className="h-1 bg-white/[0.06]">
          <div
            className="h-full bg-cyan-400 transition-all duration-500"
            style={{ width: `${progress + (1 / totalSections) * 100}%` }}
          />
        </div>
      )}

      <main className="mx-auto max-w-xl px-5 py-10">

        {/* ── CONSENT STAGE ── */}
        {stage === "consent" && (
          <div className="space-y-7">
            {/* Welcome */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">
                {ASSESSMENT_TYPE_LABELS[req.assessmentType]}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">Your Remote Assessment</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Your healthcare provider has sent you this assessment to complete from home.
                Your answers will help them personalise your treatment plan.
              </p>
            </div>

            {/* Expiry */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <svg className="h-4 w-4 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-white/50">
                This link expires in{" "}
                <span className="font-semibold text-white/80">{daysUntilExpiry(req)} days</span>.
                Your progress is saved automatically.
              </p>
            </div>

            {/* What's included */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                This assessment covers
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
                    <span className="text-xs font-medium text-white/80">{PATIENT_SECTION_LABELS[s]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consent */}
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
                <span
                  className="cursor-pointer text-sm leading-5 text-white/75"
                  onClick={() => setConsented((v) => !v)}
                >
                  I confirm the information I provide is accurate to the best of my knowledge, and I consent to
                  sharing it with my healthcare provider for treatment purposes.
                </span>
              </label>
            </div>

            {/* Disclaimer */}
            <p className="text-xs leading-5 text-white/35">
              This assessment is not a medical diagnosis. Your answers will be reviewed by a qualified
              healthcare professional who will contact you with their findings and recommendations.
            </p>

            <button
              type="button"
              disabled={!consented}
              onClick={() => setStage("section")}
              className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Begin Assessment →
            </button>
          </div>
        )}

        {/* ── SECTION STAGE ── */}
        {stage === "section" && currentSection && (
          <div className="space-y-7">
            {/* Section header */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300/70">
                Section {sectionIdx + 1} of {totalSections}
              </p>
              <h2 className="mt-1.5 text-2xl font-bold text-white">
                {PATIENT_SECTION_LABELS[currentSection]}
              </h2>
              <p className="mt-1.5 text-sm text-white/50">
                Answer as accurately as you can. You can edit your answers on the review page.
              </p>
            </div>

            {/* Section form */}
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5">
              {currentSection === "pain" && (
                <PainForm data={draft.pain ?? emptyDraft().pain!} onChange={(d) => updateDraft({ pain: d })} />
              )}
              {currentSection === "rom" && (
                <RomForm data={draft.rom ?? emptyDraft().rom!} onChange={(d) => updateDraft({ rom: d })} />
              )}
              {currentSection === "strength" && (
                <StrengthForm data={draft.strength ?? emptyDraft().strength!} onChange={(d) => updateDraft({ strength: d })} />
              )}
              {currentSection === "balance" && (
                <BalanceForm data={draft.balance ?? emptyDraft().balance!} onChange={(d) => updateDraft({ balance: d })} />
              )}
              {currentSection === "gait" && (
                <GaitForm data={draft.gait ?? emptyDraft().gait!} onChange={(d) => updateDraft({ gait: d })} />
              )}
              {currentSection === "functional" && (
                <FunctionalForm data={draft.functional ?? emptyDraft().functional!} onChange={(d) => updateDraft({ functional: d })} />
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {sectionIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setSectionIdx((i) => i - 1)}
                  className="flex-1 rounded-2xl border border-white/12 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  ← Previous
                </button>
              )}
              {sectionIdx < totalSections - 1 ? (
                <button
                  type="button"
                  onClick={() => setSectionIdx((i) => i + 1)}
                  className="flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Next Section →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage("review")}
                  className="flex-1 rounded-2xl bg-cyan-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Review Answers →
                </button>
              )}
            </div>

            {/* Auto-save indicator */}
            <p className="text-center text-[11px] text-white/25">
              Your progress is saved automatically
            </p>
          </div>
        )}

        {/* ── REVIEW STAGE ── */}
        {stage === "review" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Review Your Answers</h2>
              <p className="mt-1.5 text-sm text-white/50">
                Check your answers below. Click any section to go back and edit.
              </p>
            </div>

            {sections.map((s, i) => (
              <div key={s}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    Section {i + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSectionIdx(i); setStage("section"); }}
                    className="text-[11px] text-cyan-400/70 transition hover:text-cyan-300"
                  >
                    Edit
                  </button>
                </div>
                <ReviewSection section={s} data={draft} />
              </div>
            ))}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Assessment →"}
              </button>
              <p className="mt-3 text-center text-xs text-white/30">
                Once submitted, you will not be able to edit your answers.
              </p>
            </div>
          </div>
        )}

        {/* ── SUBMITTING STAGE ── */}
        {stage === "submitting" && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />
            <p className="text-sm text-white/60">Sending your assessment to your therapist…</p>
          </div>
        )}

      </main>
    </div>
  );
}
