/**
 * Encodes guided-coach pre/post session data in session_logs.notes
 * without schema changes. pain_score stores pain after (0–10).
 */

export type SessionCoachMetadata = {
  painBefore: number | null;
  safetyConcern: boolean;
  patientNote: string | null;
};

const COACH_PREFIX = "[rasq-coach";

export function encodeSessionCoachNotes(meta: SessionCoachMetadata): string | null {
  const parts: string[] = [];
  if (meta.painBefore != null) parts.push(`painBefore=${meta.painBefore}`);
  if (meta.safetyConcern) parts.push("safetyConcern=1");

  const header = parts.length > 0 ? `${COACH_PREFIX} ${parts.join(" ")}]` : null;
  const note = meta.patientNote?.trim() ?? "";

  if (!header && !note) return null;
  if (!header) return note;
  if (!note) return header;
  return `${header}\n${note}`;
}

export function parseSessionCoachNotes(notes: string | null | undefined): SessionCoachMetadata {
  const raw = notes?.trim() ?? "";
  if (!raw) {
    return { painBefore: null, safetyConcern: false, patientNote: null };
  }

  const match = raw.match(/^\[rasq-coach(?:\s+painBefore=(\d+))?(?:\s+safetyConcern=(0|1))?\]\n?([\s\S]*)$/);
  if (!match) {
    return { painBefore: null, safetyConcern: false, patientNote: raw || null };
  }

  const painBeforeRaw = match[1];
  const painBefore =
    painBeforeRaw != null && painBeforeRaw !== ""
      ? Number.parseInt(painBeforeRaw, 10)
      : null;
  const safetyConcern = match[2] === "1";
  const patientNote = match[3]?.trim() || null;

  return {
    painBefore: painBefore != null && !Number.isNaN(painBefore) ? painBefore : null,
    safetyConcern,
    patientNote,
  };
}

export function deriveSessionNeedsReview(input: {
  painBefore: number | null;
  painAfter: number | null;
  safetyConcern: boolean;
}): boolean {
  if (input.safetyConcern) return true;
  if (input.painBefore != null && input.painBefore >= 8) return true;
  if (input.painAfter != null && input.painAfter >= 8) return true;
  if (
    input.painBefore != null &&
    input.painAfter != null &&
    input.painAfter - input.painBefore >= 2
  ) {
    return true;
  }
  return false;
}

export function formatPainResponse(
  painBefore: number | null,
  painAfter: number | null,
): string | null {
  if (painBefore == null && painAfter == null) return null;
  const before = painBefore != null ? `${painBefore}/10` : "—";
  const after = painAfter != null ? `${painAfter}/10` : "—";
  return `${before} → ${after}`;
}
