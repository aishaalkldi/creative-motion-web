"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@creativemotionlabs.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // Temporary demo credentials
      if (
        email === "admin@creativemotionlabs.com" &&
        password === "123456"
      ) {
        document.cookie = "cm_auth=logged_in; path=/; max-age=86400";
        document.cookie = `cm_user_email=${encodeURIComponent(
          email
        )}; path=/; max-age=86400`;

        router.push("/clinician");
        router.refresh();
        return;
      }

      setError("Invalid email or password");
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
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

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@creativemotionlabs.com"
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>

          <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4 text-sm text-slate-400">
            <p className="font-semibold text-white">Demo credentials</p>
            <p className="mt-2">Email: admin@creativemotionlabs.com</p>
            <p>Password: 123456</p>
          </div>
        </div>
      </div>
    </main>
  );
}