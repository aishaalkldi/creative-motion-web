"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient as createSupabaseClient } from "../../lib/supabase/browser";
import {
  AuthBrandMark,
  authCardClassName,
  authInputClassName,
  authShellClassName,
} from "../_components/AuthShell";

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) return;
    if (!SUPABASE_CONFIGURED) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseClient();
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/update-password` },
      );

      if (sbError) {
        setError("Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={authShellClassName}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(29,158,117,0.06) 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <AuthBrandMark />

        <div className={authCardClassName}>
          {sent ? (
            <p className="text-xs leading-6 text-[#6B7280]">
              Check your email. If an account exists for that address, you&apos;ll receive a reset link shortly.
            </p>
          ) : (
            <>
              <h1
                className="text-sm font-medium text-white"
                style={{ fontFamily: "var(--rasq-font-display, sans-serif)" }}
              >
                Reset your password
              </h1>
              <p className="mt-2 text-xs leading-6 text-[#6B7280]">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <div
                className="mt-6 space-y-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmit();
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  autoComplete="email"
                  className={authInputClassName}
                />

                {error && (
                  <p className="text-xs text-rose-300">{error}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={loading || !email.trim()}
                  className="w-full rounded-[7px] bg-[#1D9E75] py-3.5 text-sm font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </div>
            </>
          )}

          <p className="mt-6 text-center text-xs text-[#6B7280]">
            <Link href="/login" className="font-semibold text-white/55 transition hover:text-white">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
