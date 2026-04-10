"use client";

import Link from "next/link";
import { useState } from "react";

export default function AddNewPatientPage() {
  const [patientId, setPatientId] = useState("PT-1005");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [condition, setCondition] = useState("");
  const [test, setTest] = useState("gait");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const patientData = {
      patient_code: patientId,
      name: name,
      phone: phone,
      age: age,
      gender: gender,
      diagnosis: diagnosis,
      condition: condition,
      status: "Active",
    };

    try {
      setLoading(true);

      const res = await fetch("http://127.0.0.1:8000/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      });

      if (!res.ok) {
        throw new Error("Failed to save patient");
      }

      const data = await res.json();
      console.log("Saved:", data);

      alert("Patient saved successfully ✅");
    } catch (error) {
      console.error(error);
      alert("Error saving patient ❌");
    } finally {
      setLoading(false);
    }
  };

  const assessmentLink = `/body-axis-ai?patientId=${encodeURIComponent(
    patientId
  )}&patientName=${encodeURIComponent(
    name || "New Patient"
  )}&test=${encodeURIComponent(test)}&assessmentId=AX-NEW-1001`;

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Clinician Portal
          </p>
          <h1 className="text-4xl font-bold text-cyan-300">Add New Patient</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-300">
            Create a patient file, prepare the assessment setup, and continue the
            rehab workflow through Body Axis AI and clinician review.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.7fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h2 className="mb-6 text-2xl font-semibold text-white">
              Basic Information
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Patient ID"
                value={patientId}
                onChange={setPatientId}
                placeholder="PT-1005"
              />
              <Field
                label="Full Name"
                value={name}
                onChange={setName}
                placeholder="AISHA"
              />
              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="0500000000"
              />
              <Field
                label="Age"
                value={age}
                onChange={setAge}
                placeholder="25"
              />

              <div>
                <label className="mb-2 block text-sm text-slate-300">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option value="">Select option</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>

              <Field
                label="Diagnosis"
                value={diagnosis}
                onChange={setDiagnosis}
                placeholder="New Case"
              />
            </div>

            <div className="mt-8">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Medical Information
              </h2>

              <Field
                label="Condition / Notes"
                value={condition}
                onChange={setCondition}
                placeholder="Initial patient created from form"
              />
            </div>

            <div className="mt-8">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Assessment Setup
              </h2>

              <div className="max-w-sm">
                <label className="mb-2 block text-sm text-slate-300">
                  Initial Test
                </label>
                <select
                  value={test}
                  onChange={(e) => setTest(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option value="gait">Gait Screening</option>
                  <option value="balance">Balance Test</option>
                  <option value="posture">Posture Analysis</option>
                  <option value="squat">Squat Analysis</option>
                </select>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="mb-5 text-2xl font-semibold text-white">Next Step</h2>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-center font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Saving..." : "Save Patient File"}
              </button>

              <Link
                href={assessmentLink}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Generate Assessment Link
              </Link>

              <Link
                href="/clinician/patients"
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                View All Patients
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F172A] p-4 text-sm text-slate-300">
              <p className="mb-2 font-semibold text-white">Preview</p>
              <p>Patient ID: {patientId || "-"}</p>
              <p>Name: {name || "-"}</p>
              <p>Phone: {phone || "-"}</p>
              <p>Test: {test || "-"}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
      />
    </div>
  );
}