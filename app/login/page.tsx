"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginClinician } from "../lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/clinician";

  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await loginClinician(email.trim(), password);
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleLogin();
  };

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-20 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <div className="mb-8 text-center">
          <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
            Creative Motion
          </p>
          <h1 className="text-3xl font-bold text-cyan-300">Clinician Login</h1>
          <p className="mt-2 text-slate-300">
            Sign in to access the dashboard, patients, and assessment tools.
          </p>
        </div>

        <div className="space-y-5" onKeyDown={handleKeyDown}>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Login"}
          </button>

          <p className="text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-cyan-300 hover:text-cyan-200">
              Sign up
            </Link>
          </p>

          {process.env.NODE_ENV === "development" && (
            <p className="text-center text-[11px] leading-relaxed text-slate-600">
              Local dev: ensure the API is running on port 8000 and PostgreSQL is configured in{" "}
              <code className="text-slate-500">backend/creative-motion-backend/.env</code>. Seeded admin
              email/password default to the fields above (
              <code className="text-slate-500">SEED_ADMIN_*</code> overrides).
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-cyan-300 text-sm">Loading…</div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
