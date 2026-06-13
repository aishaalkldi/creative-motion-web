const FILE_NUMBER_PATTERN = /^P-(\d+)$/;

/** Clinic-visible file number from a provider-scoped sequence (e.g. P-0001). */
export function formatPatientFileNumber(sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  return `P-${String(n).padStart(4, "0")}`;
}

/** Parse sequence from a formatted file number; returns null if not P-####. */
export function parsePatientFileNumberSequence(fileNumber: string): number | null {
  const match = FILE_NUMBER_PATTERN.exec(fileNumber.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Next sequence after the highest P-#### among existing file numbers. */
export function nextPatientFileNumberSequence(existingFileNumbers: readonly string[]): number {
  let max = 0;
  for (const raw of existingFileNumbers) {
    const seq = parsePatientFileNumberSequence(raw);
    if (seq !== null && seq > max) max = seq;
  }
  return max + 1;
}

/** Short fallback label for legacy patients without file_number. */
export function getPatientFileNumberFallback(patientId: string): string {
  const compact = patientId.replace(/-/g, "").toUpperCase();
  const suffix = compact.slice(-6);
  return suffix ? `…${suffix}` : "…";
}

/** Header line for clinician profile (e.g. "File P-0001" or "File …A1B2C3"). */
export function displayPatientFileHeader(
  fileNumber: string | null | undefined,
  patientId: string,
): string {
  const trimmed = fileNumber?.trim();
  if (trimmed) return `File ${trimmed}`;
  return `File ${getPatientFileNumberFallback(patientId)}`;
}
