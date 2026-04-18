"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerClinician } from "../lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("Admin");
  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("admin123");
  const [confirm, setConfirm] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");

    if (!fullName.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await registerClinician({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSignup();
  };

  return (
    <main className="min-h-screen bg-[#0B1220] text-[#F8FAFC]">
      <section className="flex min-h-screen items-center justify-center px-6 py-24">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-[0_0_40px_rgba(34,211,238,0.08)]">
          <div className="mb-8 text-center">
            <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
              Create Your Account
            </p>
            <h1 className="mb-3 text-3xl font-bold text-cyan-300">Sign Up</h1>
            <p className="text-sm leading-7 text-slate-300">
              Join Creative Motion Lab to access digital rehabilitation tools,
              movement analysis, and connected care workflows.
            </p>
          </div>

          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Sarah Ahmed"
                autoComplete="name"
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSignup()}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black transition duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(34,211,238,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>

            <p className="text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-300 hover:text-cyan-200">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
