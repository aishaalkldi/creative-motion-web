"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getRemoteAssessment } from "../lib/api/remote-assessments";

export default function AssessmentAccessPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    const t = token.trim();
    if (!t) {
      setError("Please enter your assessment link or token.");
      return;
    }
    setError("");
    setLoading(true);

    // Accept full URL like https://…/assessment/abc123 or just the token
    const match = t.match(/\/assessment\/([a-zA-Z0-9_-]+)/);
    const resolved = match ? match[1] : t;

    try {
      const assessment = getRemoteAssessment(resolved);
      if (!assessment) {
        setError("This assessment link is not valid. Please check the link sent by your clinic.");
        return;
      }
      router.push(`/assessment/${resolved}`);
    } catch {
      setError("Something went wrong. Please try again or contact your clinic.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F5] px-6 py-16"
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}>

      {/* Card */}
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="1.5" fill="#1D9E75"/>
          </svg>
          <span className="text-lg font-bold tracking-[-0.03em] text-[#0f2e22]">RASQ</span>
        </div>

        <div className="rounded-[12px] border border-[#e4ece8] bg-white p-7 shadow-sm">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#0f2e22]">Open Your Assessment</h1>
            <p className="mt-1.5 text-sm leading-6 text-[#6b9080]">
              Enter the token or paste the full link sent by your clinic to access your assessment.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#6b9080]">
                Assessment link or token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") void handleOpen(); }}
                placeholder="Paste link or token here…"
                className="w-full rounded-[8px] border border-[#d8e4de] bg-[#F4F6F5] px-4 py-3 text-sm text-[#0f2e22] outline-none placeholder:text-[#9db0a3] focus:border-[#1D9E75] focus:bg-white"
              />
            </div>

            {error && (
              <div className="rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleOpen()}
              disabled={loading}
              className="w-full rounded-[8px] bg-[#1D9E75] py-3 text-sm font-bold text-white transition hover:bg-[#179165] disabled:opacity-60"
            >
              {loading ? "Opening…" : "Open Assessment"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#9db0a3]">
            Assessment links are sent by your clinic and expire after a set period.
          </p>
          <Link href="/" className="mt-3 inline-block text-xs font-semibold text-[#1D9E75] hover:text-[#0D6B4F]">
            ← Back to RASQ home
          </Link>
        </div>
      </div>
    </main>
  );
}
