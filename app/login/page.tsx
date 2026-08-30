"use client";

import Link from "next/link";
import { useGlobalLanguage } from "@/app/components/GlobalLanguageProvider";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrustFooter } from "../components/trust/TrustFooter";
import { loginClinician } from "../lib/api";
import { ensureProviderProfile } from "../lib/auth/ensure-provider-client";
import { setupDevAuthSession } from "../lib/dev-auth";
import { createClient as createSupabaseClient } from "../lib/supabase/browser";

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ── Role config ────────────────────────────────────────────────────────────────

type Role = "clinician" | "admin";

interface RoleConfig {
  title: string;
  subtitle: string;
  badge: string;
  defaultRedirect: string;
}

const ROLE_CONFIG_EN: Record<Role, RoleConfig> = {
  clinician: {
    title:           "Provider Access",
    subtitle:        "Manage patients, assessments, reports, treatment plans, and rehabilitation progress.",
    badge:           "Provider workspace",
    defaultRedirect: "/clinician",
  },
  admin: {
    title:           "Admin Access",
    subtitle:        "Manage clinic operations, providers, patients, and system assignments.",
    badge:           "Admin workspace",
    defaultRedirect: "/admin",
  },
};

const ROLE_CONFIG_AR: Record<Role, RoleConfig> = {
  clinician: {
    title:           "وصول مقدم الخدمة",
    subtitle:        "إدارة المرضى والتقييمات والتقارير وخطط العلاج ومتابعة إعادة التأهيل.",
    badge:           "مساحة مقدم الخدمة",
    defaultRedirect: "/clinician",
  },
  admin: {
    title:           "وصول الإدارة",
    subtitle:        "إدارة عمليات العيادة والمقدمي الرعاية والمرضى وتعيينات النظام.",
    badge:           "مساحة الإدارة",
    defaultRedirect: "/admin",
  },
};

function resolveRole(raw: string | null): Role {
  if (raw === "admin") return "admin";
  return "clinician";
}

// ── Login form ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { language } = useGlobalLanguage();
  const isArabic = language === "ar";

  const urlRole  = resolveRole(searchParams.get("role"));
  const returnTo = searchParams.get("returnTo") ?? "";

  const [role, setRole]         = useState<Role>(urlRole);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const cfg = isArabic ? ROLE_CONFIG_AR[role] : ROLE_CONFIG_EN[role];
  const redirectDest = returnTo || cfg.defaultRedirect;

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError(isArabic ? "يرجى إدخال البريد الإلكتروني وكلمة المرور." : "Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // ── Primary: Supabase Auth ───────────────────────────────────────────
      // Used for all new accounts created via /signup.
      if (SUPABASE_CONFIGURED) {
        const supabase = createSupabaseClient();
        const { error: sbError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (!sbError) {
          // Repair missing providers row from auth metadata before clinician entry.
          // Keep login successful even if provider setup is unavailable or the table
          // is not migrated yet; the portal should still load for the user.
          try {
            await ensureProviderProfile({
              email: email.trim().toLowerCase(),
            });
          } catch {
            // Intentionally ignore — provider bootstrap is non-blocking for sign-in.
          }
          router.push(redirectDest);
          router.refresh();
          return;
        }

        // "Invalid login credentials" means either wrong password OR user doesn't
        // exist in Supabase yet. Fall through to FastAPI for legacy accounts.
        // All other Supabase errors (rate limit, service unavailable) surface directly.
        if (sbError.message !== "Invalid login credentials") {
          setError(sbError.message);
          return;
        }
      }

      // ── Fallback: FastAPI JWT ────────────────────────────────────────────
      // Handles accounts that pre-date Supabase migration.
      // Sets cm_token cookie; proxy.ts accepts it during the transition period.
      await loginClinician(email.trim(), password);
      router.push(redirectDest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : isArabic ? "حدث خطأ ما. يرجى المحاولة مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDevBypass() {
    if (process.env.NODE_ENV !== "development") {
      setError(isArabic ? "تجاوز التطوير متاح فقط في الوضع التطويري." : "Dev bypass is only available in development mode.");
      return;
    }
    setupDevAuthSession();
    router.push(redirectDest);
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
      {/* Subtle brand ambient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, var(--brand-glow) 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">

        {/* Back to home */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="font-bold tracking-[-0.03em]">RASQ</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle isArabic={isArabic} />
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
              {cfg.badge}
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-card)]">

          {/* Role switcher */}
          <div className="mb-7 flex rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] p-0.5">
            {(["clinician", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-[9px] py-2.5 text-sm font-bold transition ${
                  role === r
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {r === "clinician" ? (isArabic ? "مقدم الخدمة" : "Provider") : (isArabic ? "الإدارة" : "Admin")}
              </button>
            ))}
          </div>

          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--foreground)]">{cfg.title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{cfg.subtitle}</p>
          </div>

          {/* Fields */}
          <div
            className="space-y-4"
            onKeyDown={(e) => { if (e.key === "Enter") void handleLogin(); }}
          >
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {isArabic ? "البريد الإلكتروني" : "Email"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isArabic ? "you@clinic.com" : "you@clinic.com"}
                autoComplete="email"
                className="w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--brand)]/50 focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--brand)]/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {isArabic ? "كلمة المرور" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isArabic ? "أدخل كلمة المرور" : "Enter password"}
                  autoComplete="current-password"
                  className="w-full rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-3 pe-11 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--brand)]/50 focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--brand)]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? (isArabic ? "إخفاء كلمة المرور" : "Hide password") : (isArabic ? "إظهار كلمة المرور" : "Show password")}
                  className="absolute end-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {SUPABASE_CONFIGURED && (
                <div className="mt-1.5 text-end">
                  <Link
                    href="/reset-password"
                    className="text-[11px] text-[var(--muted)] transition hover:text-[var(--brand)]"
                  >
                    {isArabic ? "هل نسيت كلمة المرور؟" : "Forgot your password?"}
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-[11px] border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="w-full rounded-[11px] bg-[var(--brand)] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? (isArabic ? "جارٍ تسجيل الدخول…" : "Signing in…")
                : (isArabic ? `تسجيل الدخول كـ ${role === "clinician" ? "مقدم الخدمة" : "الإدارة"}` : `Sign in as ${role === "clinician" ? "Provider" : "Admin"}`)}
            </button>

            {/* Dev bypass */}
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={handleDevBypass}
                className="w-full rounded-[11px] border border-[var(--warning)]/30 bg-[var(--warning-soft)] py-3 text-sm font-semibold text-[var(--warning)] transition hover:border-[var(--warning)]/50"
              >
                {isArabic ? "تجاوز التطوير (وضع التطوير فقط) →" : "Dev bypass (development only) →"} {redirectDest}
              </button>
            )}

            <p className="pt-1 text-center text-sm text-[var(--muted)]">
              {isArabic ? "ليس لديك حساب؟" : "Don&apos;t have an account?"}{" "}
              <Link href="/signup" className="font-semibold text-[var(--foreground)] transition hover:text-[var(--brand)]">
                {isArabic ? "إنشاء حساب" : "Sign up"}
              </Link>
            </p>

            {process.env.NODE_ENV === "development" && (
              <p className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 text-center text-[11px] leading-5 text-[var(--muted-soft)]">
                {isArabic ? "التطوير المحلي: API على" : "Local dev: API on"} <code className="text-[var(--muted)]">:8000</code> · {isArabic ? " PostgreSQL في" : "PostgreSQL in"}{" "}
                <code className="text-[var(--muted)]">backend/.env</code>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--muted-soft)]">
          {isArabic ? "RASQ من Creative Motion Lab · آمن · مصمم لسير العمل السريري" : "RASQ by Creative Motion Lab · Secure · Built for clinical workflows"}
        </p>
        <TrustFooter variant="auto" className="mt-2 border-none" />
      </div>
    </main>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
