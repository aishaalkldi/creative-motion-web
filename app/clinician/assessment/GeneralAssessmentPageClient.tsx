"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPatient, type BackendPatient } from "@/app/lib/api";
import { createEmptyGeneralAssessmentDraft } from "@/app/lib/general-assessment/defaults";
import {
  loadGeneralAssessmentDraft,
  saveGeneralAssessmentDraft,
} from "@/app/lib/general-assessment/storage";
import type {
  CvRowStatus,
  FunctionalKey,
  GeneralAssessmentDraft,
  ObjectiveKey,
  OutcomeKey,
  SpecialTestEntry,
  SpecialTestResult,
} from "@/app/lib/general-assessment/types";
import {
  SPECIAL_TESTS_CATALOG,
  REGION_LABELS,
  REGION_ORDER,
  getTestsByRegion,
  countRegionResults,
  type SpecialTestRegion,
} from "@/app/lib/general-assessment/special-tests-catalog";
import {
  VoiceClinicalAssistant,
  type VoiceAssistantPayload,
} from "./VoiceClinicalAssistant";
import { VOICE_INTAKE_DISCLAIMER } from "@/app/lib/clinicalTranslation";

// ── Section config ──────────────────────────────────────────────────────────────

export type SectionId =
  | "pain"
  | "rom"
  | "strength"
  | "balance"
  | "gait"
  | "functional"
  | "special-tests"
  | "notes";

type SectionStatus = "completed" | "in-progress" | "pending";

interface SectionConfig {
  id: SectionId;
  title: string;
  description: string;
  icon: ReactNode;
  required: boolean;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "pain",
    title: "Pain & Subjective",
    description: "Chief complaint, pain location, NPRS, aggravating/easing factors, red flags",
    required: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    id: "rom",
    title: "Range of Motion",
    description: "ROM testing, CV measurement, LEFS and QuickDASH outcome scales",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    id: "strength",
    title: "Strength",
    description: "Squat analysis, sit-to-stand, step-down, PSFS outcome measure",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: "balance",
    title: "Balance",
    description: "Single-leg balance, postural assessment, balance CV analysis",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
  },
  {
    id: "gait",
    title: "Gait",
    description: "Gait analysis, TUG, gait speed, camera CV session",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    id: "functional",
    title: "Functional Tests",
    description: "5× Sit-to-Stand, squat, step-down, Oswestry and NDI outcome measures",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    id: "special-tests",
    title: "Special Tests",
    description: "Orthopaedic provocation tests grouped by body region — clinician-entered findings",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    id: "notes",
    title: "Clinical Notes",
    description: "SOAP documentation, AI reasoning, therapist review and final diagnosis",
    required: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

// ── Completion logic ────────────────────────────────────────────────────────────

function hasText(...values: string[]): boolean {
  return values.some((v) => v.trim().length > 0);
}

function cvStatus(s: CvRowStatus): SectionStatus {
  if (s === "completed") return "completed";
  if (s === "in_progress") return "in-progress";
  return "pending";
}

function funcSectionStatus(
  draft: GeneralAssessmentDraft,
  keys: FunctionalKey[],
): SectionStatus {
  const rows = keys.map((k) => draft.functional[k]);
  if (rows.some((r) => r.status === "completed")) return "completed";
  if (rows.some((r) => r.status === "in_progress" || r.result.trim())) return "in-progress";
  return "pending";
}

function objSectionStatus(
  draft: GeneralAssessmentDraft,
  keys: ObjectiveKey[],
): SectionStatus {
  const rows = keys.map((k) => draft.objective[k]);
  if (rows.some((r) => r.status === "completed")) return "completed";
  if (rows.some((r) => r.status === "in_progress" || r.result.trim())) return "in-progress";
  return "pending";
}

function getSectionStatus(id: SectionId, draft: GeneralAssessmentDraft): SectionStatus {
  const s = draft.subjective;
  switch (id) {
    case "pain": {
      const anyFilled = hasText(s.chiefComplaint, s.painLocation, s.nprs, s.aggravating, s.easing, s.functionalLimitations, s.goals, s.redFlags);
      if (!anyFilled) return "pending";
      if (s.chiefComplaint.trim() && s.nprs.trim()) return "completed";
      return "in-progress";
    }
    case "rom": {
      const obj = cvStatus(draft.objective.rom.status);
      if (obj !== "pending") return obj;
      if (hasText(draft.outcomes.lefs.rawNotes, draft.outcomes.quickdash.rawNotes)) return "in-progress";
      return "pending";
    }
    case "strength": {
      const objS = objSectionStatus(draft, ["squat", "sit_to_stand"]);
      const funS = funcSectionStatus(draft, ["squat", "step_down"]);
      if (objS === "completed" || funS === "completed") return "completed";
      if (objS !== "pending" || funS !== "pending" || hasText(draft.outcomes.psfs.rawNotes)) return "in-progress";
      return "pending";
    }
    case "balance": {
      const objS = objSectionStatus(draft, ["balance", "posture"]);
      const funS = funcSectionStatus(draft, ["single_leg_balance"]);
      if (objS === "completed" || funS === "completed") return "completed";
      if (objS !== "pending" || funS !== "pending") return "in-progress";
      return "pending";
    }
    case "gait": {
      const objS = cvStatus(draft.objective.gait.status);
      const funS = funcSectionStatus(draft, ["gait_speed", "tug"]);
      if (objS === "completed" || funS === "completed") return "completed";
      if (objS !== "pending" || funS !== "pending") return "in-progress";
      return "pending";
    }
    case "functional": {
      const allFuncKeys: FunctionalKey[] = ["five_x_sts", "squat", "step_down"];
      const funS = funcSectionStatus(draft, allFuncKeys);
      if (funS !== "pending") return funS;
      if (hasText(draft.outcomes.oswestry.rawNotes, draft.outcomes.ndi.rawNotes)) return "in-progress";
      return "pending";
    }
    case "special-tests": {
      if (!draft.specialTests) return "pending";
      const tested = Object.values(draft.specialTests).filter((e) => e.result !== "not_tested");
      if (tested.length === 0) return "pending";
      const hasPositive = tested.some((e) => e.result === "positive" || e.result === "inconclusive");
      return hasPositive ? "completed" : "in-progress";
    }
    case "notes": {
      if (hasText(draft.soap.subjective, draft.soap.objective, draft.soap.assessment, draft.soap.plan) &&
          draft.therapist.decision) return "completed";
      if (hasText(draft.soap.subjective, draft.soap.objective, draft.soap.assessment, draft.soap.plan,
          draft.ai.clinicalImpression)) return "in-progress";
      return "pending";
    }
  }
}

function getCompletedCount(draft: GeneralAssessmentDraft): number {
  return SECTIONS.filter((s) => getSectionStatus(s.id, draft) === "completed").length;
}

// ── Voice assistant helpers (unchanged) ────────────────────────────────────────

function mergeText(existing: string, incoming: string): string {
  const a = existing.trim();
  const b = incoming.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}

/** Same output on server and first client paint (UTC from ISO); avoids locale hydration mismatch. */
function formatIsoTimestampUtcStable(iso: string): string {
  const s = iso.trim();
  if (!s) return "Not saved yet";
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]} UTC`;
  const m2 = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m2) return `${m2[1]} ${m2[2]} UTC`;
  return s;
}

function DraftLastUpdatedDisplay({ iso }: { iso: string }) {
  const [display, setDisplay] = useState(() =>
    !iso.trim() ? "Not saved yet" : formatIsoTimestampUtcStable(iso),
  );
  useEffect(() => {
    if (!iso.trim()) { setDisplay("Not saved yet"); return; }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) { setDisplay("—"); return; }
    setDisplay(d.toLocaleString());
  }, [iso]);
  return <>{display}</>;
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SectionStatus }) {
  if (status === "completed")
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-400/12 px-2.5 py-0.5 text-[11px] font-semibold text-lime-300">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Completed
      </span>
    );
  if (status === "in-progress")
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        In Progress
      </span>
    );
  return (
    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/40">
      Pending
    </span>
  );
}

// ── Sub-form atoms ─────────────────────────────────────────────────────────────

const textareaCls =
  "w-full resize-y rounded-2xl border border-white/10 bg-[#071a2f]/80 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40";

function Ta({ label, v, on, rows = 3 }: { label: string; v: string; on: (s: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={rows} placeholder="Not recorded" className={textareaCls} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/90">{value || "—"}</p>
    </div>
  );
}

function SectionSubheading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">{children}</p>
  );
}

function CvRow({
  label,
  statusVal,
  cameraCv,
  result,
  notes,
  onStatus,
  onCameraCv,
  onResult,
  onNotes,
}: {
  label: string;
  statusVal: CvRowStatus;
  cameraCv: boolean;
  result: string;
  notes: string;
  onStatus: (s: CvRowStatus) => void;
  onCameraCv: (b: boolean) => void;
  onResult: (s: string) => void;
  onNotes: (s: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cyan-100">{label}</h4>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={cameraCv} onChange={(e) => onCameraCv(e.target.checked)} className="rounded border-white/20 accent-cyan-400" />
            Camera CV
          </label>
          <select
            value={statusVal}
            onChange={(e) => onStatus(e.target.value as CvRowStatus)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white outline-none"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Ta label="Result" v={result} on={onResult} rows={2} />
        <Ta label="Clinical notes" v={notes} on={onNotes} rows={2} />
      </div>
    </div>
  );
}

function FuncRow({
  label,
  statusVal,
  result,
  notes,
  onStatus,
  onResult,
  onNotes,
}: {
  label: string;
  statusVal: CvRowStatus;
  result: string;
  notes: string;
  onStatus: (s: CvRowStatus) => void;
  onResult: (s: string) => void;
  onNotes: (s: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white">{label}</h4>
        <select
          value={statusVal}
          onChange={(e) => onStatus(e.target.value as CvRowStatus)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white outline-none"
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Ta label="Result" v={result} on={onResult} rows={2} />
        <Ta label="Clinical notes" v={notes} on={onNotes} rows={2} />
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  rawNotes,
  clinicianDocumented,
  onRaw,
  onClinician,
}: {
  label: string;
  rawNotes: string;
  clinicianDocumented: string;
  onRaw: (s: string) => void;
  onClinician: (s: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <h4 className="text-sm font-semibold text-cyan-200/90">{label}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Ta label="Raw notes / items" v={rawNotes} on={onRaw} rows={2} />
        <Ta label="Clinician-documented score" v={clinicianDocumented} on={onClinician} rows={2} />
      </div>
    </div>
  );
}

// ── Section content renderers ──────────────────────────────────────────────────

function PainSection({
  draft,
  persist,
  onVoiceSubjective,
  onVoiceSoap,
}: {
  draft: GeneralAssessmentDraft;
  persist: (d: GeneralAssessmentDraft) => void;
  onVoiceSubjective: (p: VoiceAssistantPayload) => void;
  onVoiceSoap: (p: VoiceAssistantPayload) => void;
}) {
  const s = draft.subjective;
  const p = (field: keyof typeof s, v: string) =>
    persist({ ...draft, subjective: { ...s, [field]: v }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <VoiceClinicalAssistant onInsertIntoForm={onVoiceSubjective} onInsertIntoSoap={onVoiceSoap} />

      <div>
        <SectionSubheading>Chief complaint & pain</SectionSubheading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Ta label="Chief complaint *" v={s.chiefComplaint} on={(v) => p("chiefComplaint", v)} />
          <Ta label="Pain location" v={s.painLocation} on={(v) => p("painLocation", v)} />
          <Ta label="NPRS pain score (0–10) *" v={s.nprs} on={(v) => p("nprs", v)} rows={2} />
          <Ta label="Aggravating factors" v={s.aggravating} on={(v) => p("aggravating", v)} />
          <Ta label="Easing factors" v={s.easing} on={(v) => p("easing", v)} />
          <Ta label="Functional limitations" v={s.functionalLimitations} on={(v) => p("functionalLimitations", v)} />
        </div>
      </div>

      <div>
        <SectionSubheading>Goals & safety</SectionSubheading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Ta label="Patient goals" v={s.goals} on={(v) => p("goals", v)} />
          <div>
            <Ta label="Red flags" v={s.redFlags} on={(v) => p("redFlags", v)} />
            {s.redFlags.trim() && (
              <p className="mt-1 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                Red flags documented — review before proceeding.
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionSubheading>NPRS outcome measure</SectionSubheading>
        <OutcomeRow
          label="NPRS — Numeric Pain Rating Scale"
          rawNotes={draft.outcomes.nprs.rawNotes}
          clinicianDocumented={draft.outcomes.nprs.clinicianDocumented}
          onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, nprs: { ...draft.outcomes.nprs, rawNotes: v } }, updatedAt: new Date().toISOString() })}
          onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, nprs: { ...draft.outcomes.nprs, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
        />
      </div>
    </div>
  );
}

function RomSection({ draft, persist }: { draft: GeneralAssessmentDraft; persist: (d: GeneralAssessmentDraft) => void }) {
  const obj = draft.objective.rom;
  const p = (patch: Partial<typeof obj>) =>
    persist({ ...draft, objective: { ...draft.objective, rom: { ...obj, ...patch } }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div>
        <SectionSubheading>Objective ROM test</SectionSubheading>
        <CvRow
          label="Range of Motion"
          statusVal={obj.status}
          cameraCv={obj.cameraCv}
          result={obj.result}
          notes={obj.notes}
          onStatus={(s) => p({ status: s })}
          onCameraCv={(b) => p({ cameraCv: b })}
          onResult={(s) => p({ result: s })}
          onNotes={(s) => p({ notes: s })}
        />
      </div>

      <div>
        <SectionSubheading>Outcome measures</SectionSubheading>
        <div className="space-y-3">
          <OutcomeRow
            label="LEFS — Lower Extremity Functional Scale"
            rawNotes={draft.outcomes.lefs.rawNotes}
            clinicianDocumented={draft.outcomes.lefs.clinicianDocumented}
            onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, lefs: { ...draft.outcomes.lefs, rawNotes: v } }, updatedAt: new Date().toISOString() })}
            onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, lefs: { ...draft.outcomes.lefs, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
          />
          <OutcomeRow
            label="QuickDASH"
            rawNotes={draft.outcomes.quickdash.rawNotes}
            clinicianDocumented={draft.outcomes.quickdash.clinicianDocumented}
            onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, quickdash: { ...draft.outcomes.quickdash, rawNotes: v } }, updatedAt: new Date().toISOString() })}
            onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, quickdash: { ...draft.outcomes.quickdash, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
          />
        </div>
      </div>
    </div>
  );
}

function StrengthSection({ draft, persist }: { draft: GeneralAssessmentDraft; persist: (d: GeneralAssessmentDraft) => void }) {
  const pObj = (key: ObjectiveKey, patch: Partial<typeof draft.objective[ObjectiveKey]>) =>
    persist({ ...draft, objective: { ...draft.objective, [key]: { ...draft.objective[key], ...patch } }, updatedAt: new Date().toISOString() });
  const pFunc = (key: FunctionalKey, patch: Partial<typeof draft.functional[FunctionalKey]>) =>
    persist({ ...draft, functional: { ...draft.functional, [key]: { ...draft.functional[key], ...patch } }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div>
        <SectionSubheading>CV objective tests</SectionSubheading>
        <div className="space-y-3">
          <CvRow
            label="Squat analysis"
            statusVal={draft.objective.squat.status}
            cameraCv={draft.objective.squat.cameraCv}
            result={draft.objective.squat.result}
            notes={draft.objective.squat.notes}
            onStatus={(s) => pObj("squat", { status: s })}
            onCameraCv={(b) => pObj("squat", { cameraCv: b })}
            onResult={(s) => pObj("squat", { result: s })}
            onNotes={(s) => pObj("squat", { notes: s })}
          />
          <CvRow
            label="Sit-to-Stand"
            statusVal={draft.objective.sit_to_stand.status}
            cameraCv={draft.objective.sit_to_stand.cameraCv}
            result={draft.objective.sit_to_stand.result}
            notes={draft.objective.sit_to_stand.notes}
            onStatus={(s) => pObj("sit_to_stand", { status: s })}
            onCameraCv={(b) => pObj("sit_to_stand", { cameraCv: b })}
            onResult={(s) => pObj("sit_to_stand", { result: s })}
            onNotes={(s) => pObj("sit_to_stand", { notes: s })}
          />
        </div>
      </div>

      <div>
        <SectionSubheading>Functional tests</SectionSubheading>
        <div className="space-y-3">
          <FuncRow
            label="Step-Down Test"
            statusVal={draft.functional.step_down.status}
            result={draft.functional.step_down.result}
            notes={draft.functional.step_down.notes}
            onStatus={(s) => pFunc("step_down", { status: s })}
            onResult={(s) => pFunc("step_down", { result: s })}
            onNotes={(s) => pFunc("step_down", { notes: s })}
          />
        </div>
      </div>

      <div>
        <SectionSubheading>Outcome measures</SectionSubheading>
        <OutcomeRow
          label="PSFS — Patient-Specific Functional Scale"
          rawNotes={draft.outcomes.psfs.rawNotes}
          clinicianDocumented={draft.outcomes.psfs.clinicianDocumented}
          onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, psfs: { ...draft.outcomes.psfs, rawNotes: v } }, updatedAt: new Date().toISOString() })}
          onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, psfs: { ...draft.outcomes.psfs, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
        />
      </div>
    </div>
  );
}

function BalanceSection({ draft, persist }: { draft: GeneralAssessmentDraft; persist: (d: GeneralAssessmentDraft) => void }) {
  const pObj = (key: ObjectiveKey, patch: Partial<typeof draft.objective[ObjectiveKey]>) =>
    persist({ ...draft, objective: { ...draft.objective, [key]: { ...draft.objective[key], ...patch } }, updatedAt: new Date().toISOString() });
  const pFunc = (key: FunctionalKey, patch: Partial<typeof draft.functional[FunctionalKey]>) =>
    persist({ ...draft, functional: { ...draft.functional, [key]: { ...draft.functional[key], ...patch } }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div>
        <SectionSubheading>CV objective tests</SectionSubheading>
        <div className="space-y-3">
          <CvRow
            label="Balance"
            statusVal={draft.objective.balance.status}
            cameraCv={draft.objective.balance.cameraCv}
            result={draft.objective.balance.result}
            notes={draft.objective.balance.notes}
            onStatus={(s) => pObj("balance", { status: s })}
            onCameraCv={(b) => pObj("balance", { cameraCv: b })}
            onResult={(s) => pObj("balance", { result: s })}
            onNotes={(s) => pObj("balance", { notes: s })}
          />
          <CvRow
            label="Posture"
            statusVal={draft.objective.posture.status}
            cameraCv={draft.objective.posture.cameraCv}
            result={draft.objective.posture.result}
            notes={draft.objective.posture.notes}
            onStatus={(s) => pObj("posture", { status: s })}
            onCameraCv={(b) => pObj("posture", { cameraCv: b })}
            onResult={(s) => pObj("posture", { result: s })}
            onNotes={(s) => pObj("posture", { notes: s })}
          />
        </div>
      </div>
      <div>
        <SectionSubheading>Functional test</SectionSubheading>
        <FuncRow
          label="Single-Leg Balance"
          statusVal={draft.functional.single_leg_balance.status}
          result={draft.functional.single_leg_balance.result}
          notes={draft.functional.single_leg_balance.notes}
          onStatus={(s) => pFunc("single_leg_balance", { status: s })}
          onResult={(s) => pFunc("single_leg_balance", { result: s })}
          onNotes={(s) => pFunc("single_leg_balance", { notes: s })}
        />
      </div>
    </div>
  );
}

function GaitSection({
  draft,
  persist,
  patientId,
}: {
  draft: GeneralAssessmentDraft;
  persist: (d: GeneralAssessmentDraft) => void;
  patientId: string;
}) {
  const pObj = (patch: Partial<typeof draft.objective.gait>) =>
    persist({ ...draft, objective: { ...draft.objective, gait: { ...draft.objective.gait, ...patch } }, updatedAt: new Date().toISOString() });
  const pFunc = (key: FunctionalKey, patch: Partial<typeof draft.functional[FunctionalKey]>) =>
    persist({ ...draft, functional: { ...draft.functional, [key]: { ...draft.functional[key], ...patch } }, updatedAt: new Date().toISOString() });

  const bodyAxisHref = patientId
    ? `/body-axis-ai?patientId=${encodeURIComponent(patientId)}&test=posture`
    : null;

  return (
    <div className="space-y-6">
      {bodyAxisHref && (
        <div className="flex items-center gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/8 p-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-cyan-200">Body Axis AI — Camera Gait Analysis</p>
            <p className="mt-0.5 text-xs text-white/50">Launch CV session to capture gait metrics automatically.</p>
          </div>
          <Link
            href={bodyAxisHref}
            className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Open →
          </Link>
        </div>
      )}

      <div>
        <SectionSubheading>CV objective — Gait</SectionSubheading>
        <CvRow
          label="Gait Analysis"
          statusVal={draft.objective.gait.status}
          cameraCv={draft.objective.gait.cameraCv}
          result={draft.objective.gait.result}
          notes={draft.objective.gait.notes}
          onStatus={(s) => pObj({ status: s })}
          onCameraCv={(b) => pObj({ cameraCv: b })}
          onResult={(s) => pObj({ result: s })}
          onNotes={(s) => pObj({ notes: s })}
        />
      </div>

      <div>
        <SectionSubheading>Functional tests</SectionSubheading>
        <div className="space-y-3">
          <FuncRow
            label="Gait Speed"
            statusVal={draft.functional.gait_speed.status}
            result={draft.functional.gait_speed.result}
            notes={draft.functional.gait_speed.notes}
            onStatus={(s) => pFunc("gait_speed", { status: s })}
            onResult={(s) => pFunc("gait_speed", { result: s })}
            onNotes={(s) => pFunc("gait_speed", { notes: s })}
          />
          <FuncRow
            label="Timed Up and Go (TUG)"
            statusVal={draft.functional.tug.status}
            result={draft.functional.tug.result}
            notes={draft.functional.tug.notes}
            onStatus={(s) => pFunc("tug", { status: s })}
            onResult={(s) => pFunc("tug", { result: s })}
            onNotes={(s) => pFunc("tug", { notes: s })}
          />
        </div>
      </div>
    </div>
  );
}

function FunctionalSection({ draft, persist }: { draft: GeneralAssessmentDraft; persist: (d: GeneralAssessmentDraft) => void }) {
  const pFunc = (key: FunctionalKey, patch: Partial<typeof draft.functional[FunctionalKey]>) =>
    persist({ ...draft, functional: { ...draft.functional, [key]: { ...draft.functional[key], ...patch } }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div>
        <SectionSubheading>Functional tests</SectionSubheading>
        <div className="space-y-3">
          <FuncRow
            label="5× Sit-to-Stand"
            statusVal={draft.functional.five_x_sts.status}
            result={draft.functional.five_x_sts.result}
            notes={draft.functional.five_x_sts.notes}
            onStatus={(s) => pFunc("five_x_sts", { status: s })}
            onResult={(s) => pFunc("five_x_sts", { result: s })}
            onNotes={(s) => pFunc("five_x_sts", { notes: s })}
          />
          <FuncRow
            label="Squat"
            statusVal={draft.functional.squat.status}
            result={draft.functional.squat.result}
            notes={draft.functional.squat.notes}
            onStatus={(s) => pFunc("squat", { status: s })}
            onResult={(s) => pFunc("squat", { result: s })}
            onNotes={(s) => pFunc("squat", { notes: s })}
          />
        </div>
      </div>
      <div>
        <SectionSubheading>Outcome measures</SectionSubheading>
        <div className="space-y-3">
          <OutcomeRow
            label="Oswestry Disability Index (ODI)"
            rawNotes={draft.outcomes.oswestry.rawNotes}
            clinicianDocumented={draft.outcomes.oswestry.clinicianDocumented}
            onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, oswestry: { ...draft.outcomes.oswestry, rawNotes: v } }, updatedAt: new Date().toISOString() })}
            onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, oswestry: { ...draft.outcomes.oswestry, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
          />
          <OutcomeRow
            label="NDI — Neck Disability Index"
            rawNotes={draft.outcomes.ndi.rawNotes}
            clinicianDocumented={draft.outcomes.ndi.clinicianDocumented}
            onRaw={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, ndi: { ...draft.outcomes.ndi, rawNotes: v } }, updatedAt: new Date().toISOString() })}
            onClinician={(v) => persist({ ...draft, outcomes: { ...draft.outcomes, ndi: { ...draft.outcomes.ndi, clinicianDocumented: v } }, updatedAt: new Date().toISOString() })}
          />
        </div>
      </div>
    </div>
  );
}

function NotesSection({ draft, persist }: { draft: GeneralAssessmentDraft; persist: (d: GeneralAssessmentDraft) => void }) {
  const pSoap = (patch: Partial<typeof draft.soap>) =>
    persist({ ...draft, soap: { ...draft.soap, ...patch }, updatedAt: new Date().toISOString() });
  const pAi = (patch: Partial<typeof draft.ai>) =>
    persist({ ...draft, ai: { ...draft.ai, ...patch }, updatedAt: new Date().toISOString() });
  const pTherapist = (patch: Partial<typeof draft.therapist>) =>
    persist({ ...draft, therapist: { ...draft.therapist, ...patch }, updatedAt: new Date().toISOString() });

  return (
    <div className="space-y-6">
      <div>
        <SectionSubheading>SOAP notes (AI-assisted draft — therapist must review)</SectionSubheading>
        <div className="mb-3 rounded-xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-2.5 text-xs text-cyan-200/90">
          AI-generated draft — review and edit before finalising.
        </div>
        <div className="space-y-3">
          <Ta label="Subjective" v={draft.soap.subjective} on={(v) => pSoap({ subjective: v })} rows={4} />
          <Ta label="Objective" v={draft.soap.objective} on={(v) => pSoap({ objective: v })} rows={4} />
          <Ta label="Assessment" v={draft.soap.assessment} on={(v) => pSoap({ assessment: v })} rows={3} />
          <Ta label="Plan" v={draft.soap.plan} on={(v) => pSoap({ plan: v })} rows={3} />
        </div>
      </div>

      <div>
        <SectionSubheading>AI clinical reasoning (decision support only)</SectionSubheading>
        <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-2.5 text-xs text-amber-200/90">
          AI reasoning is decision-support only and does not constitute a diagnosis.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Ta label="Clinical impression suggestion" v={draft.ai.clinicalImpression} on={(v) => pAi({ clinicalImpression: v })} />
          <Ta label="Supporting findings" v={draft.ai.supportingFindings} on={(v) => pAi({ supportingFindings: v })} />
          <Ta label="Missing tests" v={draft.ai.missingTests} on={(v) => pAi({ missingTests: v })} />
          <Ta label="Confidence level" v={draft.ai.confidenceLevel} on={(v) => pAi({ confidenceLevel: v })} />
          <div className="sm:col-span-2">
            <Ta label="Safety notes" v={draft.ai.safetyNotes} on={(v) => pAi({ safetyNotes: v })} />
          </div>
        </div>
      </div>

      <div>
        <SectionSubheading>Therapist review</SectionSubheading>
        <div className="flex flex-wrap gap-2 mb-4">
          {(["approve", "edit", "reject"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pTherapist({ decision: d })}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                draft.therapist.decision === d
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {d === "approve" ? "Approve" : d === "edit" ? "Edit" : "Reject"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <Ta label="Final diagnosis (therapist-owned)" v={draft.therapist.finalDiagnosis} on={(v) => pTherapist({ finalDiagnosis: v })} />
          <Ta label="Treatment priorities" v={draft.therapist.treatmentPriorities} on={(v) => pTherapist({ treatmentPriorities: v })} />
        </div>
      </div>
    </div>
  );
}

// ── Overview (section cards) ───────────────────────────────────────────────────

function AssessmentOverview({
  draft,
  patient,
  onOpen,
  onReview,
  patientId,
}: {
  draft: GeneralAssessmentDraft;
  patient: BackendPatient | null;
  onOpen: (id: SectionId) => void;
  onReview: () => void;
  patientId: string;
}) {
  const completedCount = getCompletedCount(draft);
  const totalCount = SECTIONS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const requiredComplete = getSectionStatus("pain", draft) === "completed";

  return (
    <div>
      {/* Patient header */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Patient ID" value={patientId} />
        <Info label="Patient name" value={patient?.full_name?.trim() || "—"} />
        <Info label="Primary complaint (EMR)" value={patient?.diagnosis?.trim() || "—"} />
        <Info label="Draft last updated" value={<DraftLastUpdatedDisplay key={draft.updatedAt} iso={draft.updatedAt} />} />
      </div>

      {/* Progress bar */}
      <div className="mb-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              {completedCount} of {totalCount} sections completed
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              {completedCount === 0 ? "Start with Pain & Subjective — it's required." :
               completedCount === totalCount ? "All sections complete — ready to review." :
               "Continue completing sections before review."}
            </p>
          </div>
          <span className={`text-2xl font-bold ${progressPct === 100 ? "text-lime-300" : "text-cyan-300"}`}>
            {progressPct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              progressPct === 100 ? "bg-gradient-to-r from-lime-400 to-emerald-400" : "bg-gradient-to-r from-cyan-400 to-cyan-300"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => {
            const status = getSectionStatus(s.id, draft);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  status === "completed" ? "bg-lime-400/15 text-lime-300 hover:bg-lime-400/25" :
                  status === "in-progress" ? "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25" :
                  "bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SECTIONS.map((sec, i) => {
          const status = getSectionStatus(sec.id, draft);
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => onOpen(sec.id)}
              className={`group flex flex-col gap-3 rounded-[24px] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.22)] ${
                status === "completed"
                  ? "border-lime-300/20 bg-lime-400/[0.06] hover:border-lime-300/35"
                  : status === "in-progress"
                  ? "border-amber-300/20 bg-amber-400/[0.05] hover:border-amber-300/35"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20"
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                  status === "completed"
                    ? "border-lime-300/25 bg-lime-400/10 text-lime-300"
                    : status === "in-progress"
                    ? "border-amber-300/25 bg-amber-400/10 text-amber-300"
                    : "border-white/15 bg-white/[0.06] text-white/50"
                }`}>
                  {sec.icon}
                </div>
                <span className="text-[10px] font-bold text-white/25 group-hover:text-white/40">{i + 1}</span>
              </div>

              {/* Title + status */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                  {sec.required && (
                    <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">
                      Required
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-white/45">{sec.description}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <StatusBadge status={status} />
                <svg className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Review CTA */}
      <div className="mt-8 flex flex-col items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">Ready to review?</p>
          <p className="mt-0.5 text-xs text-white/45">
            {requiredComplete
              ? `${totalCount - completedCount > 0 ? `${totalCount - completedCount} optional section(s) remaining.` : "All sections complete."} Review and finalize the assessment.`
              : "Complete the required Pain section before reviewing."}
          </p>
        </div>
        <button
          type="button"
          disabled={!requiredComplete}
          onClick={onReview}
          className="shrink-0 rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review & Finalise →
        </button>
      </div>
    </div>
  );
}

// ── Special Tests Section ───────────────────────────────────────────────────────

const RESULT_OPTIONS: { value: SpecialTestResult; label: string; activeCls: string }[] = [
  { value: "not_tested",   label: "Not tested",   activeCls: "border-white/25 bg-white/10 text-white/60" },
  { value: "negative",     label: "Negative",     activeCls: "border-lime-300/40 bg-lime-400/15 text-lime-200" },
  { value: "positive",     label: "Positive",     activeCls: "border-rose-300/40 bg-rose-400/15 text-rose-200" },
  { value: "inconclusive", label: "Inconclusive", activeCls: "border-amber-300/35 bg-amber-400/15 text-amber-200" },
];

const RESULT_INACTIVE = "border-white/10 bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/60";

function SpecialTestRow({
  def,
  entry,
  onChange,
}: {
  def: { id: string; name: string; hint: string };
  entry: SpecialTestEntry;
  onChange: (patch: Partial<SpecialTestEntry>) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className={`rounded-2xl border p-4 transition ${
      entry.result === "positive"     ? "border-rose-300/20 bg-rose-400/[0.04]" :
      entry.result === "negative"     ? "border-lime-300/15 bg-lime-400/[0.03]" :
      entry.result === "inconclusive" ? "border-amber-300/15 bg-amber-400/[0.03]" :
      "border-white/8 bg-white/[0.02]"
    }`}>
      {/* Test name + hint */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">{def.name}</p>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40">
            {def.hint}
          </span>
        </div>
        {entry.result !== "not_tested" && (
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="text-[11px] text-white/40 transition hover:text-white/70"
          >
            {showNotes ? "Hide notes" : "Add notes"}
          </button>
        )}
      </div>

      {/* Result buttons */}
      <div className="flex flex-wrap gap-1.5">
        {RESULT_OPTIONS.map((opt) => {
          const isActive = entry.result === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange({ result: opt.value });
                if (opt.value !== "not_tested") setShowNotes(true);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isActive ? opt.activeCls : RESULT_INACTIVE
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Notes */}
      {(showNotes || entry.notes.trim()) && entry.result !== "not_tested" && (
        <textarea
          value={entry.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Clinical notes for this test…"
          rows={2}
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-[#0d2245]/40 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-300/30"
        />
      )}
    </div>
  );
}

function SpecialTestsSection({
  draft,
  persist,
}: {
  draft: GeneralAssessmentDraft;
  persist: (d: GeneralAssessmentDraft) => void;
}) {
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({});

  const specialTests = draft.specialTests ?? {};

  function toggle(region: string) {
    setOpenRegions((prev) => ({ ...prev, [region]: !prev[region] }));
  }

  function updateTest(testId: string, patch: Partial<SpecialTestEntry>) {
    persist({
      ...draft,
      specialTests: {
        ...specialTests,
        [testId]: { ...(specialTests[testId] ?? { result: "not_tested", notes: "" }), ...patch },
      },
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-xs leading-5 text-amber-200/90">
          Special tests are clinician-entered findings and are not AI-generated diagnoses. Results are used
          to inform clinical reasoning and treatment recommendation only.
        </p>
      </div>

      {/* Region accordions */}
      {REGION_ORDER.map((region) => {
        const tests = getTestsByRegion(region);
        const counts = countRegionResults(specialTests, region);
        const isOpen = openRegions[region] ?? false;

        return (
          <div key={region} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggle(region)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              {/* Region label */}
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{REGION_LABELS[region as SpecialTestRegion]}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {counts.tested === 0
                    ? `${tests.length} tests — none recorded`
                    : `${counts.tested} tested`}
                  {counts.positive > 0 && (
                    <span className="ml-2 font-semibold text-rose-300">
                      {counts.positive} positive
                    </span>
                  )}
                  {counts.inconclusive > 0 && (
                    <span className="ml-2 font-semibold text-amber-300">
                      {counts.inconclusive} inconclusive
                    </span>
                  )}
                </p>
              </div>

              {/* Count pills */}
              <div className="flex shrink-0 items-center gap-2">
                {counts.positive > 0 && (
                  <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
                    +{counts.positive}
                  </span>
                )}
                {counts.negative > 0 && (
                  <span className="rounded-full border border-lime-300/20 bg-lime-400/8 px-2.5 py-0.5 text-[10px] font-semibold text-lime-400/80">
                    −{counts.negative}
                  </span>
                )}
                <svg
                  className={`h-4 w-4 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-white/8 px-5 pb-5 pt-4">
                <div className="space-y-3">
                  {tests.map((def) => (
                    <SpecialTestRow
                      key={def.id}
                      def={def}
                      entry={specialTests[def.id] ?? { result: "not_tested", notes: "" }}
                      onChange={(patch) => updateTest(def.id, patch)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section view ───────────────────────────────────────────────────────────────

function SectionView({
  sectionId,
  draft,
  persist,
  patient,
  patientId,
  onBack,
  onNavigate,
}: {
  sectionId: SectionId;
  draft: GeneralAssessmentDraft;
  persist: (d: GeneralAssessmentDraft) => void;
  patient: BackendPatient | null;
  patientId: string;
  onBack: () => void;
  onNavigate: (id: SectionId | "review") => void;
}) {
  const idx = SECTIONS.findIndex((s) => s.id === sectionId);
  const section = SECTIONS[idx];
  const status = getSectionStatus(sectionId, draft);
  const prevSection = idx > 0 ? SECTIONS[idx - 1] : null;
  const nextSection = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;
  const isLast = idx === SECTIONS.length - 1;

  const applyVoiceSubjective = useCallback(
    (payload: VoiceAssistantPayload) => {
      const cf = payload.clinicalFields;
      persist({
        ...draft,
        subjective: {
          ...draft.subjective,
          chiefComplaint: mergeText(draft.subjective.chiefComplaint, cf.chiefComplaint.value),
          painLocation: mergeText(draft.subjective.painLocation, cf.painLocation.value),
          nprs: mergeText(draft.subjective.nprs, cf.nprs.value),
          aggravating: mergeText(draft.subjective.aggravating, cf.aggravating.value),
          easing: mergeText(draft.subjective.easing, cf.easing.value),
          functionalLimitations: mergeText(draft.subjective.functionalLimitations, cf.functionalLimitation.value),
          redFlags: mergeText(draft.subjective.redFlags, cf.redFlags.value),
          goals: mergeText(draft.subjective.goals, cf.goals.value),
        },
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, persist],
  );

  const applyVoiceSoap = useCallback(
    (payload: VoiceAssistantPayload) => {
      const stamp = new Date().toISOString();
      const cf = payload.clinicalFields;
      const block = [
        `--- Voice intake · ${stamp} ---`,
        VOICE_INTAKE_DISCLAIMER,
        "",
        payload.clinicalTranslationParagraph,
        "",
        `Chief complaint: ${cf.chiefComplaint.value}`,
        `Pain location: ${cf.painLocation.value}`,
        `NPRS: ${cf.nprs.value}`,
      ].join("\n");
      persist({
        ...draft,
        soap: { ...draft.soap, subjective: mergeText(draft.soap.subjective, block) },
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, persist],
  );

  const contentRef = useRef<HTMLDivElement>(null);

  function renderContent() {
    switch (sectionId) {
      case "pain":    return <PainSection draft={draft} persist={persist} onVoiceSubjective={applyVoiceSubjective} onVoiceSoap={applyVoiceSoap} />;
      case "rom":     return <RomSection draft={draft} persist={persist} />;
      case "strength":return <StrengthSection draft={draft} persist={persist} />;
      case "balance": return <BalanceSection draft={draft} persist={persist} />;
      case "gait":    return <GaitSection draft={draft} persist={persist} patientId={patientId} />;
      case "functional":     return <FunctionalSection draft={draft} persist={persist} />;
      case "special-tests": return <SpecialTestsSection draft={draft} persist={persist} />;
      case "notes":         return <NotesSection draft={draft} persist={persist} />;
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
        <button type="button" onClick={onBack} className="hover:text-white/70 transition">
          Assessment
        </button>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-white/70">{section.title}</span>
      </div>

      {/* Section header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
            status === "completed" ? "border-lime-300/25 bg-lime-400/10 text-lime-300" :
            status === "in-progress" ? "border-amber-300/25 bg-amber-400/10 text-amber-300" :
            "border-white/15 bg-white/[0.06] text-white/50"
          }`}>
            {section.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
              <StatusBadge status={status} />
              {section.required && (
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                  Required
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/50">{section.description}</p>
          </div>
        </div>

        {/* Section counter */}
        <div className="flex shrink-0 items-center gap-1.5">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              title={s.title}
              className={`h-1.5 rounded-full transition-all ${
                s.id === sectionId ? "w-6 bg-cyan-400" :
                getSectionStatus(s.id, draft) === "completed" ? "w-3 bg-lime-400/70" :
                "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="mb-8">
        {renderContent()}
      </div>

      {/* Section footer nav */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#071a2f]/95 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            ← Overview
          </button>
          {prevSection && (
            <button
              type="button"
              onClick={() => onNavigate(prevSection.id)}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ← {prevSection.title}
            </button>
          )}
        </div>

        <p className="hidden text-xs text-white/30 sm:block">
          Auto-saving · Section {idx + 1} of {SECTIONS.length}
        </p>

        <div className="flex items-center gap-2">
          {isLast ? (
            <button
              type="button"
              onClick={() => onNavigate("review")}
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Review & Finalise →
            </button>
          ) : (
            nextSection && (
              <button
                type="button"
                onClick={() => onNavigate(nextSection.id)}
                className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {nextSection.title} →
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review view ────────────────────────────────────────────────────────────────

function ReviewView({
  draft,
  patient,
  patientId,
  onBack,
  onEdit,
  onSubmit,
}: {
  draft: GeneralAssessmentDraft;
  patient: BackendPatient | null;
  patientId: string;
  onBack: () => void;
  onEdit: (id: SectionId) => void;
  onSubmit: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const completedCount = getCompletedCount(draft);
  const requiredComplete = getSectionStatus("pain", draft) === "completed";

  function handleSubmit() {
    setSubmitting(true);
    // Draft is already persisted to localStorage by auto-save.
    // TODO: POST to /api/v1/assessments when backend endpoint is ready.
    onSubmit();
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
        <button type="button" onClick={onBack} className="hover:text-white/70 transition">
          Assessment
        </button>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-white/70">Review</span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Assessment Review</h2>
        <p className="mt-2 text-sm text-white/55">
          Review all sections before finalising.{" "}
          {completedCount < SECTIONS.length && (
            <span className="text-amber-300">{SECTIONS.length - completedCount} section(s) incomplete.</span>
          )}
        </p>
      </div>

      {/* Patient summary */}
      <div className="mb-5 rounded-[20px] border border-white/10 bg-white/[0.04] p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">Patient</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Name" value={patient?.full_name || "—"} />
          <Info label="Patient ID" value={patientId} />
          <Info label="EMR Complaint" value={patient?.diagnosis || "—"} />
        </div>
      </div>

      {/* Section summaries */}
      <div className="space-y-3">
        {SECTIONS.map((sec) => {
          const status = getSectionStatus(sec.id, draft);
          return (
            <div
              key={sec.id}
              className={`rounded-[20px] border p-4 ${
                status === "completed" ? "border-lime-300/15 bg-lime-400/[0.04]" :
                status === "in-progress" ? "border-amber-300/15 bg-amber-400/[0.04]" :
                "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                    status === "completed" ? "border-lime-300/25 bg-lime-400/10 text-lime-300" :
                    status === "in-progress" ? "border-amber-300/25 bg-amber-400/10 text-amber-300" :
                    "border-white/15 bg-white/[0.06] text-white/40"
                  }`}>
                    {sec.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{sec.title}</p>
                    <p className="text-xs text-white/40">{sec.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <button
                    type="button"
                    onClick={() => onEdit(sec.id)}
                    className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Key fields preview */}
              {sec.id === "pain" && draft.subjective.chiefComplaint && (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <p className="text-xs text-white/50">
                    <span className="font-medium text-white/70">Complaint:</span>{" "}
                    {draft.subjective.chiefComplaint.slice(0, 120)}{draft.subjective.chiefComplaint.length > 120 ? "…" : ""}
                  </p>
                  {draft.subjective.nprs && (
                    <p className="mt-1 text-xs text-white/50">
                      <span className="font-medium text-white/70">NPRS:</span> {draft.subjective.nprs}
                    </p>
                  )}
                </div>
              )}
              {sec.id === "notes" && draft.soap.assessment && (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <p className="text-xs text-white/50">
                    <span className="font-medium text-white/70">Assessment:</span>{" "}
                    {draft.soap.assessment.slice(0, 120)}{draft.soap.assessment.length > 120 ? "…" : ""}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
        {!requiredComplete && (
          <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
            The <strong>Pain &amp; Subjective</strong> section is required before submitting.
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Finalise assessment</p>
            <p className="mt-0.5 text-xs text-white/45">
              Draft auto-saved · {completedCount}/{SECTIONS.length} sections complete
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!requiredComplete || submitting}
              onClick={handleSubmit}
              className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Generating report…" : "Submit & View Report →"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/25">
          All AI content is decision-support only. The therapist remains responsible for diagnosis and treatment.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type View = "overview" | SectionId | "review";

export function GeneralAssessmentPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patientId")?.trim() ?? "";

  const [draft, setDraft] = useState<GeneralAssessmentDraft>(() => createEmptyGeneralAssessmentDraft());
  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [patientErr, setPatientErr] = useState("");
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    if (!patientId) return;
    setDraft(loadGeneralAssessmentDraft(patientId));
  }, [patientId]);

  const persist = useCallback(
    (next: GeneralAssessmentDraft) => {
      setDraft(next);
      if (patientId) saveGeneralAssessmentDraft(patientId, next);
    },
    [patientId],
  );

  useEffect(() => {
    const n = Number.parseInt(patientId, 10);
    if (!Number.isFinite(n) || n <= 0) { setPatient(null); return; }
    let cancelled = false;
    setPatientErr("");
    void getPatient(n)
      .then((p) => { if (!cancelled) setPatient(p); })
      .catch(() => { if (!cancelled) { setPatient(null); setPatientErr("Could not load patient (check auth)."); } });
    return () => { cancelled = true; };
  }, [patientId]);

  const completedCount = getCompletedCount(draft);

  return (
    <main className="min-h-screen bg-[#071a2f] text-white">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071a2f]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={patientId ? `/clinician/patients/${patientId}` : "/clinician/patients"}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              ← Patient
            </Link>
            {view !== "overview" && (
              <button
                type="button"
                onClick={() => setView("overview")}
                className="text-xs text-white/40 transition hover:text-white/70"
              >
                Assessment Overview
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Mini progress */}
            {patientId && (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all"
                    style={{ width: `${Math.round((completedCount / SECTIONS.length) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-white/40">{completedCount}/{SECTIONS.length}</span>
              </div>
            )}
            {patientId && (
              <Link
                href={`/clinician/assessment/start?patientId=${patientId}`}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Other modes
              </Link>
            )}
          </div>
        </div>

        {/* Page title */}
        {view === "overview" && (
          <div className="border-t border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.06),transparent_38%)] px-6 py-5">
            <div className="mx-auto max-w-5xl">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/70">
                General Assessment
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white">
                {patient?.full_name ? `Assessment — ${patient.full_name}` : "Assessment"}
              </h1>
              {patientErr && <p className="mt-1 text-xs text-amber-300">{patientErr}</p>}
            </div>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {!patientId ? (
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-6 text-sm text-amber-100">
            <strong>No patient selected.</strong> Add <code>?patientId=</code> to the URL, or open this page from a patient profile.
          </div>
        ) : view === "overview" ? (
          <AssessmentOverview
            draft={draft}
            patient={patient}
            onOpen={(id) => setView(id)}
            onReview={() => setView("review")}
            patientId={patientId}
          />
        ) : view === "review" ? (
          <ReviewView
            draft={draft}
            patient={patient}
            patientId={patientId}
            onBack={() => setView("overview")}
            onEdit={(id) => setView(id)}
            onSubmit={() =>
              router.push(`/clinician/assessment/report?patientId=${encodeURIComponent(patientId)}`)
            }
          />
        ) : (
          <SectionView
            sectionId={view as SectionId}
            draft={draft}
            persist={persist}
            patient={patient}
            patientId={patientId}
            onBack={() => setView("overview")}
            onNavigate={(id) => setView(id)}
          />
        )}
      </div>
    </main>
  );
}
