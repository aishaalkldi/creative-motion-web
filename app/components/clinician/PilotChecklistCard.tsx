"use client";

import { useState } from "react";

const PILOT_STEPS = [
  { title: "Add patient", detail: "Create the patient file in the clinician portal." },
  { title: "Send assessment", detail: "Share a remote assessment link or document in clinic." },
  { title: "Review submitted assessment", detail: "Open the assessment report and focus context." },
  { title: "Assign plan", detail: "Build and assign a structured rehabilitation plan." },
  { title: "Patient completes home sessions", detail: "Patient uses the portal link for home sessions." },
  {
    title: "Review progress and movement metrics when available",
    detail: "Check session progress and derived movement metrics on the patient chart.",
  },
] as const;

export function PilotChecklistCard() {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-6 rounded-[10px] border border-[#1E2D42] bg-[#0F1825] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Pilot workflow checklist</h2>
          <p className="mt-1 text-xs text-white/35">
            Clinician-facing steps for a supervised clinic pilot. Not a clinical protocol.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="shrink-0 rounded-[6px] border border-[#1E2D42] bg-[#0B1220] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:text-white"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? (
        <ol className="mt-4 space-y-2.5">
          {PILOT_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-[7px] border border-[#1E2D42] bg-[#0B1220] px-3 py-2.5"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1E2D42] text-[11px] font-bold text-[#5DCAA5]"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/40">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
