"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPatientId } from "../../../lib/ids";
import { createPatient } from "../../../lib/api";

export default function AddPatientPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState("");

  useEffect(() => {
    setPatientId(createPatientId());
  }, []);
  const [fullName, setFullName] = useState("AISHA");
  const [phone, setPhone] = useState("0500000000");
  const [age, setAge] = useState("25");
  const [gender, setGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("New Case");
  const [notes, setNotes] = useState("Initial patient created from form");
  const [initialAssessment, setInitialAssessment] = useState("Gait Screening");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function persistPatientToBackend() {
    const validationError = validate();
    if (validationError) throw new Error(validationError);

    await createPatient({
      patient_code: patientId.trim(),
      name: fullName.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender: gender.trim(),
      diagnosis: diagnosis.trim(),
      condition: notes.trim(),
      status: "Active",
    });
  }

  function validate() {
    if (!patientId.trim()) return "Patient ID is still loading. Please wait a moment.";
    if (!fullName.trim()) return "Full Name is required.";
    if (!phone.trim()) return "Phone is required.";
    if (!age.trim()) return "Age is required.";
    return "";
  }

  async function handleSavePatient() {
    setIsSaving(true);
    setError("");
    setSaved(false);
    try {
      await persistPatientToBackend();
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenProfile() {
    setIsSaving(true);
    setError("");
    setSaved(false);
    try {
      await persistPatientToBackend();
      setSaved(true);
      router.push(`/clinician/patients/${encodeURIComponent(patientId.trim())}`);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStartAssessment() {
    setIsSaving(true);
    setError("");
    setSaved(false);
    try {
      await persistPatientToBackend();
      setSaved(true);
      router.push(
        `/clinician/assessment/start?patientId=${encodeURIComponent(patientId.trim())}`
      );
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleViewPatients() {
    setIsSaving(true);
    setError("");
    setSaved(false);
    try {
      await persistPatientToBackend();
      setSaved(true);
      router.push("/clinician/patients");
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071a2f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
            Clinician Portal
          </div>

          <h1 className="mt-4 text-3xl font-bold text-cyan-300 md:text-4xl">
            Add New Patient
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
            Create a patient file, prepare the assessment setup, and continue the rehabilitation workflow through one connected clinical path.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
          <section className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Basic Information</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Patient ID">
                <input
                  value={patientId}
                  readOnly
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field label="Full Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field label="Age">
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                />
              </Field>

              <Field label="Gender">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                >
                  <option value="">Select option</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </Field>

              <Field label="Diagnosis">
                <input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                />
              </Field>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">Medical Information</h2>
              <div className="mt-4">
                <Field label="Condition / Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white">Assessment Setup</h2>
              <div className="mt-4">
                <Field label="Initial Test">
                  <select
                    value={initialAssessment}
                    onChange={(e) => setInitialAssessment(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#123a8a]/35 px-4 py-3 text-white outline-none"
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

            {error && (
              <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {saved && (
              <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                Patient saved successfully.
              </div>
            )}
          </section>

          <aside className="rounded-[28px] border border-cyan-300/18 bg-white/[0.04] p-6 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white">Next Step</h2>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleSavePatient()}
                disabled={isSaving}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save Patient File"}
              </button>

              <button
                type="button"
                onClick={() => void handleOpenProfile()}
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open Patient Profile
              </button>

              <button
                type="button"
                onClick={() => void handleStartAssessment()}
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Assessment
              </button>

              <button
                type="button"
                onClick={() => void handleViewPatients()}
                disabled={isSaving}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                View All Patients
              </button>

              <Link
                href="/clinician"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Back to Dashboard
              </Link>
            </div>

            <div className="mt-6 rounded-[20px] border border-white/10 bg-[#123a8a]/22 p-4">
              <h3 className="text-base font-semibold text-white">Preview</h3>

              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p><span className="font-semibold text-white">Patient ID:</span> {patientId}</p>
                <p><span className="font-semibold text-white">Name:</span> {fullName || "-"}</p>
                <p><span className="font-semibold text-white">Phone:</span> {phone || "-"}</p>
                <p><span className="font-semibold text-white">Initial Test:</span> {initialAssessment || "-"}</p>
                <p><span className="font-semibold text-white">Status:</span> {saved ? "Saved" : "Draft"}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/75">{label}</span>
      {children}
    </label>
  );
}