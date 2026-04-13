"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPatientId } from "../../../lib/ids";
import type { PatientRecord } from "../../../lib/domain-types";
import { patientsRepository } from "../../../lib/repositories";

export default function AddPatientPage() {
  const router = useRouter();

  const [patientId] = useState(createPatientId());
  const [fullName, setFullName] = useState("AISHA");
  const [phone, setPhone] = useState("0500000000");
  const [age, setAge] = useState("25");
  const [gender, setGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("New Case");
  const [notes, setNotes] = useState("Initial patient created from form");
  const [initialAssessment, setInitialAssessment] = useState("Gait Screening");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function buildPatient(): PatientRecord {
    return {
      id: patientId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender: gender.trim(),
      diagnosis: diagnosis.trim(),
      notes: notes.trim(),
      initialAssessment: initialAssessment.trim(),
      status: "Saved",
      createdAt: new Date().toISOString(),
    };
  }

  function validate() {
    if (!fullName.trim()) return "Full Name is required.";
    if (!phone.trim()) return "Phone is required.";
    if (!age.trim()) return "Age is required.";
    return "";
  }

  function handleSavePatient() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }

    const patient = buildPatient();
    patientsRepository.create(patient);
    setSaved(true);
    setError("");
    alert("Patient saved successfully");
  }

  function handleOpenProfile() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }

    const patient = buildPatient();
    patientsRepository.create(patient);
    setSaved(true);
    setError("");
    router.push(`/clinician/patients/${patient.id}`);
  }

  function handleStartAssessment() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }

    const patient = buildPatient();
    patientsRepository.create(patient);
    setSaved(true);
    setError("");
    router.push(`/clinician/assessment/start?patientId=${patient.id}`);
  }

  function handleViewPatients() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }

    const patient = buildPatient();
    patientsRepository.create(patient);
    setSaved(true);
    setError("");
    router.push("/clinician/patients");
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
                onClick={handleSavePatient}
                className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Save Patient File
              </button>

              <button
                type="button"
                onClick={handleOpenProfile}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Open Patient Profile
              </button>

              <button
                type="button"
                onClick={handleStartAssessment}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Start Assessment
              </button>

              <button
                type="button"
                onClick={handleViewPatients}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
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