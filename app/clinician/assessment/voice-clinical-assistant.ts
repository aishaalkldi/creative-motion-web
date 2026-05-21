/**
 * Client-side interpretation support from voice capture: hedged, draft-only wording.
 * No server — not a diagnosis; therapist must validate all output.
 */

export type VoiceStructuredFields = {
  painLocation: string;
  severity: string;
  aggravating: string;
  relieving: string;
  functionalLimitation: string;
};

export const INTERPRETATION_AUTHORITY_FOOTER =
  "Final clinical interpretation, diagnosis, and treatment decision remain with the physiotherapist. This draft is not a medical diagnosis and requires therapist verification before use in the record.";

const PATIENT_PROMPTS_EN = [
  "What is the main problem today?",
  "Where is the pain or discomfort?",
  "What number from 0 to 10 best describes your pain at its worst?",
  "What activities or positions make it worse?",
  "What helps or eases the symptoms?",
  "What can you not do now that you could do before?",
] as const;

/** Red-flag phrases in speech text — prompt therapist review only; not a screening diagnosis. */
const RED_FLAG_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Neurological concern mentioned (e.g. numbness / serious cord symptoms)", re: /\b(numbness|numb|tingling|paralysis|weakness\s+all\s+over|cauda|saddle)\b/i },
  { label: "Bowel / bladder symptoms mentioned", re: /\b(bowel|bladder|incontinence|retention)\b/i },
  { label: "Systemic symptoms mentioned (e.g. fever, unexplained weight change)", re: /\b(fever|chills|night\s*sweats|weight\s+loss|unexplained\s+weight)\b/i },
  { label: "Serious cardiopulmonary symptoms mentioned", re: /\b(chest\s+pain|shortness\s+of\s+breath|sob|palpitations)\b/i },
  { label: "Possible vascular / DVT-type wording", re: /\b(dvt|calf\s+swelling|unilateral\s+swelling|acute\s+leg\s+swelling)\b/i },
  { label: "Major trauma or sinister context mentioned", re: /\b(severe\s+trauma|fall\s+from|mva|car\s+accident|blackout|syncope)\b/i },
];

export function getPatientPrompt(index: number): string {
  const i = Math.max(0, Math.min(index, PATIENT_PROMPTS_EN.length - 1));
  return PATIENT_PROMPTS_EN[i]!;
}

export function getPatientPromptCount(): number {
  return PATIENT_PROMPTS_EN.length;
}

/** Normalize whitespace only — avoid definitive third-person clinical attribution. */
export function normalizeTranscriptText(text: string): string {
  let t = text.trim();
  if (!t) return "";
  t = t.replace(/\s+/g, " ");
  return t;
}

export function stripLeadingDisfluency(s: string): string {
  return s.replace(/^(?:uh+|um+|er+|well,|like,)\s*/gi, "").trim();
}

/** Trim location capture before aggravating / temporal clauses bleed in. */
function trimLocationTail(s: string): string {
  let t = s.trim();
  const cut = t.match(
    /^(.+?)(?=\s+when\b|\s+whenever\b|\s+with\s+(?:prolonged|long|lots)|\s+after\s+\w+|\s+especially\b|\s+during\b)/i,
  );
  if (cut?.[1]) t = cut[1].trim();
  t = t.replace(/\s+(?:and|but)\s*$/i, "").trim();
  return t;
}

function looksLikePainLocationOnly(s: string): boolean {
  const t = stripLeadingDisfluency(s).toLowerCase();
  if (t.length < 6) return true;
  if (/^(?:i\s+have\s+)?pain\s+in\s+the\s+\w+$/i.test(t)) return true;
  if (/^i\s+have\s+pain\s+in\b/i.test(t) && !/\b(sitting|computer|desk|walk|stairs|lift|overhead)\b/i.test(t))
    return true;
  return false;
}

function isUsefulAggravatingPhrase(s: string): boolean {
  const t = stripLeadingDisfluency(s);
  if (t.length < 6 || t.length > 160) return false;
  if (looksLikePainLocationOnly(t)) return false;
  if (/^pain\s+in\s+the\b/i.test(t) && !/\b(and|with|when|sitting|computer|desk)\b/i.test(t)) return false;
  return true;
}

function isUsefulFunctionalPhrase(s: string): boolean {
  const t = s.trim();
  if (t.length < 18) return false;
  if (/\b(uh|um)\b/i.test(t) && t.length < 35) return false;
  if (/\bmove\s+it\s+my\s+hand\b/i.test(t) || /\bmoving\s+my\s+hand\b/i.test(t)) {
    return /\b(overhead|above|reach|raise|lift|fully|all\s+the\s+way)\b/i.test(t);
  }
  return true;
}

function extractPainLocationDetailed(text: string): string {
  const t = text.replace(/\s+/g, " ");
  const parts: string[] = [];

  const behind = t.match(/\b(?:behind|back\s+of|posterior)\s+(?:the\s+)?(?:neck|cervical\s+spine|neck\s+area)\b/i);
  if (behind) parts.push(behind[0].replace(/\s+/g, " "));

  const base = t.match(
    /(?:pain|ache|aching|soreness|discomfort|hurts|sore)\s+(?:in|at|around|near|along|behind)\s+([^.;\n]+?)(?=\s+(?:when|with|after|\.|;)|$)/i,
  );
  let main = base?.[1] ? trimLocationTail(base[1]) : "";

  const radiate = t.match(
    /\b(?:extending|extends|going|radiat\w*|into|to|toward|towards)\s+(?:the\s+)?(?:left|right|bilateral)?\s*(?:shoulder|upper\s+back|arm|scapul\w*|neck)\b/i,
  );
  if (radiate && !parts.some((p) => p.toLowerCase().includes(radiate[0].toLowerCase()))) {
    parts.push(radiate[0].replace(/\s+/g, " "));
  }

  if (!main && !parts.length) {
    const region = t.match(
      /\b(left|right|bilateral)\s+(knee|shoulder|hip|ankle|wrist|elbow|neck|low back|lumbar|cervical)\b/i,
    );
    if (region?.[0]) main = region[0].trim();
  }

  if (main) parts.unshift(main);

  const merged = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  if (!merged.length) return "";
  return merged.join("; ").replace(/;\s*;/g, "; ");
}

function extractAggravating(text: string, lower: string): string {
  const candidates: string[] = [];
  const t = text;

  const lotsSitting = t.match(
    /((?:prolonged|long|extended|lots\s+of|too\s+much)\s+sitting(?:\s+and\s+[^.;]{3,80})?)/i,
  );
  const sittingDesk = t.match(
    /((?:prolonged|long|extended)\s+sitting(?:\s+at\s+(?:the\s+)?(?:computer|desk|workstation))?)/i,
  );
  const compWork = t.match(/\b((?:computer|desk|office)\s+work)\b/i);
  const sittingComp = t.match(
    /\b(sitting\s+(?:at|for)\s+(?:the\s+)?(?:computer|desk|pc)|(?:computer|desk)\s+use)\b/i,
  );

  if (sittingDesk?.[1]) candidates.push(sittingDesk[1].trim());
  if (lotsSitting?.[1] && !sittingDesk?.[1]) candidates.push(lotsSitting[1].trim());
  if (compWork?.[1]) candidates.push(compWork[1].trim());
  if (sittingComp?.[1]) candidates.push(sittingComp[1].trim());

  const worseWhen = t.match(
    /\b(?:worse|worsens|hurts\s+more|more\s+pain)\s+(?:with|when|if|during)\s+([^.;\n]+)/i,
  );
  if (worseWhen?.[1] && isUsefulAggravatingPhrase(worseWhen[1])) candidates.push(worseWhen[1].trim());

  const aggravated = t.match(
    /(?:aggravated\s+by|increases\s+with|flared\s+by)\s+([^.;\n]+)/i,
  );
  if (aggravated?.[1] && isUsefulAggravatingPhrase(aggravated[1])) candidates.push(aggravated[1].trim());

  if (/prolonged\s+sitting/i.test(lower) && !candidates.some((c) => /sitting/i.test(c)))
    candidates.push("prolonged sitting");
  if (/\bcomputer\s+work\b/i.test(lower) && !candidates.some((c) => /computer/i.test(c)))
    candidates.push("computer work");

  const uniq = [...new Set(candidates.map((c) => c.replace(/\s+/g, " ").trim()))];
  const filtered = uniq.filter(isUsefulAggravatingPhrase);
  return filtered.slice(0, 3).join("; ");
}

function extractRelievingDetailed(text: string, lower: string): string {
  const found = new Set<string>();

  const helps = text.matchAll(
    /\b(?:helps?|helped|relief|better|eases|eased|improves)\s+(?:with|from|after)\s+([^.;\n]+)/gi,
  );
  for (const m of helps) {
    const chunk = m[1]?.trim();
    if (chunk && chunk.length > 2 && chunk.length < 120) found.add(chunk);
  }

  const items: string[] = [];
  if (/\bhot\s+(?:pack|bag|compress|water\s+bottle)\b/i.test(lower)) items.push("local heat");
  if (/\bheat(?:ing)?\s+bag\b/i.test(lower)) items.push("heat application");
  if (/\bhot\s+bag\b/i.test(lower)) items.push("heat application");
  if (/\bheating\s+pad\b/i.test(lower)) items.push("superficial heat");
  if (/\bwarm\s+(?:compress|pack|towel)\b/i.test(lower)) items.push("warm compress");
  if (/\bstretch(?:es|ing)?\b/i.test(lower)) items.push("therapeutic stretching");

  for (const it of items) found.add(it);

  return [...found].slice(0, 4).join("; ");
}

function extractFunctionalDetailed(text: string, lower: string): string {
  const patterns: RegExp[] = [
    /(?:cannot|can't|unable\s+to)\s+(?:fully\s+)?(?:raise|lift|reach|move|get)\s+(?:my|their|the)?\s*(?:arm|hand|shoulder)s?\s*(?:overhead|above\s+(?:my|their|the)\s+head|over\s+(?:my|their)\s+head|up\s+fully)/i,
    /(?:cannot|can't|unable\s+to)\s+(?:fully\s+)?(?:raise|lift|reach)\s+[^.;\n]{0,40}(?:overhead|above\s+head)/i,
    /difficulty\s+(?:with\s+)?(?:raising|lifting|reaching|moving)\s+(?:my|their|the)?\s*(?:arm|hand|shoulder)\s*(?:overhead|fully|all\s+the\s+way\s+up)?[^.;\n]*/i,
    /(?:hard\s+to|trouble)\s+(?:reach|raise|lift|get)\s+[^.;\n]+(?:overhead|above|up)/i,
    /\breach(?:ing)?\s+(?:is\s+)?(?:limited|restricted|not\s+full|difficult)[^.;\n]*/i,
    /(?:not\s+able\s+to|unable\s+to)\s+(?:get|reach)\s+[^.;\n]+(?:overhead|arm\s+up|full\s+range)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0] && isUsefulFunctionalPhrase(m[0])) return m[0].replace(/\s+/g, " ").trim();
  }

  if (/\b(overhead|above\s+(?:my|their)\s+head|all\s+the\s+way\s+up)\b/i.test(lower)) {
    const loose = text.match(
      /(?:can't|cannot|unable\s+to|difficulty|trouble|hard\s+to)\s+([^.;\n]{15,100})/i,
    );
    if (loose?.[1] && /\b(hand|arm|shoulder|move|reach|lift|raise)\b/i.test(loose[1])) {
      const phrase = `${loose[1].trim()} in overhead reaching tasks`;
      if (isUsefulFunctionalPhrase(phrase)) return phrase.replace(/\s+/g, " ");
    }
  }

  const cannot = text.match(/(?:cannot|can't|unable\s+to|difficulty)\s+([^.;\n]+)/i);
  if (cannot?.[1] && isUsefulFunctionalPhrase(cannot[1])) return cannot[1].trim();

  return "";
}

export function extractSeverityCareful(text: string): string | null {
  const mFrac = text.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (mFrac?.[1]) {
    const n = Number.parseInt(mFrac[1], 10);
    if (n >= 0 && n <= 10) return `${n}/10 on NPRS`;
  }
  const mNprs = text.match(
    /\b(?:nprs|pain\s+score|rating)\s*[:\-]?\s*(\d{1,2})\b(?!\s*(?:min|minutes?|hrs?|hours?|weeks?|days?|%))/i,
  );
  if (mNprs?.[1]) {
    const n = Number.parseInt(mNprs[1], 10);
    if (n >= 0 && n <= 10) return `${n}/10 on NPRS`;
  }
  const mAbout = text.match(
    /\b(?:about|like|around|is|at)\s+(?:a\s+)?(\d{1,2})\s*(?:\/\s*10|out\s+of\s+10)?\b(?!\s*(?:min|minutes?))/i,
  );
  if (mAbout?.[1]) {
    const n = Number.parseInt(mAbout[1], 10);
    if (n >= 0 && n <= 10) return `${n}/10 on NPRS`;
  }
  return null;
}

/** Pull a concise complaint phrase for chief-complaint merge (draft, verify). */
export function extractChiefComplaintNarrative(text: string): string {
  const t = stripLeadingDisfluency(normalizeTranscriptText(text));
  if (!t) return "";

  const mHave = t.match(
    /\b((?:i\s+have|i'?ve\s+got|there\s+is)\s+[^.;]{0,40}\b(?:pain|ache|aching|soreness|discomfort|stiffness)\b[^.;]{0,140})/i,
  );
  if (mHave?.[1]) {
    const cleaned = trimLocationTail(stripLeadingDisfluency(mHave[1])).replace(/\s+/g, " ").trim();
    if (cleaned.length >= 12) return cleaned;
  }

  const m2 = t.match(
    /\b([^.]{0,35}\b(?:pain|hurts|aching|sore|discomfort|stiff)\b[^.]{0,100})/i,
  );
  if (m2?.[1]) {
    const cleaned = trimLocationTail(stripLeadingDisfluency(m2[1])).replace(/\s+/g, " ");
    if (cleaned.length >= 10) return cleaned;
  }

  return "";
}

export function extractStructuredFields(text: string): VoiceStructuredFields {
  const lower = text.toLowerCase();
  const empty = (): VoiceStructuredFields => ({
    painLocation: "",
    severity: "",
    aggravating: "",
    relieving: "",
    functionalLimitation: "",
  });
  if (!text.trim()) return empty();

  const out = empty();
  const t = normalizeTranscriptText(text);

  const sev = extractSeverityCareful(t);
  if (sev) out.severity = sev;

  out.painLocation = extractPainLocationDetailed(t);

  out.aggravating = extractAggravating(t, lower);
  out.relieving = extractRelievingDetailed(t, lower);
  out.functionalLimitation = extractFunctionalDetailed(t, lower);

  if (!out.painLocation) {
    const region = t.match(
      /\b(left|right|bilateral)\s+(knee|shoulder|hip|ankle|wrist|elbow|neck|low back|lumbar|cervical)\b/i,
    );
    if (region?.[0]) out.painLocation = region[0].trim();
  }

  return out;
}

export function detectRedFlagKeywords(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const hits: string[] = [];
  for (const { label, re } of RED_FLAG_PATTERNS) {
    if (re.test(t)) hits.push(label);
  }
  return [...new Set(hits)];
}

function regionBiomechHint(painLower: string): string | null {
  if (/\b(lumbar|low back|lower back)\b/.test(painLower))
    return "Findings may suggest considering lumbopelvic loading tolerance and movement behaviour; in-person examination is needed to clarify.";
  if (/\bknee\b/.test(painLower))
    return "Findings may suggest exploring lower-limb loading and knee-region tolerance; confirm with objective tests and history.";
  if (/\b(shoulder|scapul)\b/.test(painLower))
    return "Findings may suggest attention to shoulder girdle and upper-limb loading patterns; verify with clinical examination.";
  if (/\b(cervical|neck)\b/.test(painLower))
    return "Findings may suggest considering cervical movement tolerance and upper-quarter screening; confirm in clinic.";
  if (/\bhip\b/.test(painLower))
    return "Findings may suggest hip-related mobility or loading as one area to explore; examination is required.";
  if (/\b(ankle|foot)\b/.test(painLower))
    return "Findings may suggest foot and ankle strategy during weight-bearing as a possible focus; verify with gait and strength assessment.";
  return null;
}

export type InterpretationBuildInput = {
  mode: "patient" | "therapist";
  speechLang: "en-US" | "ar-SA";
  wasTranslated: boolean;
  englishWorkingText: string;
  fields: VoiceStructuredFields;
};

export function buildInterpretationDraft(input: InterpretationBuildInput): string {
  const { mode, speechLang, wasTranslated, englishWorkingText, fields } = input;
  const work = normalizeTranscriptText(englishWorkingText);
  const red = detectRedFlagKeywords(work);

  const lines: string[] = [];

  lines.push("SOURCE SUMMARY (inputs for this draft)");
  lines.push(
    `- Capture type: ${mode === "patient" ? "Patient voice intake (guided prompts)" : "Therapist voice notes (free speech)"}.`,
  );
  lines.push(
    `- Speech-to-text language: ${speechLang === "ar-SA" ? "Arabic (ar-SA)" : "English (US)"}; browser speech recognition — accuracy not guaranteed.`,
  );
  if (wasTranslated) {
    lines.push(
      "- Assisted English translation was applied (public translation tier); meaning may be imperfect — verify with the patient or bilingual colleague if needed.",
    );
  }
  lines.push(
    "- Structuring: rule-based extraction from speech text only — not examination findings and not a diagnosis.",
  );
  lines.push("");

  lines.push("OBSERVED / DOCUMENTED FINDINGS (from speech — verify before relying on)");
  lines.push(
    "- Full verbatim capture is shown separately from this draft; treat this section as structured hints from speech only.",
  );
  if (fields.painLocation)
    lines.push(`- Regional focus (from speech, verify): ${fields.painLocation}.`);
  if (fields.severity) lines.push(`- Severity note (from speech, verify): ${fields.severity}`);
  if (fields.aggravating)
    lines.push(`- Reported aggravators (from speech, verify): ${fields.aggravating}.`);
  if (fields.relieving)
    lines.push(`- Reported easing factors (from speech, verify): ${fields.relieving}.`);
  if (fields.functionalLimitation)
    lines.push(
      `- Functional limitation wording (from speech, verify): ${fields.functionalLimitation}.`,
    );
  if (
    !fields.painLocation &&
    !fields.severity &&
    !fields.aggravating &&
    !fields.relieving &&
    !fields.functionalLimitation
  ) {
    lines.push(
      "- No structured fields were extracted automatically; review verbatim text and consider re-capturing or typing key findings.",
    );
  }
  if (work && work.length > 0) {
    const excerpt = work.length > 220 ? `${work.slice(0, 220)}…` : work;
    lines.push(
      `- Neutral excerpt of processed speech text (English basis for this draft, not a clinical conclusion): "${excerpt}"`,
    );
  }
  lines.push("");

  lines.push("POSSIBLE BIOMECHANICAL INTERPRETATIONS (hypotheses — not definitive)");
  const painLower = `${fields.painLocation} ${work}`.toLowerCase();
  const hint = regionBiomechHint(painLower);
  if (hint) {
    lines.push(`- ${hint}`);
  } else if (work) {
    lines.push(
      "- Documented speech does not map clearly to a single biomechanical pattern here; clinical examination and movement testing remain essential to form hypotheses.",
    );
  } else {
    lines.push("- Insufficient processed text to suggest biomechanical patterns; obtain clearer documentation or examination data.");
  }
  lines.push(
    "- Any link between symptoms and movement is tentative until confirmed by the treating physiotherapist.",
  );
  lines.push("");

  lines.push("POSSIBLE WEAKNESS OR LIMITATION PATTERNS (speculative — verify with testing)");
  if (fields.functionalLimitation) {
    lines.push(
      `- Reported difficulty with "${fields.functionalLimitation}" may relate to pain avoidance, strength, endurance, or motor control — only examination can distinguish these.`,
    );
  }
  if (fields.aggravating) {
    lines.push(
      `- Provocative theme in speech ("${fields.aggravating.slice(0, 120)}${fields.aggravating.length > 120 ? "…" : ""}") may warrant mapping to specific loads or postures in clinic; irritability unknown from speech alone.`,
    );
  }
  if (!fields.functionalLimitation && !fields.aggravating) {
    lines.push(
      "- No specific limitation or provocative pattern was extracted; therapist may add objective strength and functional tests to clarify.",
    );
  }
  lines.push("");

  lines.push("POTENTIAL FUNCTIONAL IMPACT (if reported complaints are confirmed)");
  const impactBits: string[] = [];
  if (fields.functionalLimitation) impactBits.push(`tasks involving "${fields.functionalLimitation}"`);
  if (fields.aggravating) impactBits.push(`activities that load or stress as described in speech`);
  if (impactBits.length) {
    lines.push(
      `- If verified, the described issues may affect ${impactBits.join(" and ")}; quantify with patient-specific activities (work, sport, ADL) in your assessment.`,
    );
  } else {
    lines.push(
      "- Functional impact cannot be inferred reliably from this capture alone; document patient-specific activities after interview and testing.",
    );
  }
  lines.push("");

  lines.push("THERAPIST ATTENTION POINTS");
  lines.push("- Cross-check this draft against verbatim speech and your physical examination before use in formal documentation.");
  lines.push("- Confirm pain scores, irritability, and 24-hour behaviour; speech alone may omit key modifiers.");
  if (wasTranslated) {
    lines.push("- Validate assisted translation for clinical nuance, especially for pain quality and fear-avoidance language.");
  }
  if (red.length === 0) {
    lines.push(
      "- Continue usual screening and clinical reasoning; this tool does not replace red-flag or safety assessment.",
    );
  }
  lines.push("");

  lines.push("SAFETY / RED-FLAG PROMPT (speech keyword scan — not a screening tool)");
  if (red.length) {
    lines.push(
      "The following themes appeared in the processed speech text and may warrant therapist review in line with your usual protocols:",
    );
    for (const r of red) lines.push(`- ${r}`);
    lines.push(
      "- This list is automated and incomplete; absence of a flag does not rule out serious pathology.",
    );
  } else {
    lines.push(
      "- No targeted phrases were flagged by this simple scan; maintain standard clinical vigilance regardless.",
    );
  }
  lines.push("");

  lines.push("AUTHORITY / LIMITATIONS");
  lines.push(INTERPRETATION_AUTHORITY_FOOTER);

  return lines.join("\n");
}

/** One-line hint for merging into chief complaint — hedged, non-diagnostic. */
export function buildChiefComplaintDraftLine(
  fields: VoiceStructuredFields,
  englishWorkingText: string,
): string {
  const w = normalizeTranscriptText(englishWorkingText);
  const narrative = extractChiefComplaintNarrative(w);
  const parts: string[] = [];
  if (fields.painLocation) parts.push(fields.painLocation);
  if (fields.severity) parts.push(fields.severity.replace(/\.$/, ""));

  if (narrative.length >= 12) {
    const cap = narrative.charAt(0).toUpperCase() + narrative.slice(1);
    const withStop = /[.!?]$/.test(cap) ? cap : `${cap}.`;
    return `From speech (draft, verify — not a diagnosis): ${withStop}`;
  }
  if (parts.length) {
    return `From speech (draft, verify — not a diagnosis): possible regional focus / symptoms — ${parts.join("; ")}.`;
  }
  if (w.length) {
    const cleaned = stripLeadingDisfluency(w);
    const ex = cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
    return `From speech (draft, verify — not a diagnosis): "${ex}"`;
  }
  return "Speech capture — draft review required (no structured hints extracted).";
}

/** Optional English → Arabic via MyMemory (public tier; may rate-limit). */
export async function translateEnglishToArabic(text: string): Promise<string | null> {
  const q = text.trim();
  if (!q) return null;
  const chunk = q.slice(0, 450);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ar`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) return null;
    const ar = data.responseData.translatedText.trim();
    if (q.length > 450) return `${ar} […truncated]`;
    return ar;
  } catch {
    return null;
  }
}

/** Optional Arabic → English via MyMemory (public tier; may rate-limit). */
export async function translateArabicToEnglish(text: string): Promise<string | null> {
  const q = text.trim();
  if (!q) return null;
  const chunk = q.slice(0, 450);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=ar|en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) return null;
    const en = data.responseData.translatedText.trim();
    if (q.length > 450) return `${en} […truncated; translate remainder manually]`;
    return en;
  } catch {
    return null;
  }
}
