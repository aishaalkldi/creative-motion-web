"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { createClient as createSupabaseClient } from "../../lib/supabase/browser";
import {
  AuthBrandMark,
  authCardClassName,
  authInputClassName,
  authShellClassName,
} from "../_components/AuthShell";

function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      }
      setCheckingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords must match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseClient();
      const { error: sbError } = await supabase.auth.updateUser({ password });

      if (sbError) {
        setError(sbError.message);
        return;
      }

      await supabase.auth.signOut();
      setUpdated(true);
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
          {updated ? (
            <div className="space-y-4">
              <p className="text-sm text-white">Password updated. You can now log in.</p>
              <Link
                href="/login"
                className="block w-full rounded-[7px] bg-[#1D9E75] py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#179165]"
              >
                Go to login
              </Link>
            </div>
          ) : checkingSession ? (
            <p className="text-xs text-[#6B7280]">Verifying reset link…</p>
          ) : !sessionReady ? (
            <div className="space-y-4">
              <p className="text-xs leading-6 text-[#6B7280]">
                Open the reset link from your email to set a new password.
              </p>
              <Link
                href="/reset-password"
                className="block w-full rounded-[7px] bg-[#1D9E75] py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#179165]"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              <h1
                className="text-sm font-medium text-white"
                style={{ fontFamily: "var(--rasq-font-display, sans-serif)" }}
              >
                Set a new password
              </h1>

              <div
                className="mt-6 space-y-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmit();
                }}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className={authInputClassName}
                />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className={authInputClassName}
                />

                {error && (
                  <p className="text-xs text-rose-300">{error}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                  className="w-full rounded-[7px] bg-[#1D9E75] py-3.5 text-sm font-bold text-white transition hover:bg-[#179165] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080E14]">
          <p className="text-sm text-white/30">Loading…</p>
        </div>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
