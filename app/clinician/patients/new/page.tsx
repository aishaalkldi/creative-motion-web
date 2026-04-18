"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkPhoneExists, createPatient } from "../../../lib/api";

// ── Validation helpers ────────────────────────────────────────────────

/** Accepts 05XXXXXXXX, 009665XXXXXXXX, +9665XXXXXXXX */
function isValidPhone(v: string): boolean {
  return /^(?:\+9665|009665|05)\d{8}$/.test(v.replace(/\s/g, ""));
}

function isValidAge(v: string): boolean {
  const n = parseInt(v, 10);
  return !isNaN(n) && n >= 1 && n <= 120;
}

type FieldErrors = Partial<Record<"fullName" | "phone" | "age" | "diagnosis", string>>;

function validateAll(
  fullName: string,
  phone: string,
  age: string,
  diagnosis: string
): FieldErrors {
  const errors: FieldErrors = {};
  if (fullName.trim().length < 2) errors.fullName = "Full name must be at least 2 characters.";
  if (!phone.trim()) {
    errors.phone = "Phone number is required.";
  } else if (!isValidPhone(phone)) {
    errors.phone = "Enter a valid Saudi phone number (e.g. 0512345678 or +966512345678).";
  }
  if (!age.trim()) {
    errors.age = "Age is required.";
  } else if (!isValidAge(age)) {
    errors.age = "Age must be a number between 1 and 120.";
  }
  if (!diagnosis.trim()) errors.diagnosis = "Diagnosis is required.";
  return errors;
}

// ── Page ──────────────────────────────────────────────────────────────

export default function AddPatientPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [initialAssessment, setInitialAssessment] = useState("Gait Screening");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedPatientId, setSavedPatientId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // debounce ref for phone check
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear saved state when user edits anything after saving
  useEffect(() => {
    if (saved) {
      setSaved(false);
      setSavedPatientId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, phone, age, gender, diagnosis, notes]);

  // ── Per-field blur handlers ──────────────────────────────────────────

  function validateField(field: keyof FieldErrors, value: string) {
    const errs = validateAll(
      field === "fullName" ? value : fullName,
      field === "phone" ? value : phone,
      field === "age" ? value : age,
      field === "diagnosis" ? value : diagnosis,
    );
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] ?? "" }));
  }

  function handlePhoneBlur() {
    validateField("phone", phone);
    if (!isValidPhone(phone)) return;

    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(async () => {
      setPhoneChecking(true);
      try {
        const exists = await checkPhoneExists(phone);
        if (exists) {
          setFieldErrors((prev) => ({
            ...prev,
            phone: "This phone number is already registered to another patient.",
          }));
        }
      } finally {
        setPhoneChecking(false);
      }
    }, 300);
  }

  // ── Submit logic ─────────────────────────────────────────────────────

  async function persistToBackend(): Promise<number> {
    const errors = validateAll(fullName, phone, age, diagnosis);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error("Please fix the highlighted fields before saving.");
    }

    const patient = await createPatient({
      full_name: fullName.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender: gender.trim() || null,
      sport: null,
      diagnosis: diagnosis.trim(),
      status: "Active",
    });

    return patient.id;
  }

  async function withSave(afterSave?: (id: number) => void) {
    setIsSaving(true);
    setFormError("");
    setSaved(false);
    try {
      const id = await persistToBackend();
      setSaved(true);
      setSavedPatientId(id);
      afterSave?.(id);
    } catch (err) {
      setSaved(false);
      const msg = err instanceof Error ? err.message : "Save failed. Please try again.";
      // Surface phone duplicate from backend 409
      if (msg.toLowerCase().includes("phone")) {
        setFieldErrors((prev) => ({ ...prev, phone: msg }));
      } else {
        setFormError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  // ── Return ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
            Clinician Portal
          </div>
          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">Add New Patient</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
            Create a patient file, prepare the assessment setup, and continue the rehabilitation
            workflow through one connected clinical path.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
          {/* ── Main form ── */}
          <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Basic Information</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Full Name" error={fieldErrors.fullName} required>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => validateField("fullName", fullName)}
                  placeholder="Mohammed Al-Rashidi"
                  className={inputCls(!!fieldErrors.fullName)}
                />
              </Field>

              <Field
                label="Phone"
                error={fieldErrors.phone}
                required
                hint={phoneChecking ? "Checking…" : undefined}
              >
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="0512345678 or +966512345678"
                  type="tel"
                  className={inputCls(!!fieldErrors.phone)}
                />
              </Field>

              <Field label="Age" error={fieldErrors.age} required>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  onBlur={() => validateField("age", age)}
                  placeholder="25"
                  type="number"
                  min={1}
                  max={120}
                  className={inputCls(!!fieldErrors.age)}
                />
              </Field>

              <Field label="Gender">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={inputCls(false)}
                >
                  <option value="">Select option</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </Field>

              <Field label="Diagnosis" error={fieldErrors.diagnosis} required className="md:col-span-2">
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onBlur={() => validateField("diagnosis", diagnosis)}
                  placeholder="e.g. ACL Tear — Right Knee"
                  className={inputCls(!!fieldErrors.diagnosis)}
                />
              </Field>
            </div>

            {/* Medical notes */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">Medical Information</h2>
              <div className="mt-4">
                <Field label="Condition / Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Any additional notes about the patient's condition…"
                    className={inputCls(false)}
                  />
                </Field>
              </div>
            </div>

            {/* Assessment setup */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">Assessment Setup</h2>
              <div className="mt-4">
                <Field label="Initial Test">
                  <select
                    value={initialAssessment}
                    onChange={(e) => setInitialAssessment(e.target.value)}
                    className={inputCls(false)}
                  >
                    <option>Gait Screening</option>
                    <option>Observation</option>
                    <option>ROM Assessment</option>
                    <option>Functional Assessment</option>
                    <option>AI Vision Assessment</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Form-level error */}
            {formError && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                <span className="mt-0.5 text-red-400">⚠</span>
                {formError}
              </div>
            )}

            {/* Success */}
            {saved && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <span className="mt-0.5 text-emerald-400">✓</span>
                Patient saved successfully
                {savedPatientId ? ` (ID: ${savedPatientId})` : ""}.
              </div>
            )}
          </section>

          {/* ── Sidebar ── */}
          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Next Step</h2>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void withSave()}
                disabled={isSaving}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save Patient File"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void withSave((id) =>
                    router.push(`/clinician/patients/${id}`)
                  )
                }
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save & Open Profile
              </button>

              <button
                type="button"
                onClick={() =>
                  void withSave((id) =>
                    router.push(`/clinician/assessment/start?patientId=${id}`)
                  )
                }
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save & Start Assessment
              </button>

              <button
                type="button"
                onClick={() => void withSave(() => router.push("/clinician/patients"))}
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save & View All Patients
              </button>

              <Link
                href="/clinician"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Back to Dashboard
              </Link>
            </div>

            {/* Live preview */}
            <div className="mt-6 rounded-[20px] border border-white/10 bg-[#123a8a]/22 p-4">
              <h3 className="text-base font-semibold text-white">Preview</h3>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p><span className="font-semibold text-white">Name:</span> {fullName || "—"}</p>
                <p><span className="font-semibold text-white">Phone:</span> {phone || "—"}</p>
                <p><span className="font-semibold text-white">Age:</span> {age || "—"}</p>
                <p><span className="font-semibold text-white">Gender:</span> {gender || "—"}</p>
                <p><span className="font-semibold text-white">Diagnosis:</span> {diagnosis || "—"}</p>
                <p><span className="font-semibold text-white">Initial Test:</span> {initialAssessment}</p>
                <p>
                  <span className="font-semibold text-white">Status:</span>{" "}
                  {saved ? (
                    <span className="text-emerald-300">Saved</span>
                  ) : (
                    <span className="text-white/50">Draft</span>
                  )}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    "w-full rounded-2xl border px-4 py-3 text-white outline-none transition",
    "bg-[#123a8a]/35 placeholder:text-white/30",
    hasError
      ? "border-red-400/60 focus:border-red-400"
      : "border-white/10 focus:border-cyan-400/60",
  ].join(" ");
}

function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={["block", className].filter(Boolean).join(" ")}>
      <span className="mb-1.5 flex items-center gap-1 text-sm text-white/75">
        {label}
        {required && <span className="text-red-400">*</span>}
        {hint && <span className="ml-auto text-xs text-white/40">{hint}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-xs text-red-300">{error}</span>
      )}
    </label>
  );
}
