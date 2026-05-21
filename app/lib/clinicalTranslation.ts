/**
 * PT voice-intake clinical translation & structured documentation (client-safe).
 * Uses extraction helpers from clinician assessment module.
 */

import {
  type VoiceStructuredFields,
  extractStructuredFields,
  extractChiefComplaintNarrative,
  detectRedFlagKeywords,
  extractSeverityCareful,
  normalizeTranscriptText,
  stripLeadingDisfluency,
} from "@/app/clinician/assessment/voice-clinical-assistant";

export type FieldConfirmation = "Confirmed" | "Needs confirmation";

export type VoiceIntakeClinicalFields = {
  chiefComplaint: { value: string; confirmation: FieldConfirmation };
  painLocation: { value: string; confirmation: FieldConfirmation };
  nprs: { value: string; confirmation: FieldConfirmation };
  aggravating: { value: string; confirmation: FieldConfirmation };
  easing: { value: string; confirmation: FieldConfirmation };
  functionalLimitation: { value: string; confirmation: FieldConfirmation };
  redFlags: { value: string; confirmation: FieldConfirmation };
  goals: { value: string; confirmation: FieldConfirmation };
};

export const VOICE_INTAKE_DISCLAIMER =
  "AI-generated clinical documentation draft. Therapist must verify.";

function fieldNeeds(value: string): { value: string; confirmation: FieldConfirmation } {
  const v = value.trim();
  return {
    value: v || "—",
    confirmation: "Needs confirmation",
  };
}

function emptyClinicalFields(): VoiceIntakeClinicalFields {
  const e = (): { value: string; confirmation: FieldConfirmation } => ({
    value: "—",
    confirmation: "Needs confirmation",
  });
  return {
    chiefComplaint: e(),
    painLocation: e(),
    nprs: e(),
    aggravating: e(),
    easing: e(),
    functionalLimitation: e(),
    redFlags: e(),
    goals: e(),
  };
}

const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const WESTERN_DIGITS = "0123456789";

/** Normalize Eastern Arabic numerals for English extraction. */
export function normalizeEasternArabicDigits(s: string): string {
  return s
    .split("")
    .map((ch) => {
      const i = EASTERN_DIGITS.indexOf(ch);
      return i >= 0 ? WESTERN_DIGITS[i]! : ch;
    })
    .join("");
}

/** Light phrase glosses before/after machine translation (PT-relevant Arabic). */
export function applyArabicPtPhrasebook(text: string): string {
  let t = normalizeEasternArabicDigits(text);
  const pairs: [RegExp, string][] = [
    [/ما\s*أقدر\s*أمشي\s*كثير/gi, "reduced walking tolerance"],
    [/ما\s*اقدر\s*امشي\s*كثير/gi, "reduced walking tolerance"],
    [/ألم\s*في\s*الرقبة/gi, "neck pain"],
    [/الم\s*في\s*الرقبة/gi, "neck pain"],
    [/ألم\s+الرقبة/gi, "neck pain"],
    [/يزيد\s*لما\s*أجلس\s*على\s*الكمبيوتر/gi, "worse with prolonged computer sitting"],
    [/يزيد\s*لما\s*اجلس\s*على\s*الكمبيوتر/gi, "worse with prolonged computer sitting"],
    [/ما\s*أقدر\s*أحرك\s*يدي/gi, "difficulty moving the hand"],
    [/ما\s*اقدر\s*احرك\s*يدي/gi, "difficulty moving the hand"],
    [/ألم\s*في\s*الظهر/gi, "low back pain"],
    [/لا\s*أستطيع\s*رفع\s*يدي/gi, "unable to raise the arm overhead"],
  ];
  for (const [re, rep] of pairs) t = t.replace(re, rep);
  return t;
}

export function stripConversationalFillers(text: string): string {
  return normalizeTranscriptText(text)
    .replace(/\b(uh|um|er|like|you know)\b,?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clinifyNarrativeFragment(s: string): string {
  let x = stripLeadingDisfluency(s)
    .replace(/^i have\s+/i, "")
    .replace(/^i\s*'?ve\s+got\s+/i, "")
    .replace(/^i\s+/i, "")
    .trim();
  if (!x) return "";
  x = x.charAt(0).toUpperCase() + x.slice(1);
  if (!/^Patient reports\b/i.test(x)) x = `Patient reports ${x.charAt(0).toLowerCase() + x.slice(1)}`;
  if (!/[.!?]$/.test(x)) x += ".";
  return x;
}

function extractGoalsHeuristic(text: string): string {
  const t = text;
  const m = t.match(
    /\b(?:want to|hope to|goal is|my goal|return to|get back to|be able to)\s+([^.;\n]{5,120})/i,
  );
  if (m?.[1]) return `Patient-identified goal: ${m[1].trim().replace(/\s+$/, "")}.`;
  return "";
}

/** Map raw extraction into clinical documentation fields (no raw colloquial Arabic in values). */
export function buildClinicalFieldsFromProcessed(
  englishWorking: string,
  raw: VoiceStructuredFields,
): VoiceIntakeClinicalFields {
  const out = emptyClinicalFields();
  const t = normalizeTranscriptText(englishWorking);
  if (!t.trim()) return out;

  let pl = raw.painLocation.trim();
  if (pl) {
    pl = pl.charAt(0).toUpperCase() + pl.slice(1);
    if (!/\b(pain|ache|region|cervical|lumbar)\b/i.test(pl)) pl = `${pl} (symptom region)`;
    if (!pl.endsWith(".")) pl += ".";
    out.painLocation = fieldNeeds(pl);
  }

  const sev = extractSeverityCareful(t);
  if (sev) out.nprs = fieldNeeds(sev);
  else if (raw.severity.trim()) {
    const cleaned = raw.severity.replace(/Numeric pain rating referenced as\s*/i, "").trim();
    out.nprs = fieldNeeds(cleaned || "—");
  }

  let ag = raw.aggravating.trim().replace(/; /g, ", ");
  if (ag) {
    if (!/^Symptoms are aggravated by\b/i.test(ag)) {
      ag = `Symptoms are aggravated by ${ag.charAt(0).toLowerCase() + ag.slice(1)}`;
    }
    if (!ag.endsWith(".")) ag += ".";
    out.aggravating = fieldNeeds(ag);
  }

  let ea = raw.relieving.trim();
  if (ea) {
    ea = ea.replace(/; /g, " and ");
    if (!/^Reports relief with\b/i.test(ea)) {
      ea = `Reports relief with ${ea.charAt(0).toLowerCase() + ea.slice(1)}`;
    }
    if (!ea.endsWith(".")) ea += ".";
    out.easing = fieldNeeds(ea);
  }

  let fn = raw.functionalLimitation.trim();
  if (fn) {
    if (!/^Patient reports\b/i.test(fn)) {
      fn = `Patient reports difficulty with ${fn.replace(/^(difficulty\s+with|unable\s+to|cannot|can't)\s+/i, "")}`;
    }
    if (!fn.endsWith(".")) fn += ".";
    out.functionalLimitation = fieldNeeds(fn);
  }

  const reds = detectRedFlagKeywords(t);
  if (reds.length) {
    out.redFlags = fieldNeeds(
      `Speech themes for standard clinical screening: ${reds.slice(0, 4).join("; ")}.`,
    );
  } else {
    out.redFlags = fieldNeeds("No red-flag keywords detected in automated speech scan.");
  }

  const g = extractGoalsHeuristic(t);
  if (g) out.goals = fieldNeeds(g);

  if (out.painLocation.value !== "—" && out.nprs.value !== "—") {
    const locShort = out.painLocation.value.replace(/\.$/, "").replace(/ \(symptom region\)$/i, "");
    const n = out.nprs.value.match(/^(\d{1,2})\//)?.[1] ?? "";
    out.chiefComplaint = fieldNeeds(`Regional pain (${locShort}) — NPRS ${n}/10.`);
  } else if (out.painLocation.value !== "—") {
    out.chiefComplaint = fieldNeeds(out.painLocation.value);
  } else {
    const nar = extractChiefComplaintNarrative(t);
    if (nar) {
      const c = clinifyNarrativeFragment(nar);
      if (c) out.chiefComplaint = fieldNeeds(c);
    }
  }

  return out;
}

/** Single clean English paragraph for PT documentation (no diagnosis). */
export function buildClinicalTranslationParagraph(f: VoiceIntakeClinicalFields): string {
  let core = "";
  if (f.painLocation.value !== "—" && f.nprs.value !== "—") {
    const loc = f.painLocation.value.replace(/\.$/, "").replace(/^the /i, "").replace(/ \(symptom region\)$/i, "");
    const n = f.nprs.value.match(/^(\d{1,2})\//)?.[1] ?? "";
    core = `Patient reports ${loc} rated ${n}/10 on NPRS`;
  } else if (f.chiefComplaint.value !== "—") {
    core = f.chiefComplaint.value.replace(/\.$/, "").trim();
    if (!/^Patient reports\b/i.test(core)) core = `Patient reports ${core.charAt(0).toLowerCase() + core.slice(1)}`;
  } else if (f.painLocation.value !== "—") {
    core = `Patient reports symptoms in the ${f.painLocation.value.replace(/\.$/, "").replace(/^the /i, "")}`;
  } else {
    core = "Patient reports symptoms as captured in voice intake";
  }

  const add: string[] = [];
  if (f.aggravating.value !== "—") {
    const inner = f.aggravating.value
      .replace(/^Symptoms are aggravated by\s+/i, "")
      .replace(/\.$/, "")
      .trim();
    add.push(`aggravated by ${inner.charAt(0).toLowerCase() + inner.slice(1)}`);
  }
  if (f.functionalLimitation.value !== "—") {
    const inner = f.functionalLimitation.value
      .replace(/\.$/, "")
      .replace(/^Patient reports\s+/i, "")
      .trim()
      .toLowerCase();
    add.push(`with ${inner}`);
  }

  let out = core;
  if (add.length) out += `, ${add.join(", ")}`;
  out += ".";
  if (f.easing.value !== "—") {
    const ez = f.easing.value.trim();
    if (!/[.!?]$/.test(ez)) out += ` ${ez}.`;
    else out += ` ${ez}`;
  }
  out = stripConversationalFillers(out).replace(/\s+/g, " ").replace(/\.\.+$/g, ".").trim();
  if (!out || out === ".") {
    out = "Voice capture processed; clinical narrative to be confirmed by the physiotherapist.";
  }
  return out;
}

/** Tighten clinical paragraph from structured fields (deterministic). */
export function refineClinicalTranslation(
  _paragraph: string,
  fields: VoiceIntakeClinicalFields,
): string {
  return buildClinicalTranslationParagraph(fields);
}

export function buildVoiceIntakeClinicalPackage(englishWorking: string): {
  rawFields: VoiceStructuredFields;
  clinicalFields: VoiceIntakeClinicalFields;
  clinicalParagraph: string;
} {
  const work = stripConversationalFillers(englishWorking);
  const rawFields = extractStructuredFields(work);
  const clinicalFields = buildClinicalFieldsFromProcessed(work, rawFields);
  const clinicalParagraph = buildClinicalTranslationParagraph(clinicalFields);
  return { rawFields, clinicalFields, clinicalParagraph };
}

export function previewClinicalParagraphFromLiveEnglish(liveEnglish: string): string {
  if (!liveEnglish.trim()) return "";
  const { clinicalParagraph } = buildVoiceIntakeClinicalPackage(liveEnglish);
  return clinicalParagraph;
}
