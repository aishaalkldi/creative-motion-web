"use client";

import { useTheme, type ThemeMode } from "@/app/components/ThemeProvider";

const MODES: ThemeMode[] = ["light", "dark"];

function SunIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.3 6.3L5.2 5.2M18.8 18.8l-1.1-1.1M6.3 17.7l-1.1 1.1M18.8 5.2l-1.1 1.1M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7.14 7.14 0 0021 12.79z" />
    </svg>
  );
}

const LABELS: Record<ThemeMode, { en: string; ar: string; icon: React.ReactNode }> = {
  light: { en: "Light", ar: "فاتح", icon: <SunIcon /> },
  dark: { en: "Dark", ar: "داكن", icon: <MoonIcon /> },
};

/** Compact 2-way segmented control: light / dark. RTL-safe, no layout direction assumptions. */
export function ThemeToggle({ isArabic = false, className = "" }: { isArabic?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={isArabic ? "اختيار المظهر" : "Choose theme"}
      className={`inline-flex items-center gap-0.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] p-0.5 ${className}`}
    >
      {MODES.map((mode) => {
        const active = theme === mode;
        const label = LABELS[mode];
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={isArabic ? label.ar : label.en}
            onClick={() => setTheme(mode)}
            className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition ${
              active
                ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-card)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="sr-only">{isArabic ? label.ar : label.en}</span>
            {label.icon}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {isArabic ? `المظهر الحالي: ${theme === "dark" ? "داكن" : "فاتح"}` : `Current theme: ${theme}`}
      </span>
    </div>
  );
}
