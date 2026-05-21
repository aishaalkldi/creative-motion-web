"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PatientRow } from "../../../lib/validate-patient-ownership";

const inputCls =
  "w-full rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-[#1D9E75]/40";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/70">
        {label}
        {required && <span className="ml-1 text-rose-300">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function NewPatientPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    gender: "",
    sport: "",
    diagnosis: "",
    status: "Active",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.full_name.trim()) {
      setError("Patient name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          age: form.age ? parseInt(form.age, 10) : null,
          gender: form.gender || null,
          sport: form.sport.trim() || null,
          diagnosis: form.diagnosis.trim() || null,
          status: form.status || "Active",
        }),
      });

      const body = await res.json() as PatientRow & { error?: string };

      if (!res.ok) {
        throw new Error(body.error ?? `Failed to create patient (${res.status})`);
      }

      router.push(`/clinician/patients/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create patient.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] px-6 py-8 text-white">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-7">
          <Link
            href="/clinician/patients"
            className="mb-4 flex items-center gap-1.5 text-sm text-white/35 transition hover:text-white/65"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Patients
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">New Patient</p>
          <h1 className="mt-1.5 text-2xl font-bold text-white">Add patient</h1>
          <p className="mt-1 text-sm text-white/40">
            Creates a new patient record in your provider workspace.
          </p>
        </div>

        {/* Form */}
        <section className="rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" required>
                <input
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  className={inputCls}
                  placeholder="Sarah Al-Ahmad"
                  autoFocus
                />
              </Field>

              <Field label="Phone" required>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputCls}
                  placeholder="+966 5X XXX XXXX"
                />
              </Field>

              <Field label="Age">
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  className={inputCls}
                  placeholder="—"
                />
              </Field>

              <Field label="Gender">
                <select
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className={inputCls}
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Diagnosis / primary complaint">
                <input
                  value={form.diagnosis}
                  onChange={(e) => set("diagnosis", e.target.value)}
                  className={inputCls}
                  placeholder="ACL Reconstruction – R"
                />
              </Field>

              <Field label="Sport / activity">
                <input
                  value={form.sport}
                  onChange={(e) => set("sport", e.target.value)}
                  className={inputCls}
                  placeholder="Football, running…"
                />
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={inputCls}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </Field>
            </div>

            {error && (
              <p className="rounded-[7px] border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-[7px] bg-[#1D9E75] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#179165] disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create patient"}
              </button>
              <Link
                href="/clinician/patients"
                className="rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white/50 transition hover:text-white"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
